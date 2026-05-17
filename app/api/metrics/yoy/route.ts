import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface SnapshotRow {
  view_key: string;
  total_value: number;
  snapshot_date: string;
}

interface CashflowRow {
  amount: number;
  transaction_date: string;
}

interface CalendarYearReturn {
  year: number;
  startValue: number;
  endValue: number;
  netCashflow: number;
  weightedCashflow: number;
  returnPct: number;
  method: 'modified_dietz';
}

function daysInYear(year: number): number {
  return new Date(Date.UTC(year + 1, 0, 0)).getUTCDate();
}

function dayOfYear(dateStr: string): number {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const year = date.getUTCFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  const diffMs = date.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

async function ensureTables() {
  const db = await getDatabase();

  await db.run(`
    CREATE TABLE IF NOT EXISTS portfolio_snapshots_by_view (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      view_key TEXT NOT NULL,
      total_value REAL NOT NULL,
      equity_value REAL NOT NULL,
      cash_value REAL NOT NULL,
      snapshot_date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(view_key, snapshot_date)
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS investment_cashflows (
      transaction_id TEXT PRIMARY KEY,
      view_key TEXT NOT NULL,
      amount REAL NOT NULL,
      transaction_date DATE NOT NULL,
      classification TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  return db;
}

export async function GET(request: NextRequest) {
  try {
    const viewKey = String(request.nextUrl.searchParams.get('viewKey') || '').trim();

    if (!viewKey) {
      return NextResponse.json({ error: 'viewKey is required' }, { status: 400 });
    }

    if (viewKey === 'overall') {
      return NextResponse.json(
        { error: 'YOY is available only for account-level views' },
        { status: 400 }
      );
    }

    const db = await ensureTables();

    const snapshots = await db.all<SnapshotRow[]>(
      `
      SELECT view_key, total_value, snapshot_date
      FROM portfolio_snapshots_by_view
      WHERE view_key = ?
      ORDER BY snapshot_date ASC
    `,
      [viewKey]
    );

    if (snapshots.length === 0) {
      return NextResponse.json({ viewKey, years: [] as CalendarYearReturn[] });
    }

    const years = Array.from(new Set(snapshots.map((row) => Number(row.snapshot_date.slice(0, 4))))).sort(
      (a, b) => a - b
    );

    const result: CalendarYearReturn[] = [];

    for (const year of years) {
      const yearSnapshots = snapshots.filter((row) => row.snapshot_date.startsWith(String(year)));
      if (yearSnapshots.length < 2) {
        continue;
      }

      const startSnapshot = yearSnapshots[0];
      const endSnapshot = yearSnapshots[yearSnapshots.length - 1];

      const flows = await db.all<CashflowRow[]>(
        `
        SELECT amount, transaction_date
        FROM investment_cashflows
        WHERE view_key = ?
          AND transaction_date >= ?
          AND transaction_date <= ?
        ORDER BY transaction_date ASC
      `,
        [viewKey, `${year}-01-01`, `${year}-12-31`]
      );

      const totalDays = daysInYear(year);
      const netCashflow = flows.reduce((sum, flow) => sum + Number(flow.amount || 0), 0);
      const weightedCashflow = flows.reduce((sum, flow) => {
        const day = dayOfYear(flow.transaction_date);
        const weight = Math.max(0, (totalDays - day + 1) / totalDays);
        return sum + Number(flow.amount || 0) * weight;
      }, 0);

      const startValue = Number(startSnapshot.total_value || 0);
      const endValue = Number(endSnapshot.total_value || 0);

      const numerator = endValue - startValue - netCashflow;
      const denominator = startValue + weightedCashflow;

      if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-9) {
        continue;
      }

      const returnPct = (numerator / denominator) * 100;

      result.push({
        year,
        startValue,
        endValue,
        netCashflow,
        weightedCashflow,
        returnPct,
        method: 'modified_dietz',
      });
    }

    return NextResponse.json({
      viewKey,
      years: result.sort((a, b) => b.year - a.year),
    });
  } catch (error) {
    console.error('Error computing calendar YOY:', error);
    return NextResponse.json({ error: 'Failed to compute calendar YOY' }, { status: 500 });
  }
}


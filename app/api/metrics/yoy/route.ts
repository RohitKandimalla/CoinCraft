import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { getPlaidBaseUrl } from '@/lib/plaid';

const PLAID_PAGE_SIZE = 500;

interface Transaction {
  date: string;
  type: string;
  subtype: string;
  amount: number; // Plaid: positive = outflow (buy), negative = inflow (sell proceeds)
  quantity: number;
  price: number;
  fees: number;
  account_id: string;
  security_id: string;
  ticker?: string;
}

async function fetchAllTransactions(accessToken: string): Promise<Transaction[]> {
  const clientId = process.env.PLAID_CLIENT_ID!;
  const secret = process.env.PLAID_SECRET!;
  const plaidBaseUrl = getPlaidBaseUrl();
  const allTransactions: Transaction[] = [];

  const startDate = '2015-01-01';
  const endDate = new Date().toISOString().split('T')[0];

  let offset = 0;
  let total = 1; // seed to enter loop

  while (allTransactions.length < total) {
    const resp = await fetch(`${plaidBaseUrl}/investments/transactions/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        secret,
        access_token: accessToken,
        start_date: startDate,
        end_date: endDate,
        options: { count: PLAID_PAGE_SIZE, offset },
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      throw new Error(`Plaid transactions error: ${errBody.error_message || resp.status}`);
    }

    const data = await resp.json();
    total = data.total_investment_transactions;

    const securitiesById = new Map<string, any>();
    for (const sec of data.securities || []) {
      securitiesById.set(sec.security_id, sec);
    }

    for (const txn of data.investment_transactions || []) {
      const sec = securitiesById.get(txn.security_id) || {};
      allTransactions.push({
        date: txn.date,
        type: txn.type,
        subtype: txn.subtype,
        amount: txn.amount ?? 0,
        quantity: txn.quantity ?? 0,
        price: txn.price ?? 0,
        fees: txn.fees ?? 0,
        account_id: txn.account_id,
        security_id: txn.security_id,
        ticker: sec.ticker_symbol ?? sec.security_id ?? '',
      });
    }

    offset += PLAID_PAGE_SIZE;
    if (offset >= total) break;
  }

  return allTransactions;
}

/**
 * Modified Dietz method per calendar year.
 *
 * Return = (End - Start - NetFlow) / (Start + WeightedFlow)
 *
 * NetFlow = sum of deposits - sum of withdrawals (cash injected into or taken out of the portfolio)
 * WeightedFlow = sum of each flow * ((days_in_year - day_of_flow) / days_in_year)
 *
 * For investment accounts, "deposits" = cash buys, "withdrawals" = cash from sells.
 * We treat all cash transactions (type=cash, subtype=deposit/withdrawal) as external flows.
 */
function computeYOY(
  transactions: Transaction[],
  snapshots: { snapshot_date: string; total_value: number }[]
): {
  year: number;
  returnPct: number;
  startValue: number | null;
  endValue: number | null;
  note: string;
}[] {
  const snapshotMap = new Map<string, number>();
  for (const s of snapshots) {
    snapshotMap.set(s.snapshot_date, s.total_value);
  }

  // Group transactions by year
  const txnsByYear = new Map<number, Transaction[]>();
  for (const txn of transactions) {
    const year = parseInt(txn.date.substring(0, 4));
    const list = txnsByYear.get(year) || [];
    list.push(txn);
    txnsByYear.set(year, list);
  }

  const years = Array.from(txnsByYear.keys()).sort();
  const results = [];
  const currentYear = new Date().getFullYear();

  for (const year of years) {
    const txns = txnsByYear.get(year)!;
    const isCurrentYear = year === currentYear;
    const daysInYear = isCurrentYear
      ? Math.floor((Date.now() - new Date(`${year}-01-01`).getTime()) / 86400000)
      : (new Date(`${year}-12-31`).getTime() - new Date(`${year}-01-01`).getTime()) / 86400000 + 1;

    // Find start/end snapshot values
    const startDate = `${year}-01-01`;
    const endDate = isCurrentYear ? new Date().toISOString().split('T')[0] : `${year}-12-31`;

    // Nearest snapshot at/before startDate and at/for endDate
    const startValue = findNearestSnapshot(snapshotMap, startDate, 'before');
    const endValue = findNearestSnapshot(snapshotMap, endDate, 'after');

    if (startValue === null || endValue === null) {
      // Not enough data yet — record as partial
      results.push({ year, returnPct: 0, startValue, endValue, note: 'insufficient_data' });
      continue;
    }

    // External cash flows: Plaid uses amount > 0 for buys (cash leaves brokerage),
    // amount < 0 for sells/dividends (cash enters brokerage)
    // For Modified Dietz, external flow = net cash added FROM OUTSIDE (deposits/withdrawals)
    // Robinhood investment transactions are internal (buy/sell moves money within portfolio).
    // So for this calculation: netFlow = 0 (all buys/sells are internal to the portfolio value)
    // We still compute simple return: (end - start) / start
    // Going further: for accounts where deposits are tracked, we separate them.
    let netCashFlow = 0;
    let weightedCashFlow = 0;

    for (const txn of txns) {
      const isCashDeposit =
        txn.type === 'cash' && (txn.subtype === 'deposit' || txn.subtype === 'transfer');
      const isCashWithdrawal = txn.type === 'cash' && txn.subtype === 'withdrawal';

      if (!isCashDeposit && !isCashWithdrawal) continue;

      const txnDate = new Date(txn.date);
      const yearStart = new Date(`${year}-01-01`);
      const dayOfYear = Math.floor((txnDate.getTime() - yearStart.getTime()) / 86400000);
      const weight = (daysInYear - dayOfYear) / daysInYear;

      // Cash deposit: positive flow (money added from outside)
      // Cash withdrawal: negative flow (money taken out)
      const flow = isCashDeposit ? Math.abs(txn.amount) : -Math.abs(txn.amount);
      netCashFlow += flow;
      weightedCashFlow += flow * weight;
    }

    const denominator = startValue + weightedCashFlow;
    const returnPct =
      denominator > 0 ? ((endValue - startValue - netCashFlow) / denominator) * 100 : 0;

    results.push({
      year,
      returnPct,
      startValue,
      endValue,
      note: isCurrentYear ? 'ytd' : 'full_year',
    });
  }

  return results;
}

/**
 * Reconstruct approximate historical portfolio values from transaction history
 * by working backwards and forwards from current known value.
 *
 * Logic:
 * - We know today's portfolio value (from latest snapshot).
 * - For each BUY transaction going backwards in time, the portfolio was smaller by that amount.
 * - For each SELL transaction going backwards in time, the portfolio was larger by that amount.
 * - This gives us approximate Jan 1 portfolio values for each year that had transactions.
 */
function reconstructHistoricalValues(
  transactions: Transaction[],
  latestValue: number,
  latestDate: string
): Map<string, number> {
  // Sort transactions newest first
  const sorted = [...transactions].sort((a, b) => (a.date < b.date ? 1 : -1));

  const reconstructed = new Map<string, number>();
  reconstructed.set(latestDate, latestValue);

  let runningValue = latestValue;

  for (const txn of sorted) {
    if (txn.date >= latestDate) continue;

    // BUY: money left cash to buy security. Going backward = add it back.
    if (txn.type === 'buy') {
      runningValue += Math.abs(txn.amount);
    }
    // SELL: security became cash. Going backward = remove proceeds.
    else if (txn.type === 'sell') {
      runningValue -= Math.abs(txn.amount);
    }
    // Cash deposit: money entered portfolio. Going backward = remove it.
    else if (txn.type === 'cash' && txn.subtype === 'deposit') {
      runningValue -= Math.abs(txn.amount);
    }
    // Cash withdrawal: money left portfolio. Going backward = add it back.
    else if (txn.type === 'cash' && txn.subtype === 'withdrawal') {
      runningValue += Math.abs(txn.amount);
    }

    // Cap at reasonable minimum
    runningValue = Math.max(runningValue, 0);
    reconstructed.set(txn.date, runningValue);
  }

  return reconstructed;
}

function findNearestSnapshot(
  map: Map<string, number>,
  date: string,
  direction: 'before' | 'after'
): number | null {
  const dates = Array.from(map.keys()).sort();
  if (dates.length === 0) return null;

  if (direction === 'before') {
    // Latest snapshot on or before date
    const candidates = dates.filter((d) => d <= date);
    if (candidates.length === 0) return null;
    return map.get(candidates[candidates.length - 1])!;
  } else {
    // Earliest snapshot on or after date
    const candidates = dates.filter((d) => d >= date);
    if (candidates.length === 0) {
      // Fall back to latest snapshot
      return map.get(dates[dates.length - 1])!;
    }
    return map.get(candidates[0])!;
  }
}

export async function GET() {
  try {
    const db = await getDatabase();

    await db.run(`
      CREATE TABLE IF NOT EXISTS investment_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plaid_transaction_id TEXT,
        account_id TEXT,
        ticker TEXT,
        security_id TEXT,
        date TEXT NOT NULL,
        type TEXT,
        subtype TEXT,
        amount REAL,
        quantity REAL,
        price REAL,
        fees REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const existing = await db.get('SELECT * FROM yoy_returns ORDER BY calculated_at DESC LIMIT 1');

    const tokenRecord = await db.get(
      'SELECT access_token FROM provider_tokens WHERE provider = ?',
      ['plaid']
    );

    if (!tokenRecord) {
      return NextResponse.json({ error: 'Plaid not connected' }, { status: 400 });
    }

    const transactions = await fetchAllTransactions(tokenRecord.access_token);

    // Persist transactions (upsert)
    await db.run('DELETE FROM investment_transactions');
    for (const txn of transactions) {
      await db.run(
        `INSERT INTO investment_transactions (account_id, ticker, security_id, date, type, subtype, amount, quantity, price, fees)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          txn.account_id,
          txn.ticker,
          txn.security_id,
          txn.date,
          txn.type,
          txn.subtype,
          txn.amount,
          txn.quantity,
          txn.price,
          txn.fees,
        ]
      );
    }

    const snapshots = await db.all<{ snapshot_date: string; total_value: number }[]>(
      'SELECT snapshot_date, total_value FROM portfolio_snapshots ORDER BY snapshot_date'
    );

    // Augment snapshots with reconstructed historical values from transaction history
    const latestSnap = snapshots[snapshots.length - 1];
    const augmentedSnapshotMap = new Map<string, number>();

    if (latestSnap) {
      const reconstructed = reconstructHistoricalValues(
        transactions,
        latestSnap.total_value,
        latestSnap.snapshot_date
      );
      for (const [date, value] of reconstructed) {
        augmentedSnapshotMap.set(date, value);
      }
    }

    // Overlay actual DB snapshots (they take precedence over reconstructed values)
    for (const s of snapshots) {
      augmentedSnapshotMap.set(s.snapshot_date, s.total_value);
    }

    const yoyResults = computeYOY(
      transactions,
      Array.from(augmentedSnapshotMap).map(([snapshot_date, total_value]) => ({
        snapshot_date,
        total_value,
      }))
    );

    // Persist calculated returns
    for (const result of yoyResults) {
      if (result.note === 'insufficient_data') continue;
      await db.run(
        `INSERT OR REPLACE INTO yoy_returns (year, total_return_pct, start_value, end_value, calculated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [result.year, result.returnPct, result.startValue, result.endValue]
      );
    }

    return NextResponse.json({
      returns: yoyResults,
      transactionCount: transactions.length,
    });
  } catch (error) {
    console.error('Error computing YOY returns:', error);
    return NextResponse.json(
      { error: 'Failed to compute YOY returns', detail: String(error) },
      { status: 500 }
    );
  }
}

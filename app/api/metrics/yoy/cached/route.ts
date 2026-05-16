import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await getDatabase();
    const rows = await db.all(
      `SELECT year, total_return_pct as returnPct, start_value as startValue, end_value as endValue,
              CASE WHEN year = strftime('%Y','now') THEN 'ytd' ELSE 'full_year' END as note
       FROM yoy_returns
       ORDER BY year ASC`
    );
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json([]);
  }
}

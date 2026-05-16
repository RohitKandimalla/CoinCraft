import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  try {
    const db = await getDatabase();
    const note = await db.get(
      'SELECT * FROM stock_notes WHERE ticker = ?',
      [params.ticker]
    );

    if (!note) {
      return NextResponse.json({
        ticker: params.ticker,
        note: '',
        tags: [],
        target_buy_price: null,
        target_sell_price: null,
      });
    }

    return NextResponse.json({
      ...note,
      tags: note.tags ? JSON.parse(note.tags) : [],
    });
  } catch (error) {
    console.error('Error fetching notes:', error);
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  try {
    const body = await request.json();
    const db = await getDatabase();

    await db.run(
      `INSERT OR REPLACE INTO stock_notes 
       (ticker, note, tags, target_buy_price, target_sell_price, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        params.ticker,
        body.note || '',
        JSON.stringify(body.tags || []),
        body.target_buy_price || null,
        body.target_sell_price || null,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving notes:', error);
    return NextResponse.json({ error: 'Failed to save notes' }, { status: 500 });
  }
}


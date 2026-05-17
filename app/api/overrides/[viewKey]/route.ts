import { NextRequest, NextResponse } from 'next/server';
import { Database } from 'sqlite';
import { getDatabase } from '@/lib/db';

async function ensureTable(db: Database) {
  await db.run(`
    CREATE TABLE IF NOT EXISTS contribution_overrides (
      view_key TEXT PRIMARY KEY,
      value REAL NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ viewKey: string }> }
) {
  try {
    const { viewKey } = await params;
    const db = await getDatabase();
    await ensureTable(db);

    const row = await db.get(
      'SELECT view_key, value, updated_at FROM contribution_overrides WHERE view_key = ?',
      [viewKey]
    );

    return NextResponse.json({
      viewKey,
      value: row?.value ?? null,
      updatedAt: row?.updated_at ?? null,
    });
  } catch (error) {
    console.error('Error reading contribution override:', error);
    return NextResponse.json({ error: 'Failed to read contribution override' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ viewKey: string }> }
) {
  try {
    const { viewKey } = await params;

    if (viewKey === 'overall') {
      return NextResponse.json(
        { error: 'Overall baseline is derived from account-level overrides.' },
        { status: 400 }
      );
    }

    const body = (await request.json()) as { value?: unknown };
    const value = Number(body.value);

    if (!Number.isFinite(value) || value < 0) {
      return NextResponse.json(
        { error: 'Invalid value. Expected a non-negative number.' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    await ensureTable(db);

    await db.run(
      `INSERT INTO contribution_overrides (view_key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(view_key)
       DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      [viewKey, value]
    );

    return NextResponse.json({ success: true, viewKey, value });
  } catch (error) {
    console.error('Error saving contribution override:', error);
    return NextResponse.json({ error: 'Failed to save contribution override' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ viewKey: string }> }
) {
  try {
    const { viewKey } = await params;

    if (viewKey === 'overall') {
      return NextResponse.json(
        { error: 'Overall baseline is derived from account-level overrides.' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    await ensureTable(db);

    await db.run('DELETE FROM contribution_overrides WHERE view_key = ?', [viewKey]);
    return NextResponse.json({ success: true, viewKey });
  } catch (error) {
    console.error('Error deleting contribution override:', error);
    return NextResponse.json({ error: 'Failed to delete contribution override' }, { status: 500 });
  }
}

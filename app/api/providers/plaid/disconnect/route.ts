import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

export async function POST() {
  try {
    const db = await getDatabase();
    await db.run('DELETE FROM provider_tokens WHERE provider = ?', ['plaid']);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting Plaid:', error);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}

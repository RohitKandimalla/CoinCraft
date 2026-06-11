import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { getUnreadCount } from '@/lib/news';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await getDatabase();
    const unreadCount = await getUnreadCount(db);
    return NextResponse.json({ unreadCount });
  } catch (error) {
    console.error('Error fetching unread news count:', error);
    return NextResponse.json({ error: 'Failed to fetch unread count' }, { status: 500 });
  }
}


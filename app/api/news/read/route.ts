import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { markArticleRead } from '@/lib/news';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as { url?: string } | null;
    const url = body?.url?.trim();

    if (!url) {
      return NextResponse.json({ error: 'Article URL is required' }, { status: 400 });
    }

    const db = await getDatabase();
    const unreadCount = await markArticleRead(db, url);

    return NextResponse.json({ unreadCount });
  } catch (error) {
    console.error('Error marking article as read:', error);
    return NextResponse.json({ error: 'Failed to mark article as read' }, { status: 500 });
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { getStoredArticles, refreshNewsFromYahoo } from '@/lib/news';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const refresh = request.nextUrl.searchParams.get('refresh') !== '0';

    if (refresh) {
      const result = await refreshNewsFromYahoo(db);
      return NextResponse.json({
        articles: result.articles,
        unreadCount: result.unreadCount,
        newCount: result.newCount,
      });
    }

    const articles = await getStoredArticles(db);
    const unreadRow = await db.get<{ count: number }>(
      'SELECT COUNT(*) AS count FROM equity_news_articles WHERE is_read = 0'
    );

    return NextResponse.json({
      articles,
      unreadCount: unreadRow?.count || 0,
      newCount: 0,
    });
  } catch (error) {
    console.error('Error loading equity news:', error);
    return NextResponse.json({ error: 'Failed to load equity news' }, { status: 500 });
  }
}


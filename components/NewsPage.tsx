'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, ExternalLink, RefreshCw } from 'lucide-react';
import { EquityNewsArticle } from '@/types';

interface NewsApiResponse {
  articles: EquityNewsArticle[];
  unreadCount: number;
  newCount: number;
}

function formatPublishedDate(value?: string | null): string {
  if (!value) return 'Recently added';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently added';

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function NewsPage() {
  const [articles, setArticles] = useState<EquityNewsArticle[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestNewCount, setLatestNewCount] = useState(0);

  const loadNews = useCallback(async (refresh: boolean) => {
    try {
      setError(null);
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await fetch(`/api/news?refresh=${refresh ? '1' : '0'}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch news feed');
      }

      const data = (await response.json()) as NewsApiResponse;
      setArticles(data.articles || []);
      setUnreadCount(data.unreadCount || 0);
      setLatestNewCount(data.newCount || 0);

      if ((data.newCount || 0) > 0 && typeof window !== 'undefined') {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('CoinCraft News', {
            body: `${data.newCount} new article${data.newCount > 1 ? 's' : ''} available for your holdings.`,
          });
        }
      }
    } catch (loadError) {
      console.error('Error loading news:', loadError);
      setError('Unable to load news right now. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadNews(true);
  }, [loadNews]);

  const unreadLabel = useMemo(() => {
    if (unreadCount === 0) return 'All caught up';
    if (unreadCount === 1) return '1 unread article';
    return `${unreadCount} unread articles`;
  }, [unreadCount]);

  const enableNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'default') return;
    await Notification.requestPermission();
  };

  const handleArticleClick = async (url: string, isRead: boolean) => {
    if (isRead) return;

    setArticles((prev) => prev.map((item) => (item.url === url ? { ...item, isRead: true } : item)));
    setUnreadCount((prev) => Math.max(prev - 1, 0));

    try {
      await fetch('/api/news/read', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
    } catch (markReadError) {
      console.error('Error marking article as read:', markReadError);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Equity News</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Daily headlines from Yahoo Finance filtered to the stocks you currently own.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={enableNotifications}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Enable Browser Alerts
          </button>
          <button
            onClick={() => loadNews(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh News'}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200">
          <Bell size={16} />
          {unreadLabel}
        </div>
        {latestNewCount > 0 && (
          <p className="mt-2 text-sm text-primary-700 dark:text-primary-400">
            {latestNewCount} new article{latestNewCount > 1 ? 's were' : ' was'} added in the latest refresh.
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            Loading your personalized news feed...
          </div>
        ) : articles.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            No articles yet. Refresh after your next portfolio sync.
          </div>
        ) : (
          articles.map((article) => (
            <article
              key={article.url}
              className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => handleArticleClick(article.url, article.isRead)}
                    className="text-base font-semibold text-gray-900 hover:text-primary-700 dark:text-white dark:hover:text-primary-400"
                  >
                    {article.title}
                  </a>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>{article.publisher || 'Yahoo Finance'}</span>
                    <span>•</span>
                    <span>{formatPublishedDate(article.publishedAt || article.discoveredAt)}</span>
                  </div>
                  {article.tickers.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {article.tickers.map((ticker) => (
                        <span
                          key={`${article.url}-${ticker}`}
                          className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        >
                          {ticker}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!article.isRead && <span className="h-2 w-2 rounded-full bg-primary-600" />}
                  <ExternalLink size={16} className="text-gray-400" />
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}


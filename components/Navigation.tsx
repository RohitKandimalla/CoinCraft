'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from './ThemeProvider';
import { Moon, Sun } from 'lucide-react';
import Link from 'next/link';

export function Navigation() {
  const { isDark, toggleTheme } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);
  const previousUnreadCount = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const loadUnreadCount = async () => {
      try {
        const response = await fetch('/api/news/unread', { cache: 'no-store' });
        if (!response.ok) return;
        const data = (await response.json()) as { unreadCount?: number };
        if (!cancelled) {
          const nextCount = data.unreadCount || 0;

          if (
            nextCount > previousUnreadCount.current &&
            typeof window !== 'undefined' &&
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            new Notification('CoinCraft News', {
              body: `You have ${nextCount} unread article${nextCount > 1 ? 's' : ''}.`,
            });
          }

          previousUnreadCount.current = nextCount;
          setUnreadCount(nextCount);
        }
      } catch (error) {
        console.error('Unable to fetch unread news count:', error);
      }
    };

    void loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 60000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <nav className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">CoinCraft</h1>
            <div className="hidden md:flex space-x-4">
              <Link
                href="/dashboard/overall"
                className="text-gray-700 hover:text-primary-600 dark:text-gray-300 dark:hover:text-primary-400"
              >
                Dashboard
              </Link>
              <Link
                href="/settings"
                className="text-gray-700 hover:text-primary-600 dark:text-gray-300 dark:hover:text-primary-400"
              >
                Settings
              </Link>
              <Link
                href="/news"
                className="inline-flex items-center gap-2 text-gray-700 hover:text-primary-600 dark:text-gray-300 dark:hover:text-primary-400"
              >
                News
                {unreadCount > 0 && (
                  <span className="rounded-full bg-primary-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                    {unreadCount}
                  </span>
                )}
              </Link>
              <Link
                href="/research"
                className="text-gray-700 hover:text-primary-600 dark:text-gray-300 dark:hover:text-primary-400"
              >
                Research
              </Link>
            </div>
          </div>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            aria-label="Toggle theme"
          >
            {isDark ? (
              <Sun size={20} className="text-yellow-500" />
            ) : (
              <Moon size={20} className="text-gray-700" />
            )}
          </button>
        </div>
      </div>
    </nav>
  );
}

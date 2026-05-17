'use client';

import { useEffect, useState } from 'react';

interface CalendarYearReturn {
  year: number;
  startValue: number;
  endValue: number;
  netCashflow: number;
  weightedCashflow: number;
  returnPct: number;
  method: 'modified_dietz';
}

interface CalendarYOYTableProps {
  viewKey: string;
}

export function CalendarYOYTable({ viewKey }: CalendarYOYTableProps) {
  const [rows, setRows] = useState<CalendarYearReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchYOY() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/metrics/yoy?viewKey=${encodeURIComponent(viewKey)}`);
        const body = (await response.json()) as {
          years?: CalendarYearReturn[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(body.error || 'Failed to load calendar YOY');
        }

        if (!cancelled) {
          setRows(body.years || []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error fetching calendar YOY:', err);
          setError('Calendar YOY is not available yet for this account.');
          setRows([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchYOY();
    return () => {
      cancelled = true;
    };
  }, [viewKey]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Calendar Year Returns</h3>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Modified Dietz method with external cashflow adjustment (account-level only).
      </p>

      {loading ? (
        <div className="mt-4 h-24 animate-pulse rounded-md bg-gray-100 dark:bg-gray-800" />
      ) : error ? (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{error}</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Not enough data yet. Keep syncing through the year to compute annual returns.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 dark:border-gray-800">
              <tr className="text-left text-gray-500 dark:text-gray-400">
                <th className="px-2 py-2">Year</th>
                <th className="px-2 py-2 text-right">Start Value</th>
                <th className="px-2 py-2 text-right">End Value</th>
                <th className="px-2 py-2 text-right">Net Flows</th>
                <th className="px-2 py-2 text-right">Return</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const positive = row.returnPct >= 0;
                return (
                  <tr key={row.year} className="border-b border-gray-100 dark:border-gray-800/70">
                    <td className="px-2 py-2 font-medium text-gray-900 dark:text-white">{row.year}</td>
                    <td className="px-2 py-2 text-right text-gray-700 dark:text-gray-300">
                      ${row.startValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-2 text-right text-gray-700 dark:text-gray-300">
                      ${row.endValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-2 text-right text-gray-700 dark:text-gray-300">
                      {row.netCashflow >= 0 ? '+' : '-'}$
                      {Math.abs(row.netCashflow).toLocaleString('en-US', {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td
                      className={`px-2 py-2 text-right font-semibold ${
                        positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {positive ? '+' : '-'}
                      {Math.abs(row.returnPct).toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


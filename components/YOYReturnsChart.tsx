'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { TrendingUp, TrendingDown, RefreshCw, AlertCircle } from 'lucide-react';

interface YOYResult {
  year: number;
  returnPct: number;
  startValue: number | null;
  endValue: number | null;
  note: string;
}

interface YOYResponse {
  returns: YOYResult[];
  transactionCount: number;
}

export function YOYReturnsChart() {
  const [data, setData] = useState<YOYResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [transactionCount, setTransactionCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastCalculated, setLastCalculated] = useState<string | null>(null);

  const loadFromDB = useCallback(async () => {
    try {
      const resp = await fetch('/api/metrics/yoy/cached');
      if (resp.ok) {
        const cached: YOYResult[] = await resp.json();
        if (cached.length > 0) {
          setData(cached);
          return true;
        }
      }
    } catch {}
    return false;
  }, []);

  useEffect(() => {
    loadFromDB();
  }, [loadFromDB]);

  const calculate = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/metrics/yoy');
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.detail || body.error || 'Failed to calculate returns');
      }
      const result: YOYResponse = await resp.json();
      const validResults = result.returns.filter((r) => r.note !== 'insufficient_data');
      setData(validResults);
      setTransactionCount(result.transactionCount);
      setLastCalculated(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Year-over-Year Returns
          </h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Modified Dietz method accounting for deposits &amp; withdrawals.
            {data.length === 0 && ' Click Calculate to fetch your transaction history.'}
          </p>
          {lastCalculated && (
            <p className="mt-1 text-xs text-gray-400">Calculated at {lastCalculated}</p>
          )}
        </div>
        <button
          onClick={calculate}
          disabled={loading}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Calculating…' : data.length > 0 ? 'Recalculate' : 'Calculate'}
        </button>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {loading && (
        <div className="mt-8 flex flex-col items-center justify-center gap-2 py-8 text-gray-500 dark:text-gray-400">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
          <p className="text-sm">
            Fetching {transactionCount > 0 ? transactionCount : 'all'} transactions…
          </p>
        </div>
      )}

      {!loading && data.length > 0 && (
        <>
          {/* Summary row */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {data.map((row) => {
              const pos = row.returnPct >= 0;
              return (
                <div
                  key={row.year}
                  className={`rounded-lg border p-3 ${
                    pos
                      ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                      : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                  }`}
                >
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {row.year}
                    {row.note === 'ytd' ? ' (YTD)' : ''}
                  </p>
                  <div
                    className={`mt-1 flex items-center gap-1 text-xl font-bold ${pos ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}
                  >
                    {pos ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    {fmtPct(row.returnPct)}
                  </div>
                  {row.startValue != null && row.endValue != null && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {fmt(row.startValue)} → {fmt(row.endValue)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bar chart */}
          <div className="mt-6">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  tickFormatter={(y) => String(y)}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  tickFormatter={(v) => `${v.toFixed(0)}%`}
                />
                <Tooltip
                  formatter={(value: number) => [`${fmtPct(value)}`, 'Return']}
                  labelFormatter={(label) => `Year: ${label}`}
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#f9fafb',
                  }}
                />
                <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
                <Bar dataKey="returnPct" radius={[4, 4, 0, 0]}>
                  {data.map((entry) => (
                    <Cell
                      key={`cell-${entry.year}`}
                      fill={entry.returnPct >= 0 ? '#10b981' : '#ef4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {transactionCount > 0 && (
            <p className="mt-3 text-right text-xs text-gray-400">
              Based on {transactionCount.toLocaleString()} transactions
            </p>
          )}
        </>
      )}

      {!loading && data.length === 0 && !error && (
        <div className="mt-8 flex flex-col items-center gap-2 py-8 text-gray-500 dark:text-gray-400">
          <TrendingUp size={32} className="opacity-30" />
          <p className="text-sm">No return data yet.</p>
          <p className="text-xs">Click "Calculate" to analyse your full transaction history.</p>
        </div>
      )}
    </div>
  );
}

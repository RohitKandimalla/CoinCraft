'use client';

import { PortfolioData } from '@/types';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface TopGainersLosersChartProps {
  portfolio: PortfolioData | null;
}

export function TopGainersLosersChart({ portfolio }: TopGainersLosersChartProps) {
  if (!portfolio || portfolio.holdings.length === 0) {
    return null;
  }

  const gainers = [...portfolio.holdings]
    .filter((holding) => (holding.unrealized_gain_pct || 0) > 0)
    .sort((a, b) => (b.unrealized_gain_pct || 0) - (a.unrealized_gain_pct || 0))
    .slice(0, 5)
    .map((holding) => ({
      ticker: holding.ticker,
      gainPct: Number((holding.unrealized_gain_pct || 0).toFixed(2)),
      gainValue: holding.unrealized_gain || 0,
    }))
    .reverse();

  const losers = [...portfolio.holdings]
    .filter((holding) => (holding.unrealized_gain_pct || 0) < 0)
    .sort((a, b) => (a.unrealized_gain_pct || 0) - (b.unrealized_gain_pct || 0))
    .slice(0, 5)
    .map((holding) => ({
      ticker: holding.ticker,
      gainPct: Number((holding.unrealized_gain_pct || 0).toFixed(2)),
      gainValue: holding.unrealized_gain || 0,
    }));

  if (gainers.length === 0 && losers.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top Gainers & Losers</h3>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Best and worst performers by unrealized gain percentage.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-green-700 dark:text-green-400">Top Gainers</h4>
          {gainers.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={gainers} layout="vertical" margin={{ left: 12, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(value) => `${value}%`} />
                <YAxis dataKey="ticker" type="category" width={56} />
                <Tooltip
                  formatter={(value: number, _, payload) => [
                    `${Number(value).toFixed(2)}% ($${Number(payload?.payload?.gainValue || 0).toLocaleString('en-US', {
                      maximumFractionDigits: 2,
                    })})`,
                    'Gain',
                  ]}
                />
                <Bar dataKey="gainPct" fill="#16a34a" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No positive performers in this account.</p>
          )}
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold text-red-700 dark:text-red-400">Top Losers</h4>
          {losers.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={losers} layout="vertical" margin={{ left: 12, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(value) => `${value}%`} />
                <YAxis dataKey="ticker" type="category" width={56} />
                <Tooltip
                  formatter={(value: number, _, payload) => [
                    `${Number(value).toFixed(2)}% ($${Number(payload?.payload?.gainValue || 0).toLocaleString('en-US', {
                      maximumFractionDigits: 2,
                    })})`,
                    'Loss',
                  ]}
                />
                <Bar dataKey="gainPct" fill="#dc2626" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No negative performers in this account.</p>
          )}
        </div>
      </div>
    </div>
  );
}


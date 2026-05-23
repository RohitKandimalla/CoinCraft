'use client';

import { PortfolioData } from '@/types';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

interface SectorAssetBreakdownChartProps {
  portfolio: PortfolioData | null;
}

const COLORS = ['#0ea5e9', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#6366f1'];

function toTitleCase(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeBroadEquityBucket(holding: PortfolioData['holdings'][number]) {
  const sector = String(holding.sector || '').trim();
  const industry = String(holding.industry || '').trim();

  // Broad bucket comes directly from provider sector metadata (Yahoo asset profile).
  if (sector) {
    return sector;
  }

  // If sector is unavailable, fall back to provider industry metadata.
  if (industry) return industry;

  return 'Other Equity';
}

function getConcentrationBucket(holding: PortfolioData['holdings'][number]) {
  if (holding.asset_type === 'equity') {
    return normalizeBroadEquityBucket(holding);
  }

  if (holding.asset_type === 'crypto') return 'Crypto';
  if (holding.asset_type === 'option') return 'Options';
  return holding.asset_type ? toTitleCase(holding.asset_type) : 'Unclassified';
}

export function SectorAssetBreakdownChart({ portfolio }: SectorAssetBreakdownChartProps) {
  if (!portfolio || portfolio.holdings.length === 0) {
    return null;
  }

  const grouped = new Map<string, { value: number; tickers: Set<string> }>();

  for (const holding of portfolio.holdings) {
    const key = getConcentrationBucket(holding);
    const current = grouped.get(key) || { value: 0, tickers: new Set<string>() };
    current.value += holding.market_value || 0;
    current.tickers.add(holding.ticker);
    grouped.set(key, current);
  }

  const data = Array.from(grouped.entries())
    .map(([name, entry]) => ({
      name,
      value: entry.value,
      tickers: Array.from(entry.tickers).sort(),
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Broad Concentration</h3>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Equities are grouped from third-party sector metadata at sync time (industry fallback), and non-equities are grouped by category.
      </p>

      <ResponsiveContainer width="100%" height={320} className="mt-4">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110}>
            {data.map((_, index) => (
              <Cell key={`asset-breakdown-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) =>
              `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
            }
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {data.map((item, index) => {
          const pct = portfolio.equityValue > 0 ? (item.value / portfolio.equityValue) * 100 : 0;
          return (
            <div
              key={item.name}
              className="rounded-md border border-gray-100 bg-gray-50/70 p-2 text-sm dark:border-gray-800 dark:bg-gray-900/60"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  {item.name}
                </span>
                <span className="font-medium text-gray-900 dark:text-white">{pct.toFixed(1)}%</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                {item.tickers.join(', ')}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}


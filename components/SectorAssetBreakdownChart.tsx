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

export function SectorAssetBreakdownChart({ portfolio }: SectorAssetBreakdownChartProps) {
  if (!portfolio || portfolio.holdings.length === 0) {
    return null;
  }

  const grouped = new Map<string, number>();

  for (const holding of portfolio.holdings) {
    const key =
      (holding.sector && holding.sector.trim()) ||
      (holding.asset_type ? toTitleCase(holding.asset_type) : 'Unclassified');

    grouped.set(key, (grouped.get(key) || 0) + (holding.market_value || 0));
  }

  const data = Array.from(grouped.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Sector / Asset Type Breakdown</h3>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Grouped by sector when available, otherwise by asset type.
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

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {data.map((item, index) => {
          const pct = portfolio.equityValue > 0 ? (item.value / portfolio.equityValue) * 100 : 0;
          return (
            <div key={item.name} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                {item.name}
              </span>
              <span className="font-medium text-gray-900 dark:text-white">{pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}


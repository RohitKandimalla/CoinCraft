'use client';

import { PortfolioData } from '@/types';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';

interface AllocationChartProps {
  portfolio: PortfolioData | null;
  onTickerClick?: (ticker: string) => void;
}

export function AllocationChart({ portfolio, onTickerClick }: AllocationChartProps) {
  if (!portfolio || portfolio.holdings.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Portfolio Allocation
        </h3>
        <p className="mt-4 text-center text-gray-500 dark:text-gray-400">No holdings to display</p>
      </div>
    );
  }

  // Prepare data for chart
  const chartData = portfolio.holdings.map((holding) => ({
    name: holding.ticker,
    value: holding.market_value,
    percentage: ((holding.market_value / portfolio.equityValue) * 100).toFixed(1),
  }));

  // Color palette for chart
  const COLORS = [
    '#0ea5e9',
    '#06b6d4',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#ec4899',
    '#6366f1',
    '#14b8a6',
    '#f97316',
  ];

  const handlePieClick = (data: any) => {
    if (onTickerClick) {
      onTickerClick(data.name);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Portfolio Allocation</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Click on a segment to navigate to the holding</p>

      <ResponsiveContainer width="100%" height={300} className="mt-4">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percentage }) => `${name}: ${percentage}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
            onClick={(e) => handlePieClick(e.payload)}
            style={{ cursor: 'pointer' }}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) =>
              `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
            }
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

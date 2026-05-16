'use client';

import { PortfolioData, Holding } from '@/types';
import { useState } from 'react';
import { TrendingUp, TrendingDown, Edit2 } from 'lucide-react';

interface HoldingsTableProps {
  portfolio: PortfolioData | null;
  onEditNote: (ticker: string) => void;
  highlightedTicker?: string | null;
}

export function HoldingsTable({ portfolio, onEditNote, highlightedTicker }: HoldingsTableProps) {
  const [sortKey, setSortKey] = useState<keyof Holding>('market_value');
  const [sortDesc, setSortDesc] = useState(true);

  if (!portfolio) {
    return <div className="text-center text-gray-500">No holdings data</div>;
  }

  const sorted = [...portfolio.holdings].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDesc ? bVal - aVal : aVal - bVal;
    }
    return 0;
  });

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
            <tr>
              <th
                className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => {
                  setSortKey('ticker');
                  setSortDesc(sortKey === 'ticker' ? !sortDesc : false);
                }}
              >
                Ticker
              </th>
              <th
                className="px-6 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => {
                  setSortKey('quantity');
                  setSortDesc(sortKey === 'quantity' ? !sortDesc : true);
                }}
              >
                Shares
              </th>
              <th
                className="px-6 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => {
                  setSortKey('current_price');
                  setSortDesc(sortKey === 'current_price' ? !sortDesc : true);
                }}
              >
                Price
              </th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
                Avg Cost
              </th>
              <th
                className="px-6 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => {
                  setSortKey('market_value');
                  setSortDesc(sortKey === 'market_value' ? !sortDesc : true);
                }}
              >
                Value
              </th>
               <th
                 className="px-6 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                 onClick={() => {
                   setSortKey('unrealized_gain_pct');
                   setSortDesc(sortKey === 'unrealized_gain_pct' ? !sortDesc : true);
                 }}
               >
                 Gain
               </th>
               <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
                 % of Portfolio
               </th>
              <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white">
                Notes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {sorted.map((holding) => {
              const gainIsPositive = (holding.unrealized_gain_pct || 0) >= 0;
              const portfolioPercent =
                portfolio.totalValue > 0
                  ? ((holding.market_value / portfolio.totalValue) * 100).toFixed(2)
                  : '0.00';

               return (
                 <tr
                   key={holding.id}
                   id={`holding-${holding.ticker}`}
                   className={`transition-colors ${
                     highlightedTicker === holding.ticker
                       ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500'
                       : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                   }`}
                 >
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                    {holding.ticker}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-gray-600 dark:text-gray-400">
                    {holding.quantity.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-gray-600 dark:text-gray-400">
                    $
                    {holding.current_price.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-gray-500 dark:text-gray-400">
                    {holding.average_price != null
                      ? `$${holding.average_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '—'}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-gray-900 dark:text-white">
                    ${holding.market_value.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </td>
                   <td
                     className={`px-6 py-4 text-right text-sm font-medium flex items-center justify-end space-x-1 ${gainIsPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                   >
                     {gainIsPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                     <span>
                       ${holding.unrealized_gain?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0.00'} ({gainIsPositive ? '+' : '-'}
                       {Math.abs(holding.unrealized_gain_pct || 0).toFixed(2)}%)
                     </span>
                   </td>
                  <td className="px-6 py-4 text-right text-sm text-gray-600 dark:text-gray-400">
                    {portfolioPercent}%
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => onEditNote(holding.ticker)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition"
                      title="Edit notes"
                    >
                      <Edit2 size={16} className="text-gray-500 dark:text-gray-400" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

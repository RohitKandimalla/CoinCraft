'use client';

import { PortfolioData } from '@/types';

interface OptionsTableProps {
  portfolio: PortfolioData | null;
}

export function OptionsTable({ portfolio }: OptionsTableProps) {
  if (!portfolio || portfolio.options.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
      <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Options Positions</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Excluded from portfolio totals. Includes sold puts / covered calls.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                Contract
              </th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
                Qty
              </th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
                Mark
              </th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
                Avg Cost
              </th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
                Value
              </th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
                P/L
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {portfolio.options.map((option) => {
              const gain = option.unrealized_gain || 0;
              const positive = gain >= 0;
              return (
                <tr
                  key={`${option.provider_account_id}-${option.ticker}`}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                    <div>
                      <p>{option.ticker}</p>
                      {option.account_name && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {option.account_name}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-gray-600 dark:text-gray-400">
                    {option.quantity.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-gray-600 dark:text-gray-400">
                    $
                    {option.current_price.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-gray-600 dark:text-gray-400">
                    {option.average_price != null
                      ? `$${option.average_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '—'}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-gray-900 dark:text-white">
                    ${option.market_value.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </td>
                  <td
                    className={`px-6 py-4 text-right text-sm font-medium ${positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                  >
                    {positive ? '+' : '-'}$
                    {Math.abs(gain).toLocaleString('en-US', { maximumFractionDigits: 2 })}
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

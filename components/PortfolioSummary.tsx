'use client';

import { PortfolioData } from '@/types';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface PortfolioSummaryProps {
  portfolio: PortfolioData | null;
  loading: boolean;
}

export function PortfolioSummary({ portfolio, loading }: PortfolioSummaryProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="h-40 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!portfolio) {
    return <div className="text-center text-gray-500">No portfolio data</div>;
  }

  const gainIsPositive = (portfolio.totalUnrealizedGain || 0) >= 0;
  const equityPct =
    portfolio.totalValue > 0 ? (portfolio.equityValue / portfolio.totalValue) * 100 : 0;
  const cashPct = portfolio.totalValue > 0 ? (portfolio.cashValue / portfolio.totalValue) * 100 : 0;
  const contributionRangeText =
    portfolio.contributionsDataAvailable &&
    portfolio.contributionsStartDate &&
    portfolio.contributionsEndDate
      ? `${portfolio.contributionsStartDate} to ${portfolio.contributionsEndDate}`
      : 'Set manually per account';

  const hasManualContribution = portfolio.netContributions != null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
      {/* Total Value */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900 min-h-[170px] flex flex-col justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">Total Portfolio Value</p>
        <p className="mt-2 text-xl md:text-2xl xl:text-3xl font-bold text-gray-900 dark:text-white tabular-nums leading-tight">
          ${portfolio.totalValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}
        </p>
        <p className="mt-1 text-xs text-transparent select-none">.</p>
      </div>

      {/* Equity Value */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900 min-h-[170px] flex flex-col justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">Portfolio Holdings Value</p>
        <p className="mt-2 text-xl md:text-2xl xl:text-3xl font-bold text-blue-600 dark:text-blue-400 tabular-nums leading-tight">
          ${portfolio.equityValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {equityPct.toFixed(1)}% of portfolio
        </p>
      </div>

      {/* Cash */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900 min-h-[170px] flex flex-col justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">Uninvested Cash</p>
        <p className="mt-2 text-xl md:text-2xl xl:text-3xl font-bold text-green-600 dark:text-green-400 tabular-nums leading-tight">
          ${portfolio.cashValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {cashPct.toFixed(1)}% of portfolio
        </p>
      </div>

      {/* Net Capital in Current Holdings */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900 min-h-[170px] flex flex-col justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">Current Holdings Cost Basis</p>
        <p className="mt-2 text-xl md:text-2xl xl:text-3xl font-bold text-violet-600 dark:text-violet-400 tabular-nums leading-tight">
          ${portfolio.investedCapital.toLocaleString('en-US', { maximumFractionDigits: 2 })}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Non-option positions cost basis minus margin used
        </p>
      </div>

      {/* Margin Used */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900 min-h-[170px] flex flex-col justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">Margin Used</p>
        <p className="mt-2 text-xl md:text-2xl xl:text-3xl font-bold text-amber-600 dark:text-amber-400 tabular-nums leading-tight">
          ${portfolio.marginUsed.toLocaleString('en-US', { maximumFractionDigits: 2 })}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Borrowed buying power, excluded from cash
        </p>
      </div>

      {/* Net Contributions (Manual) */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900 min-h-[170px] flex flex-col justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">Net Contributions (Manual)</p>
        <p className="mt-2 text-xl md:text-2xl xl:text-3xl font-bold text-cyan-600 dark:text-cyan-400 tabular-nums leading-tight">
          {hasManualContribution
            ? `$${Number(portfolio.netContributions).toLocaleString('en-US', {
                maximumFractionDigits: 2,
              })}`
            : '—'}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{contributionRangeText}</p>
        <p className="mt-1 text-xs text-gray-400">
          Enter this value manually from Robinhood for accurate account baseline.
        </p>
      </div>

      {/* Gain */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900 min-h-[170px] flex flex-col justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {hasManualContribution ? 'Account Gain vs Contributions' : 'Unrealized Gain (Holdings)'}
        </p>
        <div className="mt-2 flex items-center space-x-2">
          <p
            className={`text-xl md:text-2xl xl:text-3xl font-bold tabular-nums leading-tight ${gainIsPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
          >
            $
            {Math.abs(portfolio.totalUnrealizedGain || 0).toLocaleString('en-US', {
              maximumFractionDigits: 2,
            })}
          </p>
          {gainIsPositive ? (
            <TrendingUp size={24} className="text-green-600 dark:text-green-400" />
          ) : (
            <TrendingDown size={24} className="text-red-600 dark:text-red-400" />
          )}
        </div>
        <p
          className={`mt-1 text-xs ${gainIsPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
        >
          {gainIsPositive ? '+' : '-'}
          {Math.abs(portfolio.totalUnrealizedGainPct || 0).toFixed(2)}%
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {hasManualContribution
            ? 'Current portfolio value minus manual net contributions'
            : 'Based on current holdings cost basis'}
        </p>
      </div>
    </div>
  );
}

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-40 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!portfolio) {
    return <div className="text-center text-gray-500">No portfolio data</div>;
  }

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
  const displayGain = hasManualContribution
    ? Number(portfolio.accountGain ?? 0)
    : Number(portfolio.totalUnrealizedGain ?? 0);
  const displayGainPct = hasManualContribution
    ? Number(portfolio.accountGainPct ?? 0)
    : Number(portfolio.totalUnrealizedGainPct ?? 0);
  const gainIsPositive = displayGain >= 0;
  const cardClass =
    'rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900 min-h-[220px] overflow-hidden';
  const titleClass = 'text-sm text-gray-600 dark:text-gray-400 leading-snug';
  const valueClass =
    'text-lg md:text-xl 2xl:text-2xl font-bold tabular-nums leading-tight break-words';
  const footerClass = 'text-xs text-gray-500 dark:text-gray-400 leading-snug';

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
      {/* Total Value */}
      <div className={cardClass}>
        <div className="h-12">
          <p className={titleClass}>Total Portfolio Value</p>
        </div>
        <div className="mt-2 h-16 flex items-end overflow-hidden">
          <p className={`${valueClass} text-gray-900 dark:text-white`}>
            ${portfolio.totalValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="mt-2 h-20 overflow-hidden">
          <p className="text-xs text-transparent select-none">.</p>
        </div>
      </div>

      {/* Equity Value */}
      <div className={cardClass}>
        <div className="h-12">
          <p className={titleClass}>Portfolio Holdings Value</p>
        </div>
        <div className="mt-2 h-16 flex items-end overflow-hidden">
          <p className={`${valueClass} text-blue-600 dark:text-blue-400`}>
            ${portfolio.equityValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="mt-2 h-20 overflow-hidden">
          <p className={footerClass}>{equityPct.toFixed(1)}% of portfolio</p>
        </div>
      </div>

      {/* Cash */}
      <div className={cardClass}>
        <div className="h-12">
          <p className={titleClass}>Uninvested Cash</p>
        </div>
        <div className="mt-2 h-16 flex items-end overflow-hidden">
          <p className={`${valueClass} text-green-600 dark:text-green-400`}>
            ${portfolio.cashValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="mt-2 h-20 overflow-hidden">
          <p className={footerClass}>{cashPct.toFixed(1)}% of portfolio</p>
        </div>
      </div>

      {/* Margin Used */}
      <div className={cardClass}>
        <div className="h-12">
          <p className={titleClass}>Margin Used</p>
        </div>
        <div className="mt-2 h-16 flex items-end overflow-hidden">
          <p className={`${valueClass} text-amber-600 dark:text-amber-400`}>
            ${portfolio.marginUsed.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="mt-2 h-20 overflow-hidden">
          <p className={footerClass}>Borrowed buying power, excluded from cash</p>
        </div>
      </div>

      {/* Net Contributions (Manual) */}
      <div className={cardClass}>
        <div className="h-12">
          <p className={titleClass}>Net Contributions (Manual)</p>
        </div>
        <div className="mt-2 h-16 flex items-end overflow-hidden">
          <p className={`${valueClass} text-cyan-600 dark:text-cyan-400`}>
            {hasManualContribution
              ? `$${Number(portfolio.netContributions).toLocaleString('en-US', {
                  maximumFractionDigits: 2,
                })}`
              : '—'}
          </p>
        </div>
        <div className="mt-2 h-20 overflow-hidden">
          <p className={footerClass}>{contributionRangeText}</p>
          <p className="text-xs text-gray-400 leading-snug">
            Enter this value manually from Robinhood for accurate account baseline.
          </p>
        </div>
      </div>

      {/* Gain */}
      <div className={cardClass}>
        <div className="h-12">
          <p className={titleClass}>
            {hasManualContribution ? 'Account Gain vs Contributions' : 'Unrealized Gain (Holdings)'}
          </p>
        </div>
        <div className="mt-2 h-16 flex items-end space-x-2 overflow-hidden">
          <p
            className={`${valueClass} ${gainIsPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
          >
            $
            {Math.abs(displayGain).toLocaleString('en-US', {
              maximumFractionDigits: 2,
            })}
          </p>
          {gainIsPositive ? (
            <TrendingUp size={24} className="text-green-600 dark:text-green-400" />
          ) : (
            <TrendingDown size={24} className="text-red-600 dark:text-red-400" />
          )}
        </div>
        <div className="mt-2 h-20 overflow-hidden">
          <p
            className={`text-xs leading-snug ${gainIsPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
          >
            {gainIsPositive ? '+' : '-'}
            {Math.abs(displayGainPct).toFixed(2)}%
          </p>
          <p className={footerClass}>
            {hasManualContribution
              ? 'Current holdings value minus manual net contributions'
              : 'Based on current holdings cost basis'}
          </p>
        </div>
      </div>
    </div>
  );
}

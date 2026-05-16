'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { AccountPortfolioView, PortfolioResponse, StockNote } from '@/types';
import { PortfolioSummary } from '@/components/PortfolioSummary';
import { AllocationChart } from '@/components/AllocationChart';
import { HoldingsTable } from '@/components/HoldingsTable';
import { SectorAssetBreakdownChart } from '@/components/SectorAssetBreakdownChart';
import { TopGainersLosersChart } from '@/components/TopGainersLosersChart';
import { NotesModal } from '@/components/NotesModal';
import { OptionsTable } from '@/components/OptionsTable';
import { RefreshCw } from 'lucide-react';

function getContributionBadge(method?: string) {
  if (method === 'manual_override') {
    return {
      label: 'Manual Set',
      className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    };
  }

  return {
    label: 'Manual Required',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  };
}

export default function Dashboard() {
  const [portfolioResponse, setPortfolioResponse] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [selectedViewKey, setSelectedViewKey] = useState<string>('overall');
  const [manualBaselineInput, setManualBaselineInput] = useState('');
  const [savingBaseline, setSavingBaseline] = useState(false);
  const [baselineMessage, setBaselineMessage] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Fetch portfolio on mount
  useEffect(() => {
    fetchPortfolio();
  }, []);

  const fetchPortfolio = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/providers/plaid/portfolio');
      if (response.ok) {
        const data: PortfolioResponse = await response.json();
        setPortfolioResponse(data);
        setLastSync(new Date().toLocaleTimeString());
      }
    } catch (error) {
      console.error('Error fetching portfolio:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const response = await fetch('/api/sync', { method: 'POST' });
      if (response.ok) {
        await fetchPortfolio();
      }
    } catch (error) {
      console.error('Error syncing portfolio:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveNote = async (note: Partial<StockNote>) => {
    try {
      const response = await fetch(`/api/notes/${note.ticker}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(note),
      });

      if (response.ok) {
        alert('Note saved successfully!');
      }
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Failed to save note');
    }
  };

  const handleChartClick = (ticker: string) => {
    setSelectedTicker(ticker);
    // Scroll to the row after a brief delay to allow rendering
    setTimeout(() => {
      const element = document.getElementById(`holding-${ticker}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 0);
  };

  const accountViews = useMemo<AccountPortfolioView[]>(() => {
    if (!portfolioResponse) return [];
    const hasOverall = portfolioResponse.accountViews.some((view) => view.key === 'overall');
    if (hasOverall) return portfolioResponse.accountViews;
    return [
      {
        key: 'overall',
        label: 'Overall',
        accountIds: [],
        portfolio: portfolioResponse.overall,
      },
      ...portfolioResponse.accountViews,
    ];
  }, [portfolioResponse]);

  const selectedView = useMemo(() => {
    if (!portfolioResponse) return null;
    return (
      accountViews.find((view) => view.key === selectedViewKey) ||
      accountViews[0] || {
        key: 'overall',
        label: 'Overall',
        accountIds: [],
        portfolio: portfolioResponse.overall,
      }
    );
  }, [portfolioResponse, accountViews, selectedViewKey]);

  const isOverallView = selectedView?.key === 'overall';

  useEffect(() => {
    if (accountViews.length === 0) return;
    const exists = accountViews.some((view) => view.key === selectedViewKey);
    if (!exists) {
      setSelectedViewKey(accountViews[0].key);
    }
  }, [accountViews, selectedViewKey]);

  useEffect(() => {
    if (!selectedView?.portfolio) return;

    const current =
      selectedView.portfolio.contributionOverride ?? selectedView.portfolio.netContributions ?? 0;
    setManualBaselineInput(current.toFixed(2));
    setBaselineMessage(null);
  }, [
    selectedView?.key,
    selectedView?.portfolio?.contributionOverride,
    selectedView?.portfolio?.netContributions,
  ]);

  const handleSaveBaselineOverride = async () => {
    if (!selectedView) return;
    if (selectedView.key === 'overall') {
      setBaselineMessage('Overall baseline is calculated from account baselines.');
      return;
    }

    const value = Number(manualBaselineInput.replace(/,/g, '').trim());
    if (!Number.isFinite(value) || value < 0) {
      setBaselineMessage('Enter a valid non-negative number.');
      return;
    }

    try {
      setSavingBaseline(true);
      setBaselineMessage(null);

      const response = await fetch(
        `/api/overrides/${encodeURIComponent(String(selectedView.key))}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value }),
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to save baseline');
      }

      await fetchPortfolio();
      setBaselineMessage('Baseline saved and metrics updated.');
    } catch (error) {
      console.error('Error saving contribution override:', error);
      setBaselineMessage('Failed to save baseline override.');
    } finally {
      setSavingBaseline(false);
    }
  };

  const handleResetBaselineOverride = async () => {
    if (!selectedView) return;
    if (selectedView.key === 'overall') {
      setBaselineMessage('Reset account-level baselines to change overall baseline.');
      return;
    }

    try {
      setSavingBaseline(true);
      setBaselineMessage(null);

      const response = await fetch(
        `/api/overrides/${encodeURIComponent(String(selectedView.key))}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to reset baseline');
      }

      await fetchPortfolio();
      setBaselineMessage('Baseline reset to automatic calculation.');
    } catch (error) {
      console.error('Error resetting contribution override:', error);
      setBaselineMessage('Failed to reset baseline override.');
    } finally {
      setSavingBaseline(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          {selectedView && (
            <div className="mt-1 flex items-center gap-2">
              <p className="text-sm font-medium text-primary-700 dark:text-primary-400">
                Viewing: {selectedView.label}
              </p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  getContributionBadge(selectedView.portfolio.contributionsMethod).className
                }`}
              >
                {getContributionBadge(selectedView.portfolio.contributionsMethod).label}
              </span>
            </div>
          )}
          {lastSync && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Last refreshed: {lastSync}
            </p>
          )}
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-3 font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition"
        >
          <RefreshCw size={20} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing...' : 'Refresh'}
        </button>
      </div>

      {/* Account Tabs */}
      <div className="overflow-x-auto">
        <div className="inline-flex min-w-full gap-2 rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-900">
          {accountViews.map((view) => {
            const active = view.key === selectedViewKey;
            return (
              <button
                key={view.key}
                onClick={() => setSelectedViewKey(view.key)}
                className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  {view.label}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      active
                        ? 'bg-white/20 text-white'
                        : getContributionBadge(view.portfolio.contributionsMethod).className
                    }`}
                  >
                    {getContributionBadge(view.portfolio.contributionsMethod).label}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Portfolio Summary Cards */}
      <PortfolioSummary portfolio={selectedView?.portfolio || null} loading={loading} />

      {/* Manual baseline override */}
      {selectedView && (
        <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Manual Baseline Override
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {isOverallView ? (
              <>
                Overall baseline is automatically calculated as the sum of account-level baselines.
                Update <span className="font-medium">Individual / Roth IRA / Joint / Crypto</span>{' '}
                baselines to change Overall.
              </>
            ) : (
              <>
                Paste your Robinhood "initial amount" for{' '}
                <span className="font-medium">{selectedView.label}</span>. CoinCraft will use it as
                net contributions and recalculate gain %.
              </>
            )}
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex w-full items-center rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700">
              <span className="mr-2 text-gray-500 dark:text-gray-400">$</span>
              <input
                type="text"
                value={manualBaselineInput}
                onChange={(e) => setManualBaselineInput(e.target.value)}
                className="w-full bg-transparent text-sm text-gray-900 outline-none dark:text-white"
                placeholder="e.g. 72444"
                disabled={isOverallView}
              />
            </div>

            <button
              onClick={handleSaveBaselineOverride}
              disabled={savingBaseline || isOverallView}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {savingBaseline ? 'Saving...' : 'Save Baseline'}
            </button>

            <button
              onClick={handleResetBaselineOverride}
              disabled={savingBaseline || isOverallView}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Reset to Auto
            </button>
          </div>

          {baselineMessage && (
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{baselineMessage}</p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            Current contribution method: {selectedView.portfolio.contributionsMethod || 'unknown'}
          </p>
        </div>
      )}

       {/* Charts Grid */}
       <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
         <div className="lg:col-span-2">
           <AllocationChart portfolio={selectedView?.portfolio || null} onTickerClick={handleChartClick} />
         </div>

        <div className="space-y-4">
          {/* Cash Box */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Uninvested Cash</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Cash sitting in each account and not deployed into positions.
            </p>
            <div className="mt-4 space-y-3">
              {selectedView?.portfolio.cash && selectedView.portfolio.cash.length > 0 ? (
                selectedView.portfolio.cash
                  .filter((account) => (account.uninvested_cash || 0) > 0)
                  .map((account) => (
                    <div key={account.id} className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {account.account_name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                          {account.account_category?.replace('_', ' ') || account.account_type}
                        </p>
                      </div>
                      <span className="font-semibold text-green-600 dark:text-green-400">
                        $
                        {(account.uninvested_cash || 0).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No uninvested cash</p>
              )}
            </div>
          </div>

          {/* Margin Used */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Margin Used</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Borrowed buying power. Shown for awareness, excluded from cash.
            </p>
            <div className="mt-4 space-y-3">
              {selectedView?.portfolio.cash &&
              selectedView.portfolio.cash.some((account) => (account.margin_used || 0) > 0) ? (
                selectedView.portfolio.cash
                  .filter((account) => (account.margin_used || 0) > 0)
                  .map((account) => (
                    <div key={`margin-${account.id}`} className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {account.account_name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                          {account.account_category?.replace('_', ' ') || account.account_type}
                        </p>
                      </div>
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        $
                        {(account.margin_used || 0).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No margin currently used</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {!isOverallView && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <SectorAssetBreakdownChart portfolio={selectedView?.portfolio || null} />
          <TopGainersLosersChart portfolio={selectedView?.portfolio || null} />
        </div>
      )}

        {/* Holdings Table */}
       <div ref={tableRef}>
         <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
           Holdings
           <span className="rounded-full bg-gray-100 px-2 py-0.5 text-sm font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
             {selectedView?.portfolio.holdings.length || 0}
           </span>
         </h2>
         <HoldingsTable
           portfolio={selectedView?.portfolio || null}
           onEditNote={(ticker) => {
             setSelectedTicker(ticker);
             setNotesModalOpen(true);
           }}
           highlightedTicker={selectedTicker}
         />
       </div>

      {/* Options positions */}
      {selectedView?.portfolio.options && selectedView.portfolio.options.length > 0 && (
        <div>
          <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">Options</h2>
          <OptionsTable portfolio={selectedView?.portfolio || null} />
        </div>
      )}

      {/* Notes Modal */}
      <NotesModal
        ticker={selectedTicker || ''}
        isOpen={notesModalOpen}
        onClose={() => setNotesModalOpen(false)}
        onSave={handleSaveNote}
      />
    </div>
  );
}

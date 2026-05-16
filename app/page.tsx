'use client';

import { useEffect, useMemo, useState } from 'react';
import { AccountPortfolioView, PortfolioResponse, StockNote } from '@/types';
import { PortfolioSummary } from '@/components/PortfolioSummary';
import { AllocationChart } from '@/components/AllocationChart';
import { HoldingsTable } from '@/components/HoldingsTable';
import { NotesModal } from '@/components/NotesModal';
import { OptionsTable } from '@/components/OptionsTable';
import { YOYReturnsChart } from '@/components/YOYReturnsChart';
import { RefreshCw } from 'lucide-react';

export default function Dashboard() {
  const [portfolioResponse, setPortfolioResponse] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [selectedViewKey, setSelectedViewKey] = useState<string>('overall');

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

  useEffect(() => {
    if (accountViews.length === 0) return;
    const exists = accountViews.some((view) => view.key === selectedViewKey);
    if (!exists) {
      setSelectedViewKey(accountViews[0].key);
    }
  }, [accountViews, selectedViewKey]);

  return (
    <div className="space-y-8">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          {selectedView && (
            <p className="mt-1 text-sm font-medium text-primary-700 dark:text-primary-400">
              Viewing: {selectedView.label}
            </p>
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
                {view.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Portfolio Summary Cards */}
      <PortfolioSummary portfolio={selectedView?.portfolio || null} loading={loading} />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AllocationChart portfolio={selectedView?.portfolio || null} />
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

      {/* Performance */}
      {selectedViewKey === 'overall' && (
        <div>
          <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">Performance</h2>
          <YOYReturnsChart />
        </div>
      )}

      {/* Holdings Table */}
      <div>
        <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">Holdings</h2>
        <HoldingsTable
          portfolio={selectedView?.portfolio || null}
          onEditNote={(ticker) => {
            setSelectedTicker(ticker);
            setNotesModalOpen(true);
          }}
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

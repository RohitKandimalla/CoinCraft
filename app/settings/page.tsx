'use client';

import { useState, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';

interface PlaidStatusResponse {
  connected: boolean;
  provider?: string;
  environment?: string;
  credentialsConfigured?: boolean;
}

export default function SettingsPage() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [plaidStatus, setPlaidStatus] = useState<PlaidStatusResponse | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkConnection();
  }, []);

  useEffect(() => {
    if (!connected) {
      void createLinkToken();
    }
  }, [connected]);

  const checkConnection = async () => {
    try {
      const response = await fetch('/api/providers/plaid/status');
      const data: PlaidStatusResponse = await response.json();
      setConnected(data.connected);
      setPlaidStatus(data);
    } catch (error) {
      console.error('Error checking connection:', error);
    } finally {
      setLoading(false);
    }
  };

  const createLinkToken = async () => {
    setError(null);
    try {
      const response = await fetch('/api/providers/plaid/link-token', {
        method: 'POST',
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Unable to create Plaid Link token');
      }

      const data = await response.json();
      setLinkToken(data.link_token);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to initialize Plaid Link';
      setError(msg);
    }
  };

  const handleDisconnect = async () => {
    if (confirm('Are you sure you want to disconnect Robinhood?')) {
      try {
        await fetch('/api/providers/plaid/disconnect', { method: 'POST' });
        setConnected(false);
        alert('Disconnected successfully');
      } catch (error) {
        console.error('Error disconnecting:', error);
        alert('Failed to disconnect');
      }
    }
  };

  const handlePlaidSuccess = async (publicToken: string) => {
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const exchangeResponse = await fetch('/api/providers/plaid/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_token: publicToken }),
      });

      if (!exchangeResponse.ok) {
        const body = await exchangeResponse.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to connect Robinhood via Plaid');
      }

      const syncResponse = await fetch('/api/sync', { method: 'POST' });
      if (!syncResponse.ok) {
        const body = await syncResponse.json().catch(() => ({}));
        throw new Error(body.error || 'Connected, but failed to sync holdings');
      }

      await checkConnection();
      setMessage('Robinhood connected successfully. Portfolio data synced.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect Robinhood';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (public_token) => {
      void handlePlaidSuccess(public_token);
    },
    onExit: (err) => {
      if (err) {
        setError(err.display_message || err.error_message || 'Plaid Link exited with an error');
      }
    },
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Settings</h1>

      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Robinhood Connection
        </h2>

        <div className="mt-4">
          {connected ? (
            <div className="flex items-center justify-between rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">
                  ✓ Connected to Robinhood
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Your portfolio is syncing regularly
                </p>
              </div>
              <button
                onClick={handleDisconnect}
                className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Connect your Robinhood account using Plaid to start pulling actual holdings.
              </p>

              <button
                onClick={() => open()}
                disabled={!ready || !linkToken || busy || !plaidStatus?.credentialsConfigured}
                className="rounded-lg bg-primary-600 px-4 py-2 font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? 'Connecting...' : 'Connect Robinhood'}
              </button>

              {!plaidStatus?.credentialsConfigured && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  Plaid credentials are missing. Add `PLAID_CLIENT_ID` and `PLAID_SECRET` in
                  `.env.local`.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-6">
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p>
              Plaid credentials: {plaidStatus?.credentialsConfigured ? 'Configured' : 'Missing'}
            </p>
            <p>
              Plaid environment:{' '}
              <span className="font-medium">{plaidStatus?.environment || 'sandbox'}</span>
            </p>
          </div>

          {message && (
            <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300">
              {message}
            </p>
          )}

          {error && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Database Status</h2>
        <div className="mt-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Your data is stored locally on your machine in SQLite database at{' '}
            <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
              data/coincraft.db
            </code>
          </p>
        </div>
      </div>
    </div>
  );
}

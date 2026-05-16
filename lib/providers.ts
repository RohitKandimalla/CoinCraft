import { PortfolioData, Holding, Account } from '@/types';

export interface PortfolioProvider {
  name: string;
  isConnected(): Promise<boolean>;
  connect(publicToken: string): Promise<void>;
  disconnect(): Promise<void>;
  fetchPortfolio(): Promise<PortfolioData>;
}

// Plaid provider implementation
export class PlaidProvider implements PortfolioProvider {
  name = 'Plaid';
  private accessToken: string | null = null;
  private itemId: string | null = null;
  private accountIds: string[] = [];

  async isConnected(): Promise<boolean> {
    try {
      const response = await fetch('/api/providers/plaid/status');
      const data = await response.json();
      return data.connected;
    } catch {
      return false;
    }
  }

  async connect(publicToken: string): Promise<void> {
    const response = await fetch('/api/providers/plaid/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_token: publicToken }),
    });

    if (!response.ok) {
      throw new Error('Failed to connect Plaid');
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.itemId = data.item_id;
    this.accountIds = data.account_ids || [];
  }

  async disconnect(): Promise<void> {
    await fetch('/api/providers/plaid/disconnect', {
      method: 'POST',
    });
    this.accessToken = null;
    this.itemId = null;
    this.accountIds = [];
  }

  async fetchPortfolio(): Promise<PortfolioData> {
    const response = await fetch('/api/providers/plaid/portfolio');

    if (!response.ok) {
      throw new Error('Failed to fetch portfolio');
    }

    return response.json();
  }
}

// Provider factory
export function createProvider(providerName: string): PortfolioProvider {
  switch (providerName.toLowerCase()) {
    case 'plaid':
      return new PlaidProvider();
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}

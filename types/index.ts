export interface Holding {
  id: number;
  ticker: string;
  name: string;
  sector?: string;
  industry?: string;
  provider_account_id?: string;
  account_name?: string;
  account_category?: AccountCategory;
  asset_type?: AssetType;
  quantity: number;
  current_price: number;
  average_price?: number;
  market_value: number;
  cost_basis?: number;
  unrealized_gain?: number;
  unrealized_gain_pct?: number;
  updated_at: string;
  created_at: string;
}

export interface PortfolioSnapshot {
  id: number;
  total_value: number;
  equity_value: number;
  cash_value: number;
  total_unrealized_gain?: number;
  total_unrealized_gain_pct?: number;
  snapshot_date: string;
  created_at: string;
}

export interface StockNote {
  id: number;
  ticker: string;
  note: string;
  tags: string[];
  target_buy_price?: number;
  target_sell_price?: number;
  updated_at: string;
  created_at: string;
}


export interface SyncHistory {
  id: number;
  provider: string;
  status: 'success' | 'error' | 'pending';
  last_synced_at?: string;
  next_sync_at?: string;
  error_message?: string;
  created_at: string;
}

export interface ProviderToken {
  id: number;
  provider: string;
  access_token: string;
  item_id?: string;
  account_ids?: string[];
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: number;
  account_id: string;
  account_name: string;
  account_type: string;
  account_category?: AccountCategory;
  balance: number;
  uninvested_cash?: number;
  margin_used?: number;
  provider: string;
  provider_account_id?: string;
  created_at: string;
  updated_at: string;
}


export interface PortfolioData {
  totalValue: number;
  equityValue: number;
  cashValue: number;
  marginUsed: number;
  netContributions?: number;
  contributionOverride?: number | null;
  accountGain?: number;
  accountGainPct?: number;
  contributionsStartDate?: string | null;
  contributionsEndDate?: string | null;
  contributionsDataAvailable?: boolean;
  contributionsMethod?: 'manual_override' | 'manual_required';
  totalUnrealizedGain?: number;
  totalUnrealizedGainPct?: number;
  holdings: Holding[];
  options: Holding[];
  cash: Account[];
  lastUpdated: string;
}

export type AccountCategory = string;
export type AssetType = 'equity' | 'option' | 'crypto';

export interface AccountPortfolioView {
  key: AccountCategory | string;
  label: string;
  accountIds: string[];
  portfolio: PortfolioData;
}

export interface PortfolioResponse {
  overall: PortfolioData;
  accountViews: AccountPortfolioView[];
}

export interface EquityNewsArticle {
  url: string;
  title: string;
  publisher: string | null;
  publishedAt: string | null;
  discoveredAt: string;
  isRead: boolean;
  readAt: string | null;
  tickers: string[];
}

export interface PlaidLinkResponse {
  public_token: string;
  metadata: {
    institution: {
      institution_id: string;
      name: string;
    };
    accounts: Array<{
      id: string;
      verification_status: string;
      mask: string;
      type: string;
      subtype: string;
      name: string;
    }>;
  };
}

export interface StockSearchResult {
  symbol: string;
  name: string;
  exchange: string | null;
  quoteType: string | null;
}

export interface StockFinancialSnapshot {
  year: string;
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  operatingCashflow: number | null;
  freeCashflow: number | null;
}

export interface StockResearchData {
  symbol: string;
  companyName: string;
  currency: string | null;
  currentPrice: number | null;
  marketCap: number | null;
  sharesOutstanding: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
  trailingEps: number | null;
  forwardEps: number | null;
  revenueTtm: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  operatingCashflow: number | null;
  freeCashflow: number | null;
  totalCash: number | null;
  totalDebt: number | null;
  returnOnEquity: number | null;
  operatingMargins: number | null;
  profitMargins: number | null;
  beta: number | null;
  annualHistory: StockFinancialSnapshot[];
}


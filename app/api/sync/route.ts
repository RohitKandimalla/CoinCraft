import { NextResponse } from 'next/server';
import { Database } from 'sqlite';
import { getDatabase } from '@/lib/db';
import { getPlaidBaseUrl } from '@/lib/plaid';

const clientId = process.env.PLAID_CLIENT_ID;
const secret = process.env.PLAID_SECRET;

function normalizeCategoryKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

interface PlaidAccount {
  account_id: string;
  name?: string;
  subtype?: string;
  type?: string;
  balances?: {
    current?: number;
  };
}

interface PlaidSecurity {
  security_id: string;
  ticker_symbol?: string;
  name?: string;
  official_name?: string;
  type?: string;
  close_price?: number;
  sector?: string;
  industry?: string;
}

interface PlaidHolding {
  account_id: string;
  security_id: string;
  quantity: number;
  institution_price?: number;
  institution_value?: number;
  cost_basis?: number;
}

interface PlaidInvestmentsHoldingsResponse {
  accounts?: PlaidAccount[];
  securities?: PlaidSecurity[];
  holdings?: PlaidHolding[];
}

interface ColumnInfo {
  name: string;
}

interface SyncedHoldingRow {
  ticker: string;
  name: string;
  provider_account_id: string;
  account_name: string;
  account_category: string;
  asset_type: string;
  sector: string | null;
  industry: string | null;
  quantity: number;
  current_price: number;
  average_price: number | null;
  market_value: number;
  cost_basis: number | null;
  unrealized_gain: number | null;
  unrealized_gain_pct: number | null;
}

interface SyncPortfolioResult {
  holdings: SyncedHoldingRow[];
  rawHoldings: SyncedHoldingRow[];
  cashByAccount: Map<string, number>;
  marginUsedByAccount: Map<string, number>;
  accounts: PlaidAccount[];
  cashDiagnosticsByAccount: Map<
    string,
    {
      explicitCash: number;
      impliedCash: number;
      nonCashValue: number;
      accountBalance: number | null;
      sources: string[];
    }
  >;
}

interface PlaidInvestmentTransaction {
  investment_transaction_id: string;
  account_id: string;
  amount: number;
  date: string;
  type?: string;
  subtype?: string;
  name?: string;
}

interface PlaidInvestmentTransactionsResponse {
  investment_transactions?: PlaidInvestmentTransaction[];
  total_investment_transactions?: number;
}

interface PlaidApiErrorPayload {
  error_code?: string;
  error_type?: string;
  error_message?: string;
  display_message?: string | null;
}

class InvestmentTransactionsUnavailableError extends Error {
  plaidCode?: string;
  status?: number;

  constructor(message: string, status?: number, plaidCode?: string) {
    super(message);
    this.name = 'InvestmentTransactionsUnavailableError';
    this.status = status;
    this.plaidCode = plaidCode;
  }
}

async function parsePlaidError(response: Response): Promise<PlaidApiErrorPayload | null> {
  try {
    return (await response.json()) as PlaidApiErrorPayload;
  } catch {
    return null;
  }
}

function isCashLikeHolding(security: PlaidSecurity, ticker: string): boolean {
  const securityType = String(security.type || '').toLowerCase();
  const nameBlob = `${security.name || ''} ${security.official_name || ''} ${security.security_id || ''}`.toLowerCase();
  const normalizedTicker = String(ticker || '').toUpperCase();

  if (normalizedTicker === 'CUR:USD' || /^CUR:[A-Z]{3}$/.test(normalizedTicker)) return true;
  if (normalizedTicker === 'USD' || normalizedTicker === 'US DOLLAR') return true;
  if (securityType.includes('cash') || securityType.includes('currency') || securityType.includes('sweep')) {
    return true;
  }

  return /(cash|currency|money market|sweep)/i.test(nameBlob);
}

interface ClassifiedCashflow {
  transactionId: string;
  accountId: string;
  viewKey: string;
  amount: number;
  date: string;
  classification: string;
}

interface CashflowSyncStatus {
  skipped: boolean;
  reason?: string;
  plaidCode?: string;
}

interface PlaidInvestmentTransaction {
  investment_transaction_id: string;
  account_id: string;
  amount: number;
  date: string;
  type?: string;
  subtype?: string;
  name?: string;
}

interface PlaidInvestmentTransactionsResponse {
  investment_transactions?: PlaidInvestmentTransaction[];
  total_investment_transactions?: number;
}

function classifyAccount(account: PlaidAccount): string {
  const name = String(account.name || '').toLowerCase();
  const subtype = String(account.subtype || '').toLowerCase();
  const type = String(account.type || '').toLowerCase();
  const combined = `${name} ${subtype}`;

  if (combined.includes('roth')) return 'roth_ira';
  if (combined.includes('401k') || combined.includes('401(k)')) return 'k_401';
  if (combined.includes('traditional ira')) return 'traditional_ira';
  if (combined.includes('ira')) return 'ira';
  if (combined.includes('hsa')) return 'hsa';
  if (combined.includes('529')) return 'plan_529';
  if (combined.includes('crypto') || type.includes('crypto')) return 'crypto';
  if (combined.includes('joint')) return 'joint';

  if (subtype) {
    const normalizedSubtype = normalizeCategoryKey(subtype);
    if (normalizedSubtype) return normalizedSubtype;
  }

  if (type === 'investment') return 'individual';
  if (type) {
    const normalizedType = normalizeCategoryKey(type);
    if (normalizedType) return normalizedType;
  }

  return 'other';
}

function classifyAssetType(security: PlaidSecurity, ticker: string, accountCategory: string): string {
  const securityType = String(security.type || '').toLowerCase();

  if (securityType === 'option' || /\d{6}[CP]\d{8}$/.test(ticker)) {
    return 'option';
  }

  if (accountCategory === 'crypto' || securityType === 'cryptocurrency') {
    return 'crypto';
  }

  return 'equity';
}

async function ensureSchema(db: Database) {
  await db.run(`
    CREATE TABLE IF NOT EXISTS holdings_by_account (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_account_id TEXT NOT NULL,
      account_name TEXT,
      account_category TEXT,
      asset_type TEXT,
      sector TEXT,
      industry TEXT,
      ticker TEXT NOT NULL,
      name TEXT,
      quantity REAL NOT NULL,
      current_price REAL NOT NULL,
      average_price REAL,
      market_value REAL NOT NULL,
      cost_basis REAL,
      unrealized_gain REAL,
      unrealized_gain_pct REAL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS portfolio_snapshots_by_view (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      view_key TEXT NOT NULL,
      total_value REAL NOT NULL,
      equity_value REAL NOT NULL,
      cash_value REAL NOT NULL,
      snapshot_date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(view_key, snapshot_date)
    )
  `);

  const accountColumns = await db.all<ColumnInfo[]>(`PRAGMA table_info(accounts)`);
  const colNames = accountColumns.map((c) => c.name);
  if (!colNames.includes('account_category')) {
    await db.run(`ALTER TABLE accounts ADD COLUMN account_category TEXT`);
  }
  if (!colNames.includes('uninvested_cash')) {
    await db.run(`ALTER TABLE accounts ADD COLUMN uninvested_cash REAL DEFAULT 0`);
  }
  if (!colNames.includes('margin_used')) {
    await db.run(`ALTER TABLE accounts ADD COLUMN margin_used REAL DEFAULT 0`);
  }

  const holdingsColumns = await db.all<ColumnInfo[]>(`PRAGMA table_info(holdings)`);
  const holdingColNames = holdingsColumns.map((c) => c.name);
  if (!holdingColNames.includes('average_price')) {
    await db.run(`ALTER TABLE holdings ADD COLUMN average_price REAL`);
  }
  if (!holdingColNames.includes('provider_account_id')) {
    await db.run(`ALTER TABLE holdings ADD COLUMN provider_account_id TEXT`);
  }
  if (!holdingColNames.includes('asset_type')) {
    await db.run(`ALTER TABLE holdings ADD COLUMN asset_type TEXT`);
  }
  if (!holdingColNames.includes('sector')) {
    await db.run(`ALTER TABLE holdings ADD COLUMN sector TEXT`);
  }
  if (!holdingColNames.includes('industry')) {
    await db.run(`ALTER TABLE holdings ADD COLUMN industry TEXT`);
  }

  // Add average_price to holdings_by_account if migrating existing DB
  const hbaColumns = await db.all<ColumnInfo[]>(`PRAGMA table_info(holdings_by_account)`);
  const hbaColNames = hbaColumns.map((c) => c.name);
  if (!hbaColNames.includes('average_price')) {
    await db.run(`ALTER TABLE holdings_by_account ADD COLUMN average_price REAL`);
  }
  if (!hbaColNames.includes('asset_type')) {
    await db.run(`ALTER TABLE holdings_by_account ADD COLUMN asset_type TEXT`);
  }
  if (!hbaColNames.includes('sector')) {
    await db.run(`ALTER TABLE holdings_by_account ADD COLUMN sector TEXT`);
  }
  if (!hbaColNames.includes('industry')) {
    await db.run(`ALTER TABLE holdings_by_account ADD COLUMN industry TEXT`);
  }

  await db.run(`
    CREATE TABLE IF NOT EXISTS security_metadata (
      ticker TEXT PRIMARY KEY,
      sector TEXT,
      industry TEXT,
      source TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS contribution_deposit_events (
      transaction_id TEXT PRIMARY KEY,
      view_key TEXT NOT NULL,
      amount REAL NOT NULL,
      transaction_date DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS investment_cashflows (
      transaction_id TEXT PRIMARY KEY,
      view_key TEXT NOT NULL,
      amount REAL NOT NULL,
      transaction_date DATE NOT NULL,
      classification TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getCachedSecurityMetadata(db: Database, ticker: string) {
  const row = (await db.get(
    'SELECT ticker, sector, industry, updated_at FROM security_metadata WHERE ticker = ?',
    [ticker]
  )) as { ticker: string; sector: string | null; industry: string | null; updated_at: string | null } | undefined;

  if (!row) return null;

  const updatedAt = row.updated_at ? new Date(String(row.updated_at).replace(' ', 'T')) : null;
  const ageMs = updatedAt ? Date.now() - updatedAt.getTime() : Number.POSITIVE_INFINITY;
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const fresh = Number.isFinite(ageMs) && ageMs <= THIRTY_DAYS_MS;

  return {
    sector: row.sector || null,
    industry: row.industry || null,
    fresh,
  };
}

async function fetchYahooAssetProfile(ticker: string) {
  try {
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
      ticker
    )}?modules=assetProfile`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'CoinCraft/1.0',
      },
      cache: 'no-store',
    });

    if (!response.ok) return null;

    const json = await response.json();
    const profile = json?.quoteSummary?.result?.[0]?.assetProfile;
    if (!profile) return null;

    const sector = typeof profile.sector === 'string' ? profile.sector.trim() : null;
    const industry = typeof profile.industry === 'string' ? profile.industry.trim() : null;
    if (!sector && !industry) return null;

    return { sector, industry, source: 'yahoo' };
  } catch {
    return null;
  }
}

async function getSecurityMetadata(db: Database, ticker: string) {
  const cached = await getCachedSecurityMetadata(db, ticker);
  if (cached?.fresh && cached.sector) {
    return { sector: cached.sector, industry: cached.industry };
  }

  const fetched = await fetchYahooAssetProfile(ticker);
  if (fetched) {
    await db.run(
      `
      INSERT INTO security_metadata (ticker, sector, industry, source, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(ticker) DO UPDATE SET
        sector = excluded.sector,
        industry = excluded.industry,
        source = excluded.source,
        updated_at = CURRENT_TIMESTAMP
    `,
      [ticker, fetched.sector, fetched.industry, fetched.source]
    );

    return { sector: fetched.sector, industry: fetched.industry };
  }

  if (cached) {
    return { sector: cached.sector, industry: cached.industry };
  }

  return { sector: null, industry: null };
}

async function fetchInvestmentTransactions(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<PlaidInvestmentTransaction[]> {
  const plaidBaseUrl = getPlaidBaseUrl();
  const transactions: PlaidInvestmentTransaction[] = [];

  const pageSize = 100;
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < total) {
    const response = await fetch(`${plaidBaseUrl}/investments/transactions/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        secret,
        access_token: accessToken,
        start_date: startDate,
        end_date: endDate,
        options: {
          count: pageSize,
          offset,
        },
      }),
    });

    if (!response.ok) {
      const plaidError = await parsePlaidError(response);
      const code = plaidError?.error_code;
      const message =
        plaidError?.display_message ||
        plaidError?.error_message ||
        `Plaid returned status ${response.status}`;

      throw new InvestmentTransactionsUnavailableError(message, response.status, code);
    }

    const body = (await response.json()) as PlaidInvestmentTransactionsResponse;
    const page = body.investment_transactions || [];
    total = body.total_investment_transactions ?? page.length;
    transactions.push(...page);
    offset += page.length;

    if (page.length === 0) {
      break;
    }
  }

  return transactions;
}

function classifyCashflowAmount(tx: PlaidInvestmentTransaction): {
  include: boolean;
  signedAmount: number;
  classification: string;
} {
  if (!tx.investment_transaction_id) {
    return { include: false, signedAmount: 0, classification: 'unknown' };
  }

  const rawAmount = Number(tx.amount || 0);
  if (!Number.isFinite(rawAmount) || rawAmount === 0) {
    return { include: false, signedAmount: 0, classification: 'unknown' };
  }

  const type = String(tx.type || '').toLowerCase();
  const subtype = String(tx.subtype || '').toLowerCase();
  const name = String(tx.name || '').toLowerCase();
  const blob = `${type} ${subtype} ${name}`;

  const excludeKeywords = ['buy', 'sell', 'dividend', 'interest', 'fee', 'tax', 'reinvest'];
  if (excludeKeywords.some((keyword) => blob.includes(keyword))) {
    return { include: false, signedAmount: 0, classification: 'non_external' };
  }

  const depositKeywords = [
    'deposit',
    'contribution',
    'cash in',
    'transfer in',
    'wire in',
    'ach credit',
    'rollover in',
    'incoming',
  ];
  if (depositKeywords.some((keyword) => blob.includes(keyword))) {
    return {
      include: true,
      signedAmount: Math.abs(rawAmount),
      classification: 'deposit',
    };
  }

  const withdrawalKeywords = [
    'withdraw',
    'distribution',
    'cash out',
    'transfer out',
    'wire out',
    'ach debit',
    'outgoing',
  ];
  if (withdrawalKeywords.some((keyword) => blob.includes(keyword))) {
    return {
      include: true,
      signedAmount: -Math.abs(rawAmount),
      classification: 'withdrawal',
    };
  }

  return { include: false, signedAmount: 0, classification: 'unknown' };
}

async function syncCashflowsAndBaselines(
  db: Database,
  accessToken: string,
  accounts: PlaidAccount[]
): Promise<CashflowSyncStatus> {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setFullYear(startDate.getFullYear() - 10);

  let transactions: PlaidInvestmentTransaction[] = [];
  try {
    transactions = await fetchInvestmentTransactions(
      accessToken,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );
  } catch (error) {
    // Keep sync resilient when investment transactions are unavailable for institution/account.
    if (error instanceof InvestmentTransactionsUnavailableError) {
      const codeText = error.plaidCode ? ` (${error.plaidCode})` : '';
      console.warn(`Skipping cashflow sync/baseline auto-update${codeText}: ${error.message}`);
      return {
        skipped: true,
        reason: error.message,
        plaidCode: error.plaidCode,
      };
    }

    console.warn('Skipping cashflow sync/baseline auto-update due to unexpected error:', error);
    return {
      skipped: true,
      reason: error instanceof Error ? error.message : 'unknown_error',
    };
  }

  if (transactions.length === 0) {
    return { skipped: false };
  }

  const accountCategoryById = new Map<string, string>();
  for (const account of accounts) {
    accountCategoryById.set(account.account_id, classifyAccount(account));
  }

  const overrideRows = await db.all<Array<{ view_key: string }>>(
    'SELECT view_key FROM contribution_overrides'
  );
  const overrideKeys = new Set(overrideRows.map((row) => row.view_key));

  const newlyAddedDepositsByView = new Map<string, number>();
  const normalizedCashflows: ClassifiedCashflow[] = [];

  for (const tx of transactions) {
    const classification = classifyCashflowAmount(tx);
    if (!classification.include) continue;

    const viewKey = accountCategoryById.get(tx.account_id) || 'other';
    const flow: ClassifiedCashflow = {
      transactionId: tx.investment_transaction_id,
      accountId: tx.account_id,
      viewKey,
      amount: classification.signedAmount,
      date: tx.date,
      classification: classification.classification,
    };
    normalizedCashflows.push(flow);

    await db.run(
      `
      INSERT INTO investment_cashflows (transaction_id, view_key, amount, transaction_date, classification, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(transaction_id) DO UPDATE SET
        view_key = excluded.view_key,
        amount = excluded.amount,
        transaction_date = excluded.transaction_date,
        classification = excluded.classification,
        updated_at = CURRENT_TIMESTAMP
    `,
      [flow.transactionId, flow.viewKey, flow.amount, flow.date, flow.classification]
    );

    if (!overrideKeys.has(viewKey) || flow.amount <= 0) {
      continue;
    }

    const existingEvent = await db.get<{ transaction_id: string } | undefined>(
      'SELECT transaction_id FROM contribution_deposit_events WHERE transaction_id = ?',
      [flow.transactionId]
    );
    if (existingEvent) {
      continue;
    }

    await db.run(
      `
      INSERT INTO contribution_deposit_events (transaction_id, view_key, amount, transaction_date)
      VALUES (?, ?, ?, ?)
    `,
      [flow.transactionId, viewKey, flow.amount, flow.date]
    );

    newlyAddedDepositsByView.set(viewKey, (newlyAddedDepositsByView.get(viewKey) || 0) + flow.amount);
  }

  for (const [viewKey, depositAmount] of newlyAddedDepositsByView.entries()) {
    await db.run(
      `
      UPDATE contribution_overrides
      SET value = value + ?, updated_at = CURRENT_TIMESTAMP
      WHERE view_key = ?
    `,
      [depositAmount, viewKey]
    );
  }

  return { skipped: false };
}

async function syncPlaidPortfolio(accessToken: string, db: Database): Promise<SyncPortfolioResult> {
  if (!clientId || !secret) {
    throw new Error('Plaid credentials not configured');
  }

  // Fetch holdings from Plaid - note: this is a simplified example
  // In production, you would use Plaid's Investments API to get holdings
  const plaidBaseUrl = getPlaidBaseUrl();

  const holdingsResponse = await fetch(`${plaidBaseUrl}/investments/holdings/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      secret: secret,
      access_token: accessToken,
    }),
  });

  if (!holdingsResponse.ok) {
    throw new Error('Failed to fetch holdings from Plaid');
  }

  const holdingsData = (await holdingsResponse.json()) as PlaidInvestmentsHoldingsResponse;

  const securitiesById = new Map<string, PlaidSecurity>();
  for (const security of holdingsData.securities || []) {
    securitiesById.set(security.security_id, security);
  }

  const accountsById = new Map<string, PlaidAccount>();
  for (const account of holdingsData.accounts || []) {
    accountsById.set(account.account_id, account);
  }

  // Use security metadata so holdings show actual ticker symbols/names.
  // Separate CUR:USD (uninvested cash) from equity holdings.
  const cashByAccount = new Map<string, number>();
  const marginUsedByAccount = new Map<string, number>();
  const nonCashValueByAccount = new Map<string, number>();
  const cashDiagnosticsByAccount = new Map<
    string,
    {
      explicitCash: number;
      impliedCash: number;
      nonCashValue: number;
      accountBalance: number | null;
      sources: string[];
    }
  >();
  const rawHoldings: SyncedHoldingRow[] = [];
  const profileByTicker = new Map<string, { sector: string | null; industry: string | null }>();

  for (const holding of holdingsData.holdings || []) {
    const security = securitiesById.get(holding.security_id) || { security_id: holding.security_id };
    const account = accountsById.get(holding.account_id) || { account_id: holding.account_id };
    const accountCategory = classifyAccount(account);
    const ticker = security.ticker_symbol || security.security_id || holding.security_id;
    const isCash = isCashLikeHolding(security, ticker);

    if (isCash) {
      const amount = Math.abs(holding.institution_value ?? holding.quantity ?? 0);
      const looksLikeMargin = (holding.cost_basis ?? 0) < 0;

      if (looksLikeMargin) {
        const existing = marginUsedByAccount.get(holding.account_id) || 0;
        marginUsedByAccount.set(holding.account_id, existing + amount);
      } else {
        const existing = cashByAccount.get(holding.account_id) || 0;
        cashByAccount.set(holding.account_id, existing + amount);

        const existingDiag = cashDiagnosticsByAccount.get(holding.account_id) || {
          explicitCash: 0,
          impliedCash: 0,
          nonCashValue: 0,
          accountBalance: null,
          sources: [],
        };
        existingDiag.explicitCash += amount;
        existingDiag.sources.push(`holding:${ticker}`);
        cashDiagnosticsByAccount.set(holding.account_id, existingDiag);
      }
      continue;
    }

    const name = security.name || security.official_name || ticker;
    const price = holding.institution_price ?? security.close_price ?? 0;
    const marketValue = holding.institution_value ?? holding.quantity * price;
    const nonCashExisting = nonCashValueByAccount.get(holding.account_id) || 0;
    nonCashValueByAccount.set(holding.account_id, nonCashExisting + marketValue);
    const costBasis = holding.cost_basis ?? null;
    const unrealizedGain = costBasis !== null ? marketValue - costBasis : null;
    const unrealizedGainPct =
      costBasis && costBasis !== 0 ? (Number(unrealizedGain) / costBasis) * 100 : null;
    const averagePrice =
      costBasis !== null && holding.quantity > 0 ? costBasis / holding.quantity : null;
    const assetType = classifyAssetType(security, ticker, accountCategory);

    let profile = profileByTicker.get(ticker);
    if (!profile) {
      profile = await getSecurityMetadata(db, ticker);
      profileByTicker.set(ticker, profile);
    }

    // Prefer Yahoo metadata for consistent sector/industry labeling across holdings.
    const sector =
      profile.sector || (typeof security.sector === 'string' && security.sector.trim()) || null;
    const industry =
      profile.industry || (typeof security.industry === 'string' && security.industry.trim()) || null;

    rawHoldings.push({
      ticker,
      name,
      provider_account_id: holding.account_id,
      account_name: account.name || holding.account_id,
      account_category: accountCategory,
      asset_type: assetType,
      sector,
      industry,
      quantity: holding.quantity,
      current_price: price,
      average_price: averagePrice,
      market_value: marketValue,
      cost_basis: costBasis,
      unrealized_gain: unrealizedGain,
      unrealized_gain_pct: unrealizedGainPct,
    });
  }

   // Some institutions do not label cash holdings cleanly in /investments/holdings/get.
   // Backfill cash from account balance residual only when we have no explicit cash for that account.
   for (const account of holdingsData.accounts || []) {
     const accountId = account.account_id;
     const diag = cashDiagnosticsByAccount.get(accountId) || {
       explicitCash: cashByAccount.get(accountId) || 0,
       impliedCash: 0,
       nonCashValue: nonCashValueByAccount.get(accountId) || 0,
       accountBalance: null,
       sources: [],
     };

     if ((cashByAccount.get(accountId) || 0) > 0) {
       diag.accountBalance =
         Number.isFinite(Number(account.balances?.current)) ? Number(account.balances?.current) : null;
       diag.nonCashValue = nonCashValueByAccount.get(accountId) || 0;
       cashDiagnosticsByAccount.set(accountId, diag);
       continue;
     }

     const balance = Number(account.balances?.current);
     if (!Number.isFinite(balance)) {
       cashDiagnosticsByAccount.set(accountId, diag);
       continue;
     }

     const nonCashValue = nonCashValueByAccount.get(accountId) || 0;
     const marginUsed = marginUsedByAccount.get(accountId) || 0;
     const impliedCash = balance - nonCashValue - marginUsed;
     if (impliedCash > 0.01) {
       cashByAccount.set(accountId, impliedCash);
       diag.impliedCash = impliedCash;
       diag.sources.push('balance_residual');
     }

     diag.accountBalance = balance;
     diag.nonCashValue = nonCashValue;
     cashDiagnosticsByAccount.set(accountId, diag);
   }

  const aggregatedByTicker = new Map<string, SyncedHoldingRow>();

  for (const holding of rawHoldings) {
    if (holding.asset_type === 'option') {
      continue;
    }

    const existing = aggregatedByTicker.get(holding.ticker);
    if (!existing) {
      aggregatedByTicker.set(holding.ticker, { ...holding });
      continue;
    }

    existing.quantity += holding.quantity || 0;
    existing.market_value += holding.market_value || 0;
    existing.cost_basis = (existing.cost_basis || 0) + (holding.cost_basis || 0);
    existing.unrealized_gain = (existing.unrealized_gain || 0) + (holding.unrealized_gain || 0);

    existing.current_price =
      existing.quantity > 0 ? existing.market_value / existing.quantity : existing.current_price;

    // Weighted average cost = total cost_basis / total quantity
    existing.average_price = existing.quantity > 0 ? existing.cost_basis / existing.quantity : null;

    existing.unrealized_gain_pct =
      existing.cost_basis && existing.cost_basis !== 0
        ? (existing.unrealized_gain / existing.cost_basis) * 100
        : null;

    if (!existing.industry && holding.industry) {
      existing.industry = holding.industry;
    }
    if (!existing.sector && holding.sector) {
      existing.sector = holding.sector;
    }
  }

  const holdings = Array.from(aggregatedByTicker.values());

  return {
    holdings,
    rawHoldings,
    cashByAccount,
    marginUsedByAccount,
    accounts: holdingsData.accounts || [],
    cashDiagnosticsByAccount,
  };
}

export async function POST(request: Request) {
  try {
    const debugMode = new URL(request.url).searchParams.get('debug') === '1';
    const db = await getDatabase();
    await ensureSchema(db);

    const existingLots = await db.all<
      Array<{ provider_account_id: string; ticker: string; created_at: string }>
    >('SELECT provider_account_id, ticker, created_at FROM holdings_by_account');
    const lotFirstSeen = new Map<string, string>();
    for (const row of existingLots) {
      const key = `${row.provider_account_id}::${row.ticker}`;
      const current = lotFirstSeen.get(key);
      if (!current || row.created_at < current) {
        lotFirstSeen.set(key, row.created_at);
      }
    }

    const existingAggregated = await db.all<Array<{ ticker: string; created_at: string }>>(
      'SELECT ticker, created_at FROM holdings'
    );
    const tickerFirstSeen = new Map<string, string>();
    for (const row of existingAggregated) {
      const current = tickerFirstSeen.get(row.ticker);
      if (!current || row.created_at < current) {
        tickerFirstSeen.set(row.ticker, row.created_at);
      }
    }

    // Get access token from database
    const tokenRecord = await db.get(
      'SELECT access_token FROM provider_tokens WHERE provider = ?',
      ['plaid']
    );

    if (!tokenRecord) {
      return NextResponse.json({ error: 'Plaid not connected' }, { status: 400 });
    }

    // Sync portfolio
    const syncResult = await syncPlaidPortfolio(tokenRecord.access_token, db);
    const cashflowStatus = await syncCashflowsAndBaselines(db, tokenRecord.access_token, syncResult.accounts);
    const holdings = syncResult.holdings;

    await db.run(`DELETE FROM holdings_by_account`);
    const nowIso = new Date().toISOString();

    for (const holding of syncResult.rawHoldings) {
      const lotKey = `${holding.provider_account_id}::${holding.ticker}`;
      const createdAt = lotFirstSeen.get(lotKey) || nowIso;
      await db.run(
        `INSERT INTO holdings_by_account 
         (provider_account_id, account_name, account_category, asset_type, sector, industry, ticker, name, quantity, current_price, average_price, market_value, cost_basis, unrealized_gain, unrealized_gain_pct, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          holding.provider_account_id,
          holding.account_name,
          holding.account_category,
          holding.asset_type,
          holding.sector,
          holding.industry,
          holding.ticker,
          holding.name,
          holding.quantity,
          holding.current_price,
          holding.average_price,
          holding.market_value,
          holding.cost_basis,
          holding.unrealized_gain,
          holding.unrealized_gain_pct,
          createdAt,
        ]
      );
    }

    await db.run(`DELETE FROM accounts WHERE provider = 'plaid'`);

    for (const account of syncResult.accounts) {
      const uninvestedCash = syncResult.cashByAccount.get(account.account_id) || 0;
      const marginUsed = syncResult.marginUsedByAccount.get(account.account_id) || 0;
      await db.run(
        `INSERT OR REPLACE INTO accounts 
         (account_id, account_name, account_type, account_category, balance, uninvested_cash, margin_used, provider, provider_account_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `plaid_${account.account_id}`,
          account.name,
          account.subtype || account.type || 'investment',
          classifyAccount(account),
          account.balances?.current || 0,
          uninvestedCash,
          marginUsed,
          'plaid',
          account.account_id,
        ]
      );
    }

    // Clear old holdings and insert new ones
    await db.run('DELETE FROM holdings');

    for (const holding of holdings) {
      const createdAt = tickerFirstSeen.get(holding.ticker) || nowIso;
      await db.run(
        `INSERT INTO holdings 
         (ticker, name, provider_account_id, asset_type, sector, industry, quantity, current_price, average_price, market_value, cost_basis, unrealized_gain, unrealized_gain_pct, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          holding.ticker,
          holding.name,
          holding.provider_account_id,
          holding.asset_type,
          holding.sector,
          holding.industry,
          holding.quantity,
          holding.current_price,
          holding.average_price,
          holding.market_value,
          holding.cost_basis,
          holding.unrealized_gain,
          holding.unrealized_gain_pct,
          createdAt,
        ]
      );
    }

    // Create portfolio snapshot — options excluded, uninvested cash included, margin excluded from value.
    const equityValue = holdings.reduce((sum: number, h) => sum + h.market_value, 0);
    const cashAccounts = await db.all(
      `SELECT uninvested_cash FROM accounts WHERE provider = 'plaid'`
    );
    const cashValue = cashAccounts.reduce(
      (sum: number, acc: { uninvested_cash?: number }) => sum + (acc.uninvested_cash || 0),
      0
    );
    const totalValue = equityValue + cashValue;
    const totalCostBasis = holdings.reduce(
      (sum: number, h) => sum + Math.max(h.cost_basis || 0, 0),
      0
    );

    const totalUnrealizedGain = holdings.reduce(
      (sum: number, h) => sum + (h.unrealized_gain || 0),
      0
    );
    const totalUnrealizedGainPct =
      totalCostBasis > 0 ? (totalUnrealizedGain / totalCostBasis) * 100 : 0;
    const today = new Date().toISOString().split('T')[0];

    await db.run(
      `INSERT OR IGNORE INTO portfolio_snapshots 
       (total_value, equity_value, cash_value, total_unrealized_gain, total_unrealized_gain_pct, snapshot_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [totalValue, equityValue, cashValue, totalUnrealizedGain, totalUnrealizedGainPct, today]
    );

    const snapshotRows = [
      {
        viewKey: 'overall',
        totalValue,
        equityValue,
        cashValue,
      },
    ];

    const viewKeys = ['individual', 'roth_ira', 'joint', 'crypto'];
    for (const viewKey of viewKeys) {
      const accountIds = new Set(
        syncResult.accounts
          .filter((account) => classifyAccount(account) === viewKey)
          .map((account) => account.account_id)
      );

      const viewEquityValue = syncResult.rawHoldings
        .filter(
          (holding) =>
            holding.asset_type !== 'option' && accountIds.has(holding.provider_account_id)
        )
        .reduce((sum: number, holding) => sum + (holding.market_value || 0), 0);

      const viewCashValue = Array.from(accountIds as Set<string>).reduce(
        (sum: number, accountId) => sum + (syncResult.cashByAccount.get(accountId) || 0),
        0
      );

      snapshotRows.push({
        viewKey,
        totalValue: viewEquityValue + viewCashValue,
        equityValue: viewEquityValue,
        cashValue: viewCashValue,
      });
    }

    for (const snapshot of snapshotRows) {
      await db.run(
        `INSERT OR REPLACE INTO portfolio_snapshots_by_view
         (view_key, total_value, equity_value, cash_value, snapshot_date)
         VALUES (?, ?, ?, ?, ?)`,
        [
          snapshot.viewKey,
          snapshot.totalValue,
          snapshot.equityValue,
          snapshot.cashValue,
          today,
        ]
      );
    }

    // Update sync history
    await db.run(
      `INSERT INTO sync_history (provider, status, last_synced_at)
       VALUES (?, ?, ?)`,
      ['plaid', 'success', new Date().toISOString()]
    );

    return NextResponse.json({
      success: true,
      holdingsCount: holdings.length,
      holdingLotsCount: syncResult.rawHoldings.length,
      totalValue,
      warnings: cashflowStatus.skipped
        ? [
            {
              type: 'cashflow_sync_skipped',
              plaidCode: cashflowStatus.plaidCode || null,
              message: cashflowStatus.reason || 'Cashflow sync skipped',
            },
          ]
        : [],
      ...(debugMode
        ? {
            debug: {
              cashByAccount: Object.fromEntries(syncResult.cashByAccount.entries()),
              marginUsedByAccount: Object.fromEntries(syncResult.marginUsedByAccount.entries()),
              cashDiagnosticsByAccount: Object.fromEntries(syncResult.cashDiagnosticsByAccount.entries()),
              cashflowSync: cashflowStatus,
            },
          }
        : {}),
    });
  } catch (error) {
    console.error('Error syncing portfolio:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    const db = await getDatabase();
    await db.run(
      `INSERT INTO sync_history (provider, status, error_message)
       VALUES (?, ?, ?)`,
      ['plaid', 'error', errorMessage]
    );

    return NextResponse.json(
      { error: 'Failed to sync portfolio', detail: errorMessage },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { Database } from 'sqlite';
import { getDatabase } from '@/lib/db';
import { getPlaidBaseUrl } from '@/lib/plaid';

const clientId = process.env.PLAID_CLIENT_ID;
const secret = process.env.PLAID_SECRET;

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
}

function classifyAccount(account: PlaidAccount): string {
  const name = String(account.name || '').toLowerCase();
  const subtype = String(account.subtype || '').toLowerCase();
  const type = String(account.type || '').toLowerCase();

  if (subtype.includes('roth') || name.includes('roth')) return 'roth_ira';
  if (subtype.includes('crypto') || type.includes('crypto') || name.includes('crypto'))
    return 'crypto';
  if (name.includes('joint') || subtype.includes('joint')) return 'joint';
  if (type === 'investment') return 'individual';
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
  if (cached?.fresh && (cached.sector || cached.industry)) {
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
  const rawHoldings: SyncedHoldingRow[] = [];
  const profileByTicker = new Map<string, { sector: string | null; industry: string | null }>();

  for (const holding of holdingsData.holdings || []) {
    const security = securitiesById.get(holding.security_id) || { security_id: holding.security_id };
    const account = accountsById.get(holding.account_id) || { account_id: holding.account_id };
    const accountCategory = classifyAccount(account);
    const ticker = security.ticker_symbol || security.security_id || holding.security_id;
    const isCash = ticker === 'CUR:USD' || security.type === 'cash';

    if (isCash) {
      const amount = Math.abs(holding.institution_value ?? holding.quantity ?? 0);
      const looksLikeMargin = (holding.cost_basis ?? 0) < 0;

      if (looksLikeMargin) {
        const existing = marginUsedByAccount.get(holding.account_id) || 0;
        marginUsedByAccount.set(holding.account_id, existing + amount);
      } else {
        const existing = cashByAccount.get(holding.account_id) || 0;
        cashByAccount.set(holding.account_id, existing + amount);
      }
      continue;
    }

    const name = security.name || security.official_name || ticker;
    const price = holding.institution_price ?? security.close_price ?? 0;
    const marketValue = holding.institution_value ?? holding.quantity * price;
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

    const sector =
      (typeof security.sector === 'string' && security.sector.trim()) || profile.sector || null;
    const industry =
      (typeof security.industry === 'string' && security.industry.trim()) || profile.industry || null;

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
  };
}

export async function POST() {
  try {
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

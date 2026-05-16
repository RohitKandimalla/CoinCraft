import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { Account, AccountPortfolioView, Holding, PortfolioData, PortfolioResponse } from '@/types';

export const dynamic = 'force-dynamic';

function sumNumbers(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0);
}

function aggregateHoldingsByTicker(holdings: Holding[]): Holding[] {
  const grouped = new Map<string, Holding>();

  for (const holding of holdings) {
    const existing = grouped.get(holding.ticker);
    if (!existing) {
      grouped.set(holding.ticker, { ...holding });
      continue;
    }

    existing.quantity += holding.quantity || 0;
    existing.market_value += holding.market_value || 0;
    existing.cost_basis = (existing.cost_basis || 0) + (holding.cost_basis || 0);
    existing.unrealized_gain = (existing.unrealized_gain || 0) + (holding.unrealized_gain || 0);
    existing.current_price =
      existing.quantity > 0 ? existing.market_value / existing.quantity : existing.current_price;
    existing.average_price =
      existing.quantity > 0 && existing.cost_basis != null
        ? (existing.cost_basis || 0) / existing.quantity
        : undefined;
    existing.unrealized_gain_pct =
      existing.cost_basis && existing.cost_basis !== 0
        ? ((existing.unrealized_gain || 0) / existing.cost_basis) * 100
        : 0;
  }

  return Array.from(grouped.values()).sort((a, b) => b.market_value - a.market_value);
}

function buildPortfolioData(
  holdings: Holding[],
  options: Holding[],
  accounts: Account[],
  lastUpdated: string
): PortfolioData {
  const equityValue = sumNumbers(holdings.map((h) => h.market_value || 0));
  const cashValue = sumNumbers(accounts.map((a) => a.uninvested_cash || 0));
  const totalCostBasis = sumNumbers(holdings.map((h) => Math.max(h.cost_basis || 0, 0)));
  const marginUsed = sumNumbers(accounts.map((a) => a.margin_used || 0));
  const totalValue = equityValue + cashValue;

  // Keep standard holdings unrealized gain independent from manual contribution baseline.
  const totalUnrealizedGain = sumNumbers(holdings.map((h) => h.unrealized_gain || 0));
  const totalUnrealizedGainPct =
    totalCostBasis > 0 ? (totalUnrealizedGain / totalCostBasis) * 100 : 0;

  return {
    totalValue,
    equityValue,
    cashValue,
    marginUsed,
    netContributions: undefined,
    contributionOverride: null,
    accountGain: undefined,
    accountGainPct: undefined,
    contributionsStartDate: null,
    contributionsEndDate: null,
    contributionsDataAvailable: false,
    contributionsMethod: 'manual_required',
    totalUnrealizedGain,
    totalUnrealizedGainPct,
    holdings,
    options,
    cash: accounts,
    lastUpdated,
  };
}

function applyContributionOverride(
  portfolio: PortfolioData,
  overrideValue: number | null
): PortfolioData {
  if (overrideValue == null || !Number.isFinite(overrideValue) || overrideValue < 0) {
    return {
      ...portfolio,
      contributionOverride: null,
      netContributions: undefined,
      accountGain: undefined,
      accountGainPct: undefined,
      contributionsMethod: 'manual_required',
    };
  }

  // Compare manual net contributions against invested holdings value (not cash-inclusive total).
  const gain = portfolio.equityValue - overrideValue;
  const gainPct = overrideValue > 0 ? (gain / overrideValue) * 100 : 0;

  return {
    ...portfolio,
    contributionOverride: overrideValue,
    netContributions: overrideValue,
    accountGain: gain,
    accountGainPct: gainPct,
    contributionsMethod: 'manual_override',
  };
}

export async function GET() {
  try {
    const db = await getDatabase();

    await db.run(`
      CREATE TABLE IF NOT EXISTS contribution_overrides (
        view_key TEXT PRIMARY KEY,
        value REAL NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const holdsByAccountExists = await db.get(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='holdings_by_account'`
    );

    const aggregatedHoldings = await db.all<Holding[]>(
      `SELECT * FROM holdings ORDER BY market_value DESC`
    );

    const accountHoldings = holdsByAccountExists
      ? await db.all<Holding[]>(`SELECT * FROM holdings_by_account ORDER BY market_value DESC`)
      : [];

    const allAccounts = await db.all<Account[]>(
      `SELECT * FROM accounts WHERE provider = 'plaid' ORDER BY account_name ASC`
    );

    const latestSnapshot = await db.get(
      `SELECT * FROM portfolio_snapshots ORDER BY snapshot_date DESC LIMIT 1`
    );
    const lastUpdated = latestSnapshot?.snapshot_date || new Date().toISOString();

    const baseRows = accountHoldings.length > 0 ? accountHoldings : aggregatedHoldings;
    const accountsWithPositions = new Set(
      baseRows.map((h) => h.provider_account_id).filter((id): id is string => Boolean(id))
    );

    const accounts = allAccounts.filter((account) => {
      const id = account.provider_account_id || account.account_id;
      const hasPosition = accountsWithPositions.has(id);
      const hasCash = (account.uninvested_cash || 0) > 0;
      const hasMargin = (account.margin_used || 0) > 0;
      return hasPosition || hasCash || hasMargin;
    });

    const overrideRows = await db.all<Array<{ view_key: string; value: number }>>(
      'SELECT view_key, value FROM contribution_overrides'
    );
    const overrideByView = new Map(overrideRows.map((row) => [row.view_key, row.value]));

    const accountViews: AccountPortfolioView[] = [];

    const categoryTabs = [
      { key: 'individual', label: 'Individual Account' },
      { key: 'roth_ira', label: 'Roth IRA' },
      { key: 'joint', label: 'Joint Account' },
      { key: 'crypto', label: 'Crypto' },
    ];

    for (const tab of categoryTabs) {
      const categoryAccounts = accounts.filter((a) => (a.account_category || 'other') === tab.key);
      const accountIds = new Set(
        categoryAccounts.map((a) => a.provider_account_id || a.account_id)
      );
      const categoryRows = baseRows.filter((h) =>
        h.provider_account_id ? accountIds.has(h.provider_account_id) : false
      );
      const categoryHoldings = aggregateHoldingsByTicker(
        categoryRows.filter((h) => h.asset_type !== 'option')
      );
      const categoryOptions = aggregateHoldingsByTicker(
        categoryRows.filter((h) => h.asset_type === 'option')
      );

      const categoryView: AccountPortfolioView = {
        key: tab.key,
        label: tab.label,
        accountIds: Array.from(accountIds),
        portfolio: applyContributionOverride(
          buildPortfolioData(categoryHoldings, categoryOptions, categoryAccounts, lastUpdated),
          overrideByView.get(tab.key) ?? null
        ),
      };

      accountViews.push(categoryView);
    }

    const overallIncludedRows = baseRows.filter((h) => h.asset_type !== 'option');
    const overallOptionRows = baseRows.filter((h) => h.asset_type === 'option');
    const overallBase = buildPortfolioData(
      aggregateHoldingsByTicker(overallIncludedRows),
      aggregateHoldingsByTicker(overallOptionRows),
      accounts,
      lastUpdated
    );

    const activeCategoryViews = accountViews.filter((view) => view.portfolio.totalValue > 0);
    const allActiveHaveManual =
      activeCategoryViews.length > 0 &&
      activeCategoryViews.every((view) => view.portfolio.netContributions != null);

    const overallPortfolio = allActiveHaveManual
      ? applyContributionOverride(
          overallBase,
          sumNumbers(
            activeCategoryViews.map((view) => Number(view.portfolio.netContributions || 0))
          )
        )
      : {
          ...overallBase,
          contributionsMethod: 'manual_required' as const,
          netContributions: undefined,
          contributionOverride: null,
          accountGain: undefined,
          accountGainPct: undefined,
        };

    accountViews.unshift({
      key: 'overall',
      label: 'Overall',
      accountIds: accounts.map((a) => a.provider_account_id || a.account_id),
      portfolio: overallPortfolio,
    });

    const response: PortfolioResponse = {
      overall: overallPortfolio,
      accountViews,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    return NextResponse.json({ error: 'Failed to fetch portfolio' }, { status: 500 });
  }
}

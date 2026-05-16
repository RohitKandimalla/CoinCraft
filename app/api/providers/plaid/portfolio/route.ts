import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { Account, AccountPortfolioView, Holding, PortfolioData, PortfolioResponse } from '@/types';

export const dynamic = 'force-dynamic';

function sumNumbers(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0);
}

function calcNetContributions(
  amounts: Array<{ type: string; subtype: string; amount: number }>
): number {
  let net = 0;

  for (const tx of amounts) {
    const type = (tx.type || '').toLowerCase();
    const subtype = (tx.subtype || '').toLowerCase();
    const amount = Number(tx.amount || 0);

    // Deposits/transfers/contributions increase lifetime contributed capital.
    if (
      (type === 'cash' || type === 'transfer') &&
      ['deposit', 'transfer', 'contribution'].includes(subtype)
    ) {
      net += Math.abs(amount);
      continue;
    }

    // Withdrawals/distributions decrease lifetime contributed capital.
    if (
      (type === 'cash' || type === 'transfer') &&
      ['withdrawal', 'distribution'].includes(subtype)
    ) {
      net -= Math.abs(amount);
      continue;
    }
  }

  return net;
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
  lastUpdated: string,
  netContributions: number,
  contributionsRange: { minDate: string | null; maxDate: string | null; hasData: boolean }
): PortfolioData {
  const equityValue = sumNumbers(holdings.map((h) => h.market_value || 0));
  const cashValue = sumNumbers(accounts.map((a) => a.uninvested_cash || 0));
  const totalCostBasis = sumNumbers(holdings.map((h) => Math.max(h.cost_basis || 0, 0)));
  const marginUsed = sumNumbers(accounts.map((a) => a.margin_used || 0));
  const investedCapital = Math.max(totalCostBasis - marginUsed, 0);
  const totalValue = equityValue + cashValue;
  const totalUnrealizedGain = sumNumbers(holdings.map((h) => h.unrealized_gain || 0));
  const totalUnrealizedGainPct =
    totalCostBasis > 0 ? (totalUnrealizedGain / totalCostBasis) * 100 : 0;

  return {
    totalValue,
    equityValue,
    cashValue,
    investedCapital,
    totalCostBasis,
    marginUsed,
    netContributions,
    contributionsStartDate: contributionsRange.minDate,
    contributionsEndDate: contributionsRange.maxDate,
    contributionsDataAvailable: contributionsRange.hasData,
    totalUnrealizedGain,
    totalUnrealizedGainPct,
    holdings,
    options,
    cash: accounts,
    lastUpdated,
  };
}

export async function GET() {
  try {
    const db = await getDatabase();

    const holdsByAccountExists = await db.get(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='holdings_by_account'`
    );

    const aggregatedHoldings = await db.all<Holding[]>(
      `SELECT * FROM holdings ORDER BY market_value DESC`
    );

    const accountHoldings = holdsByAccountExists
      ? await db.all<Holding[]>(`SELECT * FROM holdings_by_account ORDER BY market_value DESC`)
      : [];

    const accounts = await db.all<Account[]>(
      `SELECT * FROM accounts WHERE provider = 'plaid' ORDER BY account_name ASC`
    );

    const latestSnapshot = await db.get(
      `SELECT * FROM portfolio_snapshots ORDER BY snapshot_date DESC LIMIT 1`
    );
    const lastUpdated = latestSnapshot?.snapshot_date || new Date().toISOString();

    const txTableExists = await db.get(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='investment_transactions'`
    );

    const contributionsByAccount = new Map<string, number>();
    let contributionMinDate: string | null = null;
    let contributionMaxDate: string | null = null;
    let contributionsDataAvailable = false;

    if (txTableExists) {
      const txRows = await db.all<
        Array<{ account_id: string; type: string; subtype: string; amount: number; date: string }>
      >(
        `SELECT account_id, type, COALESCE(subtype, '') as subtype, amount, date FROM investment_transactions`
      );

      if (txRows.length > 0) {
        contributionsDataAvailable = true;
        const byAccount = new Map<
          string,
          Array<{ type: string; subtype: string; amount: number }>
        >();

        for (const tx of txRows) {
          if (!contributionMinDate || tx.date < contributionMinDate) contributionMinDate = tx.date;
          if (!contributionMaxDate || tx.date > contributionMaxDate) contributionMaxDate = tx.date;

          const list = byAccount.get(tx.account_id) || [];
          list.push({ type: tx.type, subtype: tx.subtype, amount: tx.amount });
          byAccount.set(tx.account_id, list);
        }

        for (const [accountId, txList] of byAccount) {
          contributionsByAccount.set(accountId, calcNetContributions(txList));
        }
      }
    }

    const allAccountIds = accounts.map((a) => a.provider_account_id || a.account_id);
    const overallContributions = sumNumbers(
      allAccountIds.map((id) => contributionsByAccount.get(id) || 0)
    );

    const baseRows = accountHoldings.length > 0 ? accountHoldings : aggregatedHoldings;
    const overallIncludedRows = baseRows.filter((h) => h.asset_type !== 'option');
    const overallOptionRows = baseRows.filter((h) => h.asset_type === 'option');

    const overallPortfolio = buildPortfolioData(
      aggregateHoldingsByTicker(overallIncludedRows),
      aggregateHoldingsByTicker(overallOptionRows),
      accounts,
      lastUpdated,
      overallContributions,
      {
        minDate: contributionMinDate,
        maxDate: contributionMaxDate,
        hasData: contributionsDataAvailable,
      }
    );

    const accountViews: AccountPortfolioView[] = [
      {
        key: 'overall',
        label: 'Overall',
        accountIds: accounts.map((a) => a.provider_account_id || a.account_id),
        portfolio: overallPortfolio,
      },
    ];

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
      const categoryContributions = sumNumbers(
        Array.from(accountIds).map((id) => contributionsByAccount.get(id) || 0)
      );

      accountViews.push({
        key: tab.key,
        label: tab.label,
        accountIds: Array.from(accountIds),
        portfolio: buildPortfolioData(
          categoryHoldings,
          categoryOptions,
          categoryAccounts,
          lastUpdated,
          categoryContributions,
          {
            minDate: contributionMinDate,
            maxDate: contributionMaxDate,
            hasData: contributionsDataAvailable,
          }
        ),
      });
    }

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

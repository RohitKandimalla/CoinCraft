import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { getPlaidBaseUrl } from '@/lib/plaid';

interface PlaidExchangeResponse {
  access_token: string;
  item_id: string;
}

interface PlaidAccount {
  account_id: string;
  name: string;
  type: string;
  subtype?: string;
  balances?: {
    current?: number;
  };
}

interface PlaidAccountsResponse {
  accounts: PlaidAccount[];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { public_token?: string };
    const { public_token } = body;

    if (!public_token) {
      return NextResponse.json({ error: 'Missing public_token' }, { status: 400 });
    }

    // Exchange public token for access token via Plaid
    const clientId = process.env.PLAID_CLIENT_ID;
    const secret = process.env.PLAID_SECRET;

    if (!clientId || !secret) {
      return NextResponse.json({ error: 'Plaid credentials not configured' }, { status: 500 });
    }

    const plaidBaseUrl = getPlaidBaseUrl();

    const plaidResponse = await fetch(`${plaidBaseUrl}/item/public_token/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        secret: secret,
        public_token: public_token,
      }),
    });

    if (!plaidResponse.ok) {
      const error = await plaidResponse.text();
      console.error('Plaid exchange error:', error);
      return NextResponse.json({ error: 'Failed to exchange public token' }, { status: 500 });
    }

    const plaidData = (await plaidResponse.json()) as PlaidExchangeResponse;
    const { access_token, item_id } = plaidData;

    // Get accounts from Plaid
    const accountsResponse = await fetch(`${plaidBaseUrl}/accounts/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        secret: secret,
        access_token: access_token,
      }),
    });

    const accountsData = (await accountsResponse.json()) as PlaidAccountsResponse;
    const accountIds = accountsData.accounts.map((acc) => acc.account_id);

    // Store in database
    const db = await getDatabase();
    await db.run(
      `INSERT OR REPLACE INTO provider_tokens 
       (provider, access_token, item_id, account_ids) 
       VALUES (?, ?, ?, ?)`,
      ['plaid', access_token, item_id, JSON.stringify(accountIds)]
    );

    // Store accounts
    for (const account of accountsData.accounts) {
      const type = account.type === 'depository' ? 'joint' : account.type;
      await db.run(
        `INSERT OR REPLACE INTO accounts 
         (account_id, account_name, account_type, balance, provider, provider_account_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          `plaid_${account.account_id}`,
          account.name,
          type,
          account.balances?.current || 0,
          'plaid',
          account.account_id,
        ]
      );
    }

    return NextResponse.json({
      success: true,
      provider: 'plaid',
      item_id,
      account_ids: accountIds,
    });
  } catch (error) {
    console.error('Error in exchange endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

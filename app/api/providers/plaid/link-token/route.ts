import { NextResponse } from 'next/server';
import { getPlaidBaseUrl } from '@/lib/plaid';

export async function POST() {
  try {
    const clientId = process.env.PLAID_CLIENT_ID;
    const secret = process.env.PLAID_SECRET;

    if (!clientId || !secret) {
      return NextResponse.json({ error: 'Plaid credentials not configured' }, { status: 500 });
    }

    const plaidBaseUrl = getPlaidBaseUrl();

    const response = await fetch(`${plaidBaseUrl}/link/token/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        secret,
        client_name: process.env.NEXT_PUBLIC_PLAID_CLIENT_NAME || 'CoinCraft',
        language: 'en',
        country_codes: ['US'],
        user: {
          // Single local-user app for MVP
          client_user_id: 'local-user',
        },
        products: ['investments'],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Plaid link token error:', errorBody);
      return NextResponse.json({ error: 'Failed to create Plaid link token' }, { status: 500 });
    }

    const data = await response.json();

    return NextResponse.json({
      link_token: data.link_token,
      expiration: data.expiration,
    });
  } catch (error) {
    console.error('Error creating link token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

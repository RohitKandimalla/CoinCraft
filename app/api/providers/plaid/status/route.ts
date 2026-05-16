import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { getPlaidEnv, plaidCredentialsConfigured } from '@/lib/plaid';

export async function GET() {
  try {
    const db = await getDatabase();
    const token = await db.get(
      'SELECT access_token FROM provider_tokens WHERE provider = ?',
      ['plaid']
    );

    return NextResponse.json({
      connected: !!token,
      provider: 'plaid',
      environment: getPlaidEnv(),
      credentialsConfigured: plaidCredentialsConfigured(),
    });
  } catch (error) {
    console.error('Error checking Plaid status:', error);
    return NextResponse.json({ connected: false }, { status: 500 });
  }
}


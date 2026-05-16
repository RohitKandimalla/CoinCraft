const DEFAULT_PLAID_ENV = 'sandbox';

type PlaidEnv = 'sandbox' | 'development' | 'production';

export function getPlaidEnv(): PlaidEnv {
  const envFromServer = process.env.PLAID_ENV;
  const envFromClient = process.env.NEXT_PUBLIC_PLAID_ENV;
  const raw = (envFromServer || envFromClient || DEFAULT_PLAID_ENV).toLowerCase();

  if (raw === 'sandbox' || raw === 'development' || raw === 'production') {
    return raw;
  }

  return 'sandbox';
}

export function getPlaidBaseUrl(): string {
  const env = getPlaidEnv();
  return `https://${env}.plaid.com`;
}

export function plaidCredentialsConfigured(): boolean {
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}


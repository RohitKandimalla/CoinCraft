# CoinCraft — Local-First Portfolio Tracker

CoinCraft is a local-first investing dashboard that connects to Robinhood (via Plaid), stores data on your machine, and gives you clean portfolio analytics.

## About this app

- Sync holdings and account balances from Robinhood through Plaid
- View portfolio by account: Overall, Individual, Roth IRA, Joint, and Crypto
- Keep options in a separate section from core holdings
- Track metrics like holdings value, uninvested cash, margin used, and returns
- Add notes, tags, and target prices per ticker
- Read a personalized Yahoo Finance news feed for owned equities only
- Get unread news notifications and mark as read by opening the article

## Quick start (about 60 seconds)

```bash
git clone <repo-url>
cd CoinCraft
npm install
npm run db:init
cp .env.local.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Setup details

### Prerequisites

- Node.js 18+
- npm
- Plaid credentials

### Environment variables

Add your values in `.env.local`:

```dotenv
NEXT_PUBLIC_PLAID_ENV=sandbox
NEXT_PUBLIC_PLAID_CLIENT_NAME=CoinCraft
PLAID_ENV=sandbox
PLAID_CLIENT_ID=your_plaid_client_id_here
PLAID_SECRET=your_plaid_secret_here
DATABASE_PATH=./data/coincraft.db
NODE_ENV=development
```

Use `production` for `PLAID_ENV` and `NEXT_PUBLIC_PLAID_ENV` when using live Plaid credentials.

## How to use

1. Go to **Settings** and connect Robinhood via Plaid
2. Go back to **Dashboard** and click **Refresh**
3. Switch tabs for each account (Overall, Individual, Roth IRA, Joint, Crypto)
4. Review core holdings, options, and summary tiles
5. Add notes/tags/target prices from the holdings table
6. Open **News** to see ticker-specific headlines from Yahoo Finance

## Security

CoinCraft is designed to keep sensitive data local.

- Secrets are stored in `.env.local` and excluded by `.gitignore`
- Plaid access tokens are stored in your local SQLite database only
- Sensitive exchanges (Plaid token flow) happen server-side
- Portfolio data is stored locally in `data/coincraft.db`
- Cloning on another laptop requires re-adding local credentials

## Common commands

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run format
npm run db:init
npm run db:seed
```

## Troubleshooting

### Sync issues

- Verify Plaid credentials in `.env.local`
- Verify environment matches credentials (`sandbox` vs `production`)
- Reconnect from **Settings** if token is stale

### Fresh machine setup

Run:

```bash
npm install
npm run db:init
npm run dev
```

## License

MIT

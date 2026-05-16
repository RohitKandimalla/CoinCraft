# CoinCraft — Local-First Portfolio Tracker

A **secure, local-first** portfolio management application for tracking your investments (starting with Robinhood). Store all data locally, access advanced metrics and visualizations, and manage notes for each holding.

## About this App

CoinCraft is a personal investing dashboard built for people who want a clean, local-first way to monitor portfolio data.

- Connects to Robinhood through Plaid
- Syncs account/holdings data into a local SQLite database
- Splits views by account (Individual, Roth IRA, Joint, Crypto)
- Excludes options from core equity totals and shows them in a separate section
- Tracks key metrics like holdings value, uninvested cash, margin used, and returns
- Lets you add personal notes/tags/target prices per ticker

## Features

✅ **Local-First Security** — All data stored locally in SQLite; no cloud sync required  
✅ **Robinhood Integration** — Pull portfolio data via Plaid (beta)  
✅ **Dashboard** — Visual portfolio overview with allocation charts  
✅ **Holdings Tracker** — Comprehensive table of all equity positions  
✅ **Stock Notes** — Add tagged notes (BUY/SELL/HOLD) and target prices per ticker  
✅ **Performance Metrics** — Track unrealized gains and YOY returns  
✅ **Manual Refresh** — Pull latest data on demand  
✅ **Light/Dark Mode** — Minimalist, clean UI  
✅ **Portable** — Clone and run with minimal setup

## Tech Stack

- **Frontend:** Next.js 14 + React + TypeScript + Tailwind CSS + Recharts
- **Backend:** Next.js API Routes
- **Database:** SQLite (local file-based)
- **Data Aggregation:** Plaid (for Robinhood access)

## Prerequisites

- **Node.js** 16+ and npm
- **Plaid API credentials** (for Robinhood integration)

## Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd CoinCraft
npm install
```

### 2. Initialize the database

```bash
npm run db:init
```

This creates `data/coincraft.db` with the necessary tables.

### 3. Configure environment variables

Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Plaid credentials:

```
NEXT_PUBLIC_PLAID_ENV=sandbox
NEXT_PUBLIC_PLAID_CLIENT_NAME=CoinCraft
PLAID_CLIENT_ID=your_plaid_client_id_here
PLAID_SECRET=your_plaid_secret_here
DATABASE_PATH=./data/coincraft.db
NODE_ENV=development
```

> **⚠️ Important:** Never commit `.env.local` — it's in `.gitignore` by default.

### 4. Start the development server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

## How to Use

### Dashboard

- **Refresh**: Click the refresh button to sync latest portfolio data from Robinhood/Plaid
- **Account Tabs**: Switch between Overall, Individual, Roth IRA, Joint, and Crypto views
- **View Holdings**: Check current equity positions, allocation, unrealized gains, and average cost
- **Options Section**: View sold puts/covered calls separately from your core portfolio totals
- **Performance**: Use the Performance section to calculate YOY metrics from synced transaction history

### Stock Notes

- Click the **Edit** icon in the Holdings table for any ticker
- Add notes, tags (BUY/SELL/HOLD), and target buy/sell prices
- Tags are color-coded for quick visual identification
- Notes are saved locally to your `coincraft.db`

### Settings

- Connect/disconnect your Robinhood account via Plaid
- View database location (local storage path)

### Typical Daily Workflow

1. Open the dashboard
2. Click **Refresh** to pull latest data
3. Review account tabs and summary tiles
4. Check options separately from core holdings
5. Update notes/tags/target prices for tracked tickers

## Development

### Adding a New Provider

1. Implement a provider class in `lib/providers.ts`:

   ```typescript
   export class NewProvider implements PortfolioProvider {
     name = 'NewProvider';
     // ... implement interface methods
   }
   ```

2. Add API routes in `app/api/providers/newprovider/`

3. Update `createProvider()` factory function

### Building for Production

```bash
npm run build
npm run start
```

### Linting

```bash
npm run lint
```

## How this App is Secure

CoinCraft is designed with a local-first security model.

- **Local-first by default**: Portfolio and notes data are stored in local SQLite (`data/coincraft.db`), not in a shared cloud database
- **Secrets are not committed**: `.env.local` is ignored by Git via `.gitignore`
- **Token handling**: Plaid access tokens are stored locally only (in your local DB)
- **No browser token exposure**: Sensitive token exchange is done server-side through API routes
- **Input validation and guarded API routes**: API handlers validate inputs and return controlled errors
- **Portable but isolated**: Cloning on another machine requires re-adding local `.env.local`, which keeps credentials machine-specific

## Security Considerations

- **No secrets in Git**: All API keys, tokens, and credentials live in `.env.local`, which is ignored by `.gitignore`
- **Local storage**: Database is file-based and stays on your machine
- **HTTPS only** (future): For cloud deployment, enforce HTTPS and add API authentication
- **Token management**: Access tokens are stored only in the local database; refresh tokens are handled securely
- **Input validation**: All API inputs are validated before database operations

## Troubleshooting

### Database not found

Run `npm run db:init` to create the database and tables.

### Portfolio data not syncing

1. Check that `.env.local` has valid Plaid credentials
2. Verify Plaid connection status in Settings
3. Check browser console for API errors

### Styles not loading correctly

Ensure Tailwind CSS is configured properly. If issues persist:

```bash
npm install
npm run dev
```

## Contributing

This is a personal project but designed with cloud deployment in mind. Feel free to fork and adapt for your needs.

## License

MIT

---

**Made with ❤️ for secure, local-first investing.**

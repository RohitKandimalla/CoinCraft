# CoinCraft

A custom Financial tracking application

# CoinCraft — Local-First Portfolio Tracker

A **secure, local-first** portfolio management application for tracking your investments (starting with Robinhood). Store all data locally, access advanced metrics and visualizations, and manage notes for each holding.

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

## Usage

### Dashboard

- **Refresh**: Click the refresh button to sync latest portfolio data from Robinhood/Plaid
- **View Holdings**: Check current equity positions, allocation, and unrealized gains
- **Cash Accounts**: See your joint/savings account balances at a glance

### Stock Notes

- Click the **Edit** icon in the Holdings table for any ticker
- Add notes, tags (BUY/SELL/HOLD), and target buy/sell prices
- Tags are color-coded for quick visual identification
- Notes are saved locally to your `coincraft.db`

### Settings

- Connect/disconnect your Robinhood account via Plaid
- View database location (local storage path)

## API Endpoints

| Endpoint                          | Method  | Purpose                                |
| --------------------------------- | ------- | -------------------------------------- |
| `/api/providers/plaid/exchange`   | POST    | Exchange public token for access token |
| `/api/providers/plaid/status`     | GET     | Check Plaid connection status          |
| `/api/providers/plaid/disconnect` | POST    | Disconnect Robinhood account           |
| `/api/providers/plaid/portfolio`  | GET     | Fetch current portfolio data           |
| `/api/sync`                       | POST    | Manually sync portfolio with Robinhood |
| `/api/notes/[ticker]`             | GET/PUT | Retrieve or save notes for a ticker    |

## Development

### Project Structure

```
CoinCraft/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── page.tsx           # Dashboard
│   ├── settings/          # Settings page
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── Dashboard*
│   ├── PortfolioSummary
│   ├── AllocationChart
│   ├── HoldingsTable
│   ├── NotesModal
│   └── Navigation
├── lib/                   # Utilities
│   ├── db.ts             # Database connection
│   └── providers.ts      # Provider abstraction
├── types/                # TypeScript types
├── scripts/              # Setup scripts
│   └── init-db.js       # Database initialization
├── data/                 # Local SQLite database
└── .env.local.*         # Environment config (NOT committed)
```

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

## Data Model

### Holdings Table

Stores current equity positions with pricing and performance data.

### Portfolio Snapshots

Daily snapshots of portfolio value for historical tracking and YOY calculations.

### Stock Notes

User-created notes per ticker with tags and target prices.

### Sync History

Logs of all data synchronization attempts with errors.

### Provider Tokens

Secure storage of OAuth tokens and account IDs (local database only).

## Security Considerations

- **No secrets in Git**: All API keys, tokens, and credentials live in `.env.local`, which is ignored by `.gitignore`
- **Local storage**: Database is file-based and stays on your machine
- **HTTPS only** (future): For cloud deployment, enforce HTTPS and add API authentication
- **Token management**: Access tokens are stored only in the local database; refresh tokens are handled securely
- **Input validation**: All API inputs are validated before database operations

## Roadmap

### Phase 1 (Current)

- [x] Core Next.js + SQLite foundation
- [x] Plaid integration scaffold
- [x] Dashboard with allocation chart
- [x] Stock notes with tags and target prices
- [x] Manual refresh + dashboard refresh on load
- [x] Light/dark theme

### Phase 2 (Upcoming)

- [ ] Real Plaid holdings API integration (test with sandbox)
- [ ] YOY return calculations from historical snapshots
- [ ] Sector/industry grouping
- [ ] Performance charting (returns over time)
- [ ] CSV export

### Phase 3 (Multi-user/Cloud)

- [ ] User authentication
- [ ] Multi-account support
- [ ] Cloud deployment (AWS, Vercel, etc.)
- [ ] Real-time sync option
- [ ] Mobile companion app

### Phase 4 (Advanced)

- [ ] Support for other brokers (Charles Schwab, E\*TRADE, etc.)
- [ ] Options and crypto support
- [ ] Tax-loss harvesting suggestions
- [ ] Dividends tracking and forecasting

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

# CoinCraft Setup & Integration Guide

## ✅ Project Successfully Initialized!

Your CoinCraft local-first portfolio tracker is now set up and ready. Below is a complete guide for getting started with Plaid integration and using the app.

---

## 1. Getting Started

### Prerequisites
- ✅ Node.js 16+ and npm installed
- ✅ Git repository initialized
- ✅ All dependencies installed
- ✅ SQLite database initialized at `data/coincraft.db`

### Quick Start

```bash
# Navigate to project
cd CoinCraft

# Install dependencies (already done)
npm install

# Initialize database (already done)
npm run db:init

# Start development server
npm run dev
```

The app will be available at **http://localhost:3000**

---

## 2. Plaid Integration Setup

### Step 1: Create a Plaid Account

1. Go to [Plaid Dashboard](https://dashboard.plaid.com/)
2. Sign up for a free developer account
3. Navigate to **API Keys** in your dashboard
4. Copy your:
   - `client_id`
   - `secret`

### Step 2: Configure Environment Variables

Edit `.env.local` in the project root:

```bash
NEXT_PUBLIC_PLAID_ENV=sandbox
NEXT_PUBLIC_PLAID_CLIENT_NAME=CoinCraft
PLAID_CLIENT_ID=your_plaid_client_id_here
PLAID_SECRET=your_plaid_secret_here
DATABASE_PATH=./data/coincraft.db
NODE_ENV=development
```

⚠️ **IMPORTANT:** `.env.local` is already in `.gitignore` — never commit it.

### Step 3: Add Plaid Link Library (Optional for MVP)

For now, the Plaid integration is scaffolded. To fully enable the Plaid link flow, you'll need to install the Plaid Link library:

```bash
npm install react-plaid-link
```

Then update the Settings page to use it:

```typescript
// app/settings/page.tsx
import { usePlaidLink } from 'react-plaid-link';

// ... use usePlaidLink to initiate the link flow
```

---

## 3. Current Architecture Overview

### Database Schema

Your SQLite database (`data/coincraft.db`) has the following tables:

| Table | Purpose |
|-------|---------|
| `holdings` | Current equity positions |
| `portfolio_snapshots` | Daily portfolio value snapshots |
| `stock_notes` | User notes with tags and target prices |
| `sync_history` | Log of all sync attempts |
| `provider_tokens` | OAuth tokens from Plaid (local only) |
| `accounts` | Bank/investment accounts from Plaid |
| `yoy_returns` | Year-over-year performance calculations |

### API Endpoints

#### Portfolio Management
- `GET /api/providers/plaid/portfolio` — Fetch current portfolio
- `POST /api/sync` — Manually sync with Robinhood
- `GET /api/providers/plaid/status` — Check connection status

#### Plaid Integration
- `POST /api/providers/plaid/exchange` — Exchange public token for access token
- `POST /api/providers/plaid/disconnect` — Disconnect account

#### Stock Notes
- `GET /api/notes/[ticker]` — Get notes for a ticker
- `PUT /api/notes/[ticker]` — Save/update notes

### Component Structure

| Component | Purpose |
|-----------|---------|
| `PortfolioSummary` | Dashboard cards (value, gains, allocation) |
| `AllocationChart` | Pie chart of equity weights |
| `HoldingsTable` | Sortable table of all holdings |
| `NotesModal` | Add/edit stock notes and tags |
| `Navigation` | Top nav with theme toggle |
| `ThemeProvider` | Light/dark mode support |

---

## 4. Testing the App Locally

### Manual Testing Workflow

#### 1. Start the Dev Server
```bash
npm run dev
```

#### 2. Populate Test Data

Create test holdings by calling the API directly or using a seed script. For MVP, you can manually insert test data into the database:

```bash
# Open SQLite CLI
sqlite3 data/coincraft.db

# Insert sample holdings
INSERT INTO holdings (ticker, name, quantity, current_price, market_value, cost_basis, unrealized_gain, unrealized_gain_pct, created_at, updated_at)
VALUES ('AAPL', 'Apple Inc.', 10, 180.50, 1805.00, 1500.00, 305.00, 20.33, datetime('now'), datetime('now'));

INSERT INTO holdings (ticker, name, quantity, current_price, market_value, cost_basis, unrealized_gain, unrealized_gain_pct, created_at, updated_at)
VALUES ('MSFT', 'Microsoft Corp.', 5, 420.00, 2100.00, 1800.00, 300.00, 16.67, datetime('now'), datetime('now'));

INSERT INTO holdings (ticker, name, quantity, current_price, market_value, cost_basis, unrealized_gain, unrealized_gain_pct, created_at, updated_at)
VALUES ('TSLA', 'Tesla Inc.', 2, 250.00, 500.00, 600.00, -100.00, -16.67, datetime('now'), datetime('now'));

# Insert cash/joint account
INSERT INTO accounts (account_id, account_name, account_type, balance, provider, created_at, updated_at)
VALUES ('joint_001', 'Savings', 'joint', 15000.00, 'manual', datetime('now'), datetime('now'));
```

#### 3. Visit the Dashboard
- Go to **http://localhost:3000**
- You should see:
  - Total portfolio value
  - Equity allocation pie chart
  - Holdings table with AAPL, MSFT, TSLA
  - Unrealized gains/losses

#### 4. Test Stock Notes
- Click the **Edit** icon on any holding
- Add a note: "Strong growth potential"
- Tag as **BUY**
- Set target buy price: $150
- Save

#### 5. Test Manual Refresh
- Click the **Refresh** button
- The dashboard should re-fetch from `/api/providers/plaid/portfolio`

---

## 5. Next Steps: Plaid Holdings Integration

### What's Needed to Connect Real Robinhood Data

Currently, the app is **scaffolded but not fully connected** to Plaid's Holdings API. To complete the integration:

#### 1. **Set up Plaid Sandbox Account**
   - Use the provided credentials for sandbox testing
   - Demo data is available in Plaid dashboard

#### 2. **Update `/api/providers/plaid/portfolio/route.ts`**
   
Currently it reads from your local database. To fetch real data:

```typescript
// Get access token from DB
const token = await db.get(
  'SELECT access_token FROM provider_tokens WHERE provider = ?',
  ['plaid']
);

// Call Plaid Holdings API
const holdingsResponse = await fetch('https://sandbox.plaid.com/investments/holdings/get', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_id: clientId,
    secret: secret,
    access_token: token.access_token,
  }),
});

// Parse response and normalize holdings
// Save to DB
```

#### 3. **Implement Plaid Link Flow**
   
Update `/app/settings/page.tsx` to use `react-plaid-link`:

```typescript
import { usePlaidLink } from 'react-plaid-link';

export default function SettingsPage() {
  const { open, ready } = usePlaidLink({
    token: linkToken, // from backend
    onSuccess: (publicToken) => {
      // Exchange for access token
      fetch('/api/providers/plaid/exchange', {
        method: 'POST',
        body: JSON.stringify({ public_token: publicToken }),
      });
    },
  });

  return (
    <button onClick={() => open()} disabled={!ready}>
      Connect Robinhood
    </button>
  );
}
```

#### 4. **Generate Link Token**

Add a new API route `/api/providers/plaid/link-token`:

```typescript
// POST
const linkResponse = await fetch('https://sandbox.plaid.com/link/token/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_id: clientId,
    secret: secret,
    user: { client_user_id: 'user-id' },
    client_name: 'CoinCraft',
    language: 'en',
    products: ['investments'],
    country_codes: ['US'],
    institution_id: 'ins_3',  // Robinhood
  }),
});

return linkResponse.json().link_token;
```

---

## 6. YOY Returns Implementation

### Current State
- Table `yoy_returns` is created but not yet populated

### Implementation Plan

Add a new API route `/api/metrics/yoy-returns`:

```typescript
// Calculations based on historical snapshots
export async function GET() {
  const db = await getDatabase();
  
  // Group snapshots by year
  // Compare start and end values
  // Calculate returns
  
  return NextResponse.json({
    2025: { return: 12.5 },
    2026: { return: 8.3 },
  });
}
```

---

## 7. Deployment & Production Setup

### Building for Production

```bash
npm run build
npm start
```

### For Cloud Deployment (Future)

When ready to deploy to cloud (Vercel, AWS, etc.):

1. **Move database to cloud** (PostgreSQL, etc.)
2. **Add user authentication** (NextAuth.js)
3. **Secure API keys** (environment secrets)
4. **Enable HTTPS** (automatic on most platforms)
5. **Set up monitoring** (LogRocket, Sentry, etc.)

### Local → Cloud Path

The app is already structured for multi-user deployment:
- API routes are stateless
- Database is abstracted
- No hardcoded user assumptions

---

## 8. Troubleshooting

### Dev Server Won't Start
```bash
# Kill any existing process
lsof -ti:3000 | xargs kill -9

# Clear Next.js cache
rm -rf .next

# Restart
npm run dev
```

### Database Errors
```bash
# Reinitialize database
npm run db:init

# Verify database
sqlite3 data/coincraft.db ".tables"
```

### Styles Not Loading
```bash
# Clear and rebuild
rm -rf .next node_modules/.cache
npm run dev
```

### Plaid API Errors
- Verify credentials in `.env.local`
- Check Plaid dashboard for API rate limits
- Ensure sandbox/production environment matches

---

## 9. Development Tips

### Hot Reload
- The app auto-reloads on file changes (Next.js built-in)
- Changes to API routes require page refresh

### Debugging
- Open **http://localhost:3000** and check browser console
- View server logs in the terminal running `npm run dev`
- Query the database with: `sqlite3 data/coincraft.db`

### Adding New Features

1. Create components in `/components`
2. Create API routes in `/app/api`
3. Update types in `/types/index.ts`
4. Update database schema if needed (add migrations later)

---

## 10. Feature Roadmap

### Phase 1 MVP ✅
- [x] Local SQLite storage
- [x] Dashboard with summary cards
- [x] Portfolio allocation chart
- [x] Holdings table
- [x] Stock notes with tags
- [x] Light/dark theme
- [x] Manual refresh button
- [ ] Real Plaid integration

### Phase 2 (Next)
- [ ] Real Plaid Holdings API integration
- [ ] YOY returns calculation and display
- [ ] Performance charts over time
- [ ] CSV export
- [ ] Dividend tracking

### Phase 3 (Multi-User)
- [ ] User authentication
- [ ] Multi-account support
- [ ] Cloud deployment
- [ ] Mobile app companion

---

## Questions & Support

For issues or questions:
1. Check the main README.md
2. Review API endpoint documentation above
3. Check browser console and server logs
4. Verify `.env.local` has correct credentials

---

**Happy tracking! 🚀**


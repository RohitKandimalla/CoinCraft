# CoinCraft 🚀 Quick Start Guide

Welcome to **CoinCraft** — your local-first portfolio tracker!

## What You Have

✅ **Fully initialized Next.js + React + Tailwind CSS app**  
✅ **SQLite database ready** (`data/coincraft.db`)  
✅ **Dashboard with real-time portfolio view**  
✅ **Minimalist light/dark theme**  
✅ **Stock notes with BUY/SELL/HOLD tags**  
✅ **Manual refresh button**  
✅ **100% local — no cloud required**  

---

## Start Using It Right Now

### 1. Start the dev server (if not already running)

```bash
cd CoinCraft
npm run dev
```

The app will be available at: **http://localhost:3000**

### 2. Load test data (optional)

Pre-populate the dashboard with sample holdings:

```bash
npm run db:seed
```

This adds 5 sample stocks (AAPL, MSFT, TSLA, GOOGL, AMZN) with realistic gains/losses and a $15k savings account.

### 3. Open the app

Visit **http://localhost:3000** in your browser.

You should see:
- **Dashboard** with total portfolio value (~$20k)
- **Allocation chart** showing equity weights
- **Holdings table** with sample stocks
- **Cash/Savings** box with $15,000
- **Manual refresh button** (top right)

### 4. Add stock notes

Click the **Edit icon** (pencil) on any holding:
- Add a note: e.g., "Strong tech moat, DCA on dips"
- Tag it: BUY / SELL / HOLD
- Set target prices
- Save

Notes persist in your local database.

### 5. Toggle light / dark mode

Click the **Moon icon** in the top navigation.

---

## Key Features Summary

### Dashboard View
| Component | What It Shows |
|-----------|---------------|
| **Portfolio Cards** | Total value, equity value, cash, unrealized gains |
| **Allocation Chart** | Pie chart of equity weights |
| **Holdings Table** | All stocks with price, quantity, gain %, portfolio % |
| **Cash Box** | Your savings/joint accounts |
| **Refresh Button** | Manual sync with portfolio source |

### Stock Notes
- Add **freeform text notes**
- **Color-coded tags**: BUY (green), SELL (red), HOLD (blue)
- **Target buy price** for entries
- **Target sell price** for exits
- All stored locally in SQLite

### Theme
- **Light mode** — clean, minimalist
- **Dark mode** — easy on the eyes
- Toggle anytime via the Moon/Sun icon

---

## Next Steps: Connect Real Data

The app is ready for **Plaid integration** to pull real Robinhood data. See `SETUP_GUIDE.md` for:

1. Creating a Plaid account
2. Configuring API credentials
3. Connecting your Robinhood holdings
4. Setting up automated syncs

For now, the dashboard works **100% locally** with test data.

---

## Project Structure

```
CoinCraft/
├── app/                      # Next.js app
│   ├── page.tsx             # Dashboard
│   ├── settings/page.tsx    # Settings (Plaid setup)
│   ├── api/                 # API endpoints
│   │   ├── sync/           # Manual portfolio sync
│   │   ├── notes/          # Stock notes CRUD
│   │   └── providers/      # Plaid integration
│   └── layout.tsx          # Root layout
├── components/              # React components
│   ├── PortfolioSummary    # Dashboard cards
│   ├── AllocationChart     # Pie chart
│   ├── HoldingsTable       # Main table
│   ├── NotesModal          # Note editor
│   └── Navigation          # Top nav + theme
├── lib/                    # Utilities
│   ├── db.ts              # Database connection
│   └── providers.ts       # Provider abstraction
├── types/                 # TypeScript types
├── scripts/               # Helper scripts
│   ├── init-db.js        # Initialize DB
│   └── seed-db.js        # Seed test data
├── data/
│   └── coincraft.db      # SQLite database (local)
└── .env.local            # Secrets (NOT in git)
```

---

## Commands

```bash
# Development
npm run dev                # Start dev server (port 3000)
npm run build              # Build for production
npm start                  # Run production build

# Database
npm run db:init           # Initialize empty database
npm run db:seed           # Populate with test data

# Linting
npm run lint              # Check code quality
```

---

## Important Security Notes

✅ **Secrets are protected**
- `.env.local` is in `.gitignore`
- All API keys stay local
- No credentials pushed to Git

✅ **Data is local**
- SQLite database lives on your machine
- No cloud sync by default
- Easy to backup/restore

✅ **For production** (future)
- Add user authentication
- Move database to secure server
- Implement audit logging

---

## Troubleshooting

### App won't load?
```bash
# Kill any zombie processes
lsof -ti:3000 | xargs kill -9

# Restart dev server
npm run dev
```

### Database error?
```bash
# Reinitialize database
npm run db:init
npm run db:seed
```

### Styles broken?
```bash
# Clear cache and restart
rm -rf .next
npm run dev
```

---

## Documentation

- **README.md** — Full project overview and architecture
- **SETUP_GUIDE.md** — Detailed Plaid integration instructions
- **QUICK_START.md** — This file

---

## What's Next?

1. **Test the MVP** — Play with the dashboard, add notes
2. **Set up Plaid** — Follow `SETUP_GUIDE.md` to connect real data
3. **Add more features** — Refer to the roadmap in README.md
4. **Deploy** — Eventually publish to cloud for friends/peers

---

## Support & Issues

- Check browser **Console** for frontend errors
- Check terminal for backend logs
- Review `.env.local` for missing credentials
- Verify SQLite connection: `sqlite3 data/coincraft.db ".tables"`

---

## Have Fun! 🎉

Your secure, local-first portfolio tracker is ready. Happy investing!

**All your data. Always local. Complete control.**


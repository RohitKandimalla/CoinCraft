const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../data');
const dbPath = path.join(dbDir, 'coincraft.db');

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database at', dbPath);
});

// Create tables
db.serialize(() => {
  // Holdings table - stores current holdings
  db.run(
    `
    CREATE TABLE IF NOT EXISTS holdings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT UNIQUE NOT NULL,
      name TEXT,
      provider_account_id TEXT,
      asset_type TEXT,
      sector TEXT,
      industry TEXT,
      quantity REAL NOT NULL,
      current_price REAL NOT NULL,
      average_price REAL,
      market_value REAL NOT NULL,
      cost_basis REAL,
      unrealized_gain REAL,
      unrealized_gain_pct REAL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
    (err) => {
      if (err) console.error('Error creating holdings table:', err);
      else console.log('✓ Holdings table ready');
    }
  );

  // Portfolio snapshots - for historical tracking
  db.run(
    `
    CREATE TABLE IF NOT EXISTS portfolio_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total_value REAL NOT NULL,
      equity_value REAL NOT NULL,
      cash_value REAL NOT NULL,
      total_unrealized_gain REAL,
      total_unrealized_gain_pct REAL,
      snapshot_date DATE UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
    (err) => {
      if (err) console.error('Error creating portfolio_snapshots table:', err);
      else console.log('✓ Portfolio snapshots table ready');
    }
  );

  // Portfolio snapshots by dashboard view (overall/account tabs)
  db.run(
    `
    CREATE TABLE IF NOT EXISTS portfolio_snapshots_by_view (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      view_key TEXT NOT NULL,
      total_value REAL NOT NULL,
      equity_value REAL NOT NULL,
      cash_value REAL NOT NULL,
      snapshot_date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(view_key, snapshot_date)
    )
  `,
    (err) => {
      if (err) console.error('Error creating portfolio_snapshots_by_view table:', err);
      else console.log('✓ Portfolio snapshots by view table ready');
    }
  );

  // Stock notes
  db.run(
    `
    CREATE TABLE IF NOT EXISTS stock_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT UNIQUE NOT NULL,
      note TEXT,
      tags TEXT,
      target_buy_price REAL,
      target_sell_price REAL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(ticker) REFERENCES holdings(ticker)
    )
  `,
    (err) => {
      if (err) console.error('Error creating stock_notes table:', err);
      else console.log('✓ Stock notes table ready');
    }
  );

  // Sync history - for tracking Plaid syncs
  db.run(
    `
    CREATE TABLE IF NOT EXISTS sync_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      last_synced_at TIMESTAMP,
      next_sync_at TIMESTAMP,
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
    (err) => {
      if (err) console.error('Error creating sync_history table:', err);
      else console.log('✓ Sync history table ready');
    }
  );

  // Provider tokens - store Plaid access tokens securely
  db.run(
    `
    CREATE TABLE IF NOT EXISTS provider_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT UNIQUE NOT NULL,
      access_token TEXT NOT NULL,
      item_id TEXT,
      account_ids TEXT,
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
    (err) => {
      if (err) console.error('Error creating provider_tokens table:', err);
      else console.log('✓ Provider tokens table ready');
    }
  );

  // Account metadata (Joint account, savings, etc)
  db.run(
    `
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT UNIQUE NOT NULL,
      account_name TEXT NOT NULL,
      account_type TEXT NOT NULL,
      account_category TEXT,
      balance REAL,
      uninvested_cash REAL DEFAULT 0,
      margin_used REAL DEFAULT 0,
      provider TEXT,
      provider_account_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
    (err) => {
      if (err) console.error('Error creating accounts table:', err);
      else console.log('✓ Accounts table ready');
    }
  );

  // Holdings split by account - enables per-account tabs
  db.run(
    `
    CREATE TABLE IF NOT EXISTS holdings_by_account (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_account_id TEXT NOT NULL,
      account_name TEXT,
      account_category TEXT,
      asset_type TEXT,
      sector TEXT,
      industry TEXT,
      ticker TEXT NOT NULL,
      name TEXT,
      quantity REAL NOT NULL,
      current_price REAL NOT NULL,
      average_price REAL,
      market_value REAL NOT NULL,
      cost_basis REAL,
      unrealized_gain REAL,
      unrealized_gain_pct REAL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
    (err) => {
      if (err) console.error('Error creating holdings_by_account table:', err);
      else console.log('✓ Holdings-by-account table ready');
    }
  );


  // Manual contribution overrides per dashboard tab/view
  db.run(
    `
    CREATE TABLE IF NOT EXISTS contribution_overrides (
      view_key TEXT PRIMARY KEY,
      value REAL NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
    (err) => {
      if (err) console.error('Error creating contribution_overrides table:', err);
      else console.log('✓ Contribution overrides table ready');
    }
  );

  // Auto-detected contribution/deposit events (deduped by transaction ID)
  db.run(
    `
    CREATE TABLE IF NOT EXISTS contribution_deposit_events (
      transaction_id TEXT PRIMARY KEY,
      view_key TEXT NOT NULL,
      amount REAL NOT NULL,
      transaction_date DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
    (err) => {
      if (err) console.error('Error creating contribution_deposit_events table:', err);
      else console.log('✓ Contribution deposit events table ready');
    }
  );

  // Normalized external cashflows used for calendar-year return calculations
  db.run(
    `
    CREATE TABLE IF NOT EXISTS investment_cashflows (
      transaction_id TEXT PRIMARY KEY,
      view_key TEXT NOT NULL,
      amount REAL NOT NULL,
      transaction_date DATE NOT NULL,
      classification TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
    (err) => {
      if (err) console.error('Error creating investment_cashflows table:', err);
      else console.log('✓ Investment cashflows table ready');
    }
  );

  // Cached ticker metadata from public market data providers
  db.run(
    `
    CREATE TABLE IF NOT EXISTS security_metadata (
      ticker TEXT PRIMARY KEY,
      sector TEXT,
      industry TEXT,
      source TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
    (err) => {
      if (err) console.error('Error creating security_metadata table:', err);
      else console.log('✓ Security metadata table ready');
    }
  );

  // Persisted Yahoo Finance news feed for owned equities
  db.run(
    `
    CREATE TABLE IF NOT EXISTS equity_news_articles (
      url TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      publisher TEXT,
      source TEXT NOT NULL DEFAULT 'yahoo_finance',
      published_at TEXT,
      discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_read INTEGER NOT NULL DEFAULT 0,
      read_at TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
    (err) => {
      if (err) console.error('Error creating equity_news_articles table:', err);
      else console.log('✓ Equity news articles table ready');
    }
  );

  db.run(
    `
    CREATE TABLE IF NOT EXISTS equity_news_mentions (
      article_url TEXT NOT NULL,
      ticker TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(article_url, ticker),
      FOREIGN KEY(article_url) REFERENCES equity_news_articles(url)
    )
  `,
    (err) => {
      if (err) console.error('Error creating equity_news_mentions table:', err);
      else console.log('✓ Equity news mentions table ready');
    }
  );


  console.log('✓ Database initialization complete');
});

db.close();

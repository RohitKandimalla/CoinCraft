const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/coincraft.db');
const db = new sqlite3.Database(dbPath);

const sampleHoldings = [
  {
    ticker: 'AAPL',
    name: 'Apple Inc.',
    quantity: 10,
    current_price: 180.5,
    market_value: 1805.0,
    cost_basis: 1500.0,
    unrealized_gain: 305.0,
    unrealized_gain_pct: 20.33,
  },
  {
    ticker: 'MSFT',
    name: 'Microsoft Corporation',
    quantity: 5,
    current_price: 420.0,
    market_value: 2100.0,
    cost_basis: 1800.0,
    unrealized_gain: 300.0,
    unrealized_gain_pct: 16.67,
  },
  {
    ticker: 'TSLA',
    name: 'Tesla Inc.',
    quantity: 2,
    current_price: 250.0,
    market_value: 500.0,
    cost_basis: 600.0,
    unrealized_gain: -100.0,
    unrealized_gain_pct: -16.67,
  },
  {
    ticker: 'GOOGL',
    name: 'Alphabet Inc.',
    quantity: 3,
    current_price: 140.25,
    market_value: 420.75,
    cost_basis: 350.0,
    unrealized_gain: 70.75,
    unrealized_gain_pct: 20.21,
  },
  {
    ticker: 'AMZN',
    name: 'Amazon.com Inc.',
    quantity: 1,
    current_price: 185.0,
    market_value: 185.0,
    cost_basis: 200.0,
    unrealized_gain: -15.0,
    unrealized_gain_pct: -7.5,
  },
];

const sampleAccounts = [
  {
    account_id: 'joint_001',
    account_name: 'Savings Account',
    account_type: 'joint',
    balance: 15000.0,
    provider: 'manual',
  },
];

db.serialize(() => {
  console.log('Seeding database with sample data...\n');

  // Clear existing holdings
  db.run('DELETE FROM holdings', (err) => {
    if (err) console.error('Error clearing holdings:', err);
  });

  // Insert sample holdings
  const stmt = db.prepare(`
    INSERT INTO holdings 
    (ticker, name, quantity, current_price, market_value, cost_basis, unrealized_gain, unrealized_gain_pct, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  sampleHoldings.forEach((holding) => {
    stmt.run([
      holding.ticker,
      holding.name,
      holding.quantity,
      holding.current_price,
      holding.market_value,
      holding.cost_basis,
      holding.unrealized_gain,
      holding.unrealized_gain_pct,
    ]);
  });

  stmt.finalize();

  // Insert portfolio snapshot
  const totalValue = sampleHoldings.reduce((sum, h) => sum + h.market_value, 0) + 15000;
  const equityValue = sampleHoldings.reduce((sum, h) => sum + h.market_value, 0);

  db.run(
    `INSERT OR IGNORE INTO portfolio_snapshots 
     (total_value, equity_value, cash_value, snapshot_date, created_at)
     VALUES (?, ?, ?, date('now'), datetime('now'))`,
    [totalValue, equityValue, 15000.0]
  );

  // Insert accounts
  sampleAccounts.forEach((account) => {
    db.run(
      `INSERT OR REPLACE INTO accounts 
       (account_id, account_name, account_type, balance, provider, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        account.account_id,
        account.account_name,
        account.account_type,
        account.balance,
        account.provider,
      ]
    );
  });

  // Insert sample notes for each holding
  sampleHoldings.forEach((holding, idx) => {
    const tags =
      idx % 3 === 0
        ? JSON.stringify(['BUY'])
        : idx % 3 === 1
          ? JSON.stringify(['HOLD'])
          : JSON.stringify(['SELL']);
    db.run(
      `INSERT OR IGNORE INTO stock_notes 
       (ticker, note, tags, target_buy_price, target_sell_price, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        holding.ticker,
        `Sample note for ${holding.name}. Great long-term investment opportunity.`,
        tags,
        holding.current_price * 0.9,
        holding.current_price * 1.1,
      ]
    );
  });

  console.log('✓ Seeded with sample data:');
  console.log(`  - ${sampleHoldings.length} holdings`);
  console.log(`  - ${sampleAccounts.length} accounts`);
  console.log(`  - Total portfolio value: $${totalValue.toLocaleString()}`);
  console.log(`  - Equity value: $${equityValue.toLocaleString()}`);
  console.log(`  - Cash: $15,000.00\n`);
});

db.close();

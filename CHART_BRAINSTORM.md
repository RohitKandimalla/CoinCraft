# CoinCraft: Additional Charts & Visualizations Brainstorm

## Current Charts
- ✅ Portfolio Allocation (Pie Chart) - Shows % breakdown of holdings
- ✅ Holdings Table - Detailed view with ticker, price, gain %, gain $
- ✅ Portfolio Summary Cards - Key metrics (total value, gain, cash)

---

## Proposed Charts & Visualizations

### 1. **Performance Over Time** (Line Chart)
- **What it shows**: Portfolio value trajectory over time
- **Data points**: Daily/weekly snapshots of total portfolio value
- **Benefits**: Identify trends, seasonal patterns, growth momentum
- **Implementation**: Track `portfolio_snapshots` table (already in DB schema)
- **Use case**: "I want to see if my portfolio is on an upward or downward trend"

### 2. **Gain/Loss Distribution** (Bar Chart)
- **What it shows**: How many holdings are up vs down, bucketed by gain ranges
- **Buckets**: 
  - Highly profitable: +50% and up
  - Very positive: +25% to +50%
  - Positive: +10% to +25%
  - Slightly positive: 0% to +10%
  - Slightly negative: -10% to 0%
  - Negative: -25% to -10%
  - Very negative: -50% to -25%
  - Highly negative: -50% and below
- **Benefits**: Quick visual of portfolio health, identify problem areas
- **Use case**: "How many of my stocks are losing money?"

### 3. **Sector/Asset Type Breakdown** (Donut Chart)
- **What it shows**: Portfolio allocation by sector (tech, healthcare, crypto, etc.)
- **Data needed**: Add sector classification to holdings
- **Benefits**: Identify concentration risk, see diversification
- **Use case**: "Am I too heavy in tech stocks?"

### 4. **Contribution vs Growth** (Stacked Area Chart)
- **What it shows**: How much portfolio growth came from contributions vs market gains
- **Calculation**: 
  - `Net Contributions` (from Plaid)
  - `Current Value - Contributions = Gains`
- **Benefits**: Understand if wealth is from savings discipline or market returns
- **Use case**: "Is my portfolio growing because I keep adding money or because my investments are doing well?"

### 5. **Top Gainers & Losers** (Horizontal Bar Chart)
- **What it shows**: Top 5 performers and worst 5 performers
- **Data**: Ticker, current gain %, gain $
- **Benefits**: Quick identification of star performers and problem holdings
- **Use case**: "Which stocks are killing it and which should I reconsider?"

### 6. **Price Volatility** (Scatter Plot or Box Plot)
- **What it shows**: Stock price volatility over recent period
- **Metrics**: Price range, standard deviation from average
- **Benefits**: Identify risky vs stable holdings
- **Use case**: "Which of my holdings are most volatile?"

### 7. **Risk vs Reward Matrix** (Bubble Chart)
- **What it shows**: Each holding plotted as:
  - X-axis: Risk (volatility)
  - Y-axis: Return (gain %)
  - Bubble size: Position size
- **Benefits**: Visualize risk-adjusted returns for each position
- **Use case**: "Which stocks give me the best return for the risk I'm taking?"

### 8. **Entry Price vs Current Price** (Candlestick or Column Chart)
- **What it shows**: For each holding, compare entry price to current price
- **Data**: Average entry price vs current price
- **Benefits**: See which positions have deviated most from purchase price
- **Use case**: "Which holdings have moved the most since I bought them?"

### 9. **Account Comparison Dashboard** (Multi-view)
- **What it shows**: Overlay of Individual, Roth IRA, Joint, Crypto account performance
- **Metrics**: 
  - Total value by account
  - Gain by account
  - Allocation by account
  - Performance comparison (which account is doing better)
- **Benefits**: Compare account strategies, optimize tax-advantaged accounts
- **Use case**: (Already supported) "How is my Roth performing vs my Individual account?"

### 10. **Cash Position History** (Area Chart)
- **What it shows**: Uninvested cash over time
- **Data**: Historical cash balance (from portfolio_snapshots)
- **Benefits**: See if you're deploying capital or accumulating
- **Use case**: "Am I sitting on too much cash? Is my cash position growing?"

### 11. **Holding Duration Heatmap** (Visual Timeline)
- **What it shows**: How long you've held each stock (created_at vs current)
- **Colors**: Red (recent) → Green (held for years)
- **Benefits**: Identify tax-loss harvesting opportunities, long-term holds
- **Use case**: "Which positions have I held the longest?"

### 12. **Average Cost vs Market Value** (Waterfall Chart)
- **What it shows**: Starting with total cost basis, then gains/losses gets you to current value
- **Benefits**: Clear visualization of total portfolio profit/loss breakdown
- **Use case**: "Where did all my gains come from?"

### 13. **Dividend Income Tracker** (Line Chart)
- **What it shows**: Cumulative dividend payments over time
- **Data**: Would need dividend data from Plaid or manual entry
- **Benefits**: Track passive income generation
- **Use case**: "How much passive income is my portfolio generating?"

### 14. **Portfolio Concentration Analysis** (Pareto/80-20 Chart)
- **What it shows**: Cumulative allocation % vs number of holdings
- **Insight**: Often 20% of holdings = 80% of portfolio value
- **Benefits**: Identify over-concentration risk
- **Use case**: "How much of my portfolio depends on a few stocks?"

### 15. **Target vs Actual Allocation** (Side-by-side Pie/Bar)
- **What it shows**: Current allocation vs your target allocation
- **Use case**: "How far am I from my desired portfolio weightings?"
- **Note**: Would need user to set target allocations first

### 16. **Monthly/Quarterly Returns** (Bar Chart)
- **What it shows**: Returns broken down by time period
- **Data**: Calculate from portfolio snapshots taken at period ends
- **Benefits**: See consistent vs erratic performance
- **Use case**: "Which months/quarters did I do best?"

### 17. **Stock vs Cash vs Crypto Composition** (Treemap)
- **What it shows**: Hierarchical view: Accounts → Asset Types → Holdings
- **Benefits**: Quickly see complex portfolio structure
- **Use case**: "How much of my portfolio is in crypto vs stocks vs cash?"

---

## Quick Implementation Priority

### Phase 1 (High Impact, Low Effort)
1. **Top Gainers & Losers** - Just sort existing holdings
2. **Gain/Loss Distribution** - Bucket holdings, simple bar chart
3. **Performance Over Time** - Plot existing portfolio_snapshots

### Phase 2 (Medium Impact, Medium Effort)
4. **Contribution vs Growth** - Calculate from portfolio data
5. **Risk vs Reward Matrix** - Need volatility calculations
6. **Monthly/Quarterly Returns** - Use existing snapshots

### Phase 3 (Nice to Have)
7. **Sector Breakdown** - Requires data enrichment
8. **Dividend Tracker** - Requires new data source
9. **Target Allocation** - Requires user settings

---

## Data Requirements

### Already Available
- ✅ Holdings (ticker, quantity, price, avg cost, gain, gain %)
- ✅ Portfolio snapshots (historical values)
- ✅ Cash position

### Need to Add
- ⚠️ Sector classification (can use Yahoo Finance API)
- ⚠️ Historical price volatility
- ⚠️ Dividend data (if desired)
- ⚠️ User target allocation preferences

---

## Recommended Next Steps

1. **Implement Performance Over Time first** - Most valuable, minimal effort with existing data
2. **Add Top Gainers/Losers** - Quick win for decision-making
3. **Build Contribution vs Growth** - Key insight for understanding wealth growth
4. **Create Risk/Reward Matrix** - Most actionable for portfolio optimization

These would give you a comprehensive dashboard for better investment decisions.


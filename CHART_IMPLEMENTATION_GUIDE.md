# Chart Implementation Guide

## Quick Reference for Building Each Chart

### 1. Top Gainers & Losers (Bar Chart) ⭐ START HERE
**Complexity**: Low | **Time**: 15-20 min | **Impact**: High

**What you need**:
```typescript
// Component structure
const topGainers = portfolio.holdings
  .sort((a, b) => (b.unrealized_gain_pct || 0) - (a.unrealized_gain_pct || 0))
  .slice(0, 5);

const topLosers = portfolio.holdings
  .sort((a, b) => (a.unrealized_gain_pct || 0) - (b.unrealized_gain_pct || 0))
  .slice(0, 5);
```

**Recharts setup**:
```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

// Combine data with positive/negative indicator
const chartData = [...topGainers, ...topLosers].map(h => ({
  name: h.ticker,
  gain: h.unrealized_gain_pct,
  type: h.unrealized_gain_pct >= 0 ? 'Gainer' : 'Loser'
}));
```

**File to create**: `components/TopPerformersChart.tsx`

---

### 2. Gain/Loss Distribution (Histogram) 📊 THEN THIS
**Complexity**: Low-Medium | **Time**: 20-30 min | **Impact**: High

**Buckets to use**:
```typescript
const buckets = [
  { range: '+50%+', min: 50, max: Infinity, label: 'Highly Profitable' },
  { range: '+25% to +50%', min: 25, max: 50, label: 'Very Positive' },
  { range: '+10% to +25%', min: 10, max: 25, label: 'Positive' },
  { range: '0% to +10%', min: 0, max: 10, label: 'Slightly Positive' },
  { range: '-10% to 0%', min: -10, max: 0, label: 'Slightly Negative' },
  { range: '-25% to -10%', min: -25, max: -10, label: 'Negative' },
  { range: '-50% to -25%', min: -50, max: -25, label: 'Very Negative' },
  { range: 'Below -50%', min: -Infinity, max: -50, label: 'Highly Negative' },
];

const distribution = buckets.map(bucket => ({
  name: bucket.label,
  count: portfolio.holdings.filter(h => {
    const gain = h.unrealized_gain_pct || 0;
    return gain >= bucket.min && gain < bucket.max;
  }).length
}));
```

**Recharts setup**:
```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

<BarChart data={distribution}>
  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
  <YAxis />
  <CartesianGrid strokeDasharray="3 3" />
  <Tooltip />
  <Bar dataKey="count" fill="#8884d8" />
</BarChart>
```

**File to create**: `components/GainDistributionChart.tsx`

---

### 3. Performance Over Time (Line Chart) 📈 THEN THIS
**Complexity**: Low | **Time**: 20-25 min | **Impact**: Very High

**Query existing data**:
```typescript
// You already have portfolio_snapshots table!
// Just need to fetch it from portfolio API or create new endpoint

// Sample data structure needed:
interface PerformanceSnapshot {
  date: string;      // YYYY-MM-DD
  totalValue: number;
  equityValue: number;
  netContributions: number;
}
```

**Create new API endpoint** (optional):
```
# /api/metrics/performance
Returns: Array<PerformanceSnapshot> for last 90 days
```

**Recharts setup**:
```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

// Format dates for X-axis
const chartData = snapshots.map(s => ({
  date: new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  value: s.total_value,
  timestamp: s.date
}));

<LineChart data={chartData}>
  <XAxis dataKey="date" />
  <YAxis />
  <CartesianGrid strokeDasharray="3 3" />
  <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
  <Line type="monotone" dataKey="value" stroke="#0ea5e9" dot={false} />
</LineChart>
```

**File to create**: `components/PerformanceChart.tsx`

---

### 4. Contribution vs Growth (Stacked Area Chart) 💰 THEN THIS
**Complexity**: Medium | **Time**: 25-35 min | **Impact**: Very High

**Calculation logic**:
```typescript
const contribution = portfolio.netContributions || 0;
const currentValue = portfolio.totalValue;
const gains = currentValue - contribution;

// For historical snapshots:
const performanceData = snapshots.map(snapshot => ({
  date: snapshot.date,
  contributions: snapshot.net_contributions || 0,
  gains: snapshot.total_value - (snapshot.net_contributions || 0),
  total: snapshot.total_value
}));
```

**Recharts setup**:
```tsx
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

<AreaChart data={performanceData}>
  <XAxis dataKey="date" />
  <YAxis />
  <CartesianGrid strokeDasharray="3 3" />
  <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
  <Legend />
  <Area type="monotone" dataKey="contributions" stackId="1" fill="#10b981" />
  <Area type="monotone" dataKey="gains" stackId="1" fill="#0ea5e9" />
</AreaChart>
```

**File to create**: `components/ContributionVsGrowthChart.tsx`

---

### 5. Risk vs Reward Matrix (Bubble Chart) 🎯 MEDIUM PRIORITY
**Complexity**: Medium | **Time**: 30-40 min | **Impact**: High

**Volatility calculation**:
```typescript
// Simplified: use price movement from avg_cost to current_price
interface HoldingMetrics {
  ticker: string;
  volatility: number;  // % deviation calculation
  returnPct: number;   // unrealized_gain_pct
  positionSize: number; // market_value
}

const metrics = portfolio.holdings.map(h => {
  const avgCost = h.average_price || 0;
  const currentPrice = h.current_price;
  const volatility = avgCost > 0 ? Math.abs(currentPrice - avgCost) / avgCost * 100 : 0;
  
  return {
    ticker: h.ticker,
    volatility,
    returnPct: h.unrealized_gain_pct || 0,
    positionSize: h.market_value
  };
});
```

**Recharts setup**:
```tsx
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

// Transform for scatter chart
const scatterData = metrics.map(m => ({
  x: m.volatility,
  y: m.returnPct,
  z: m.positionSize / 100, // Size for bubble
  ticker: m.ticker
}));

<ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
  <XAxis dataKey="x" name="Volatility %" />
  <YAxis dataKey="y" name="Return %" />
  <CartesianGrid strokeDasharray="3 3" />
  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
  <Scatter name="Holdings" data={scatterData} fill="#8884d8" />
</ScatterChart>
```

**File to create**: `components/RiskRewardMatrix.tsx`

---

### 6. Portfolio Composition by Account 📑 LOW PRIORITY
**Complexity**: Low | **Time**: 15 min | **Impact**: Medium

**Use existing data structure**:
```typescript
// You already have accountViews!
// Just create multiple pie charts or stacked chart

const accountData = accountViews.map(view => ({
  name: view.label,
  value: view.portfolio.totalValue
}));
```

**File to create**: `components/AccountCompositionChart.tsx`

---

## Files Structure Recommendation

```
components/
├── AllocationChart.tsx (✅ existing)
├── HoldingsTable.tsx (✅ updated)
├── PortfolioSummary.tsx (✅ existing)
├── TopPerformersChart.tsx (📝 new - Phase 1)
├── GainDistributionChart.tsx (📝 new - Phase 1)
├── PerformanceChart.tsx (📝 new - Phase 1)
├── ContributionVsGrowthChart.tsx (📝 new - Phase 2)
├── RiskRewardMatrix.tsx (📝 new - Phase 2)
└── AccountCompositionChart.tsx (📝 new - Phase 3)

app/api/metrics/
├── yoy/ (folder - empty or delete)
├── performance/ (📝 new endpoint - optional)
└── distribution/ (📝 new endpoint - optional)
```

---

## Integration into Dashboard

**In app/page.tsx**, add each chart in the appropriate grid:

```tsx
{/* Charts Grid - expand from current 3-col layout */}
<div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
  <div className="lg:col-span-2">
    <AllocationChart ... />
  </div>
  <div className="space-y-4">
    {/* Existing cash boxes */}
  </div>
</div>

{/* Phase 1 Charts */}
<div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
  <TopPerformersChart ... />
  <GainDistributionChart ... />
</div>

<PerformanceChart ... />

{/* Phase 2 Charts */}
<div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
  <ContributionVsGrowthChart ... />
  <RiskRewardMatrix ... />
</div>
```

---

## Dependencies Already Available

✅ recharts - for all charts
✅ lucide-react - for icons
✅ tailwindcss - for styling
✅ typescript - for type safety

You don't need to install anything new!

---

## Testing Tips

1. **Verify data structure** before building charts
2. **Use hardcoded sample data first** to test chart rendering
3. **Then connect to portfolio data**
4. **Test edge cases**: empty holdings, single holding, extreme values
5. **Test dark mode** for each new chart
6. **Check responsive behavior** on mobile

---

## Estimated Timeline

- **Phase 1** (3 charts): 1-2 hours of development
- **Phase 2** (2 charts): 1-1.5 hours of development
- **Phase 3** (1 chart + account composition): 30-45 minutes

Total effort: 3-4 hours for a fully featured analytics dashboard! 🚀


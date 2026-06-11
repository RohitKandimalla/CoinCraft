import { Database } from 'sqlite';

export interface EquityNewsArticle {
  url: string;
  title: string;
  publisher: string | null;
  publishedAt: string | null;
  discoveredAt: string;
  isRead: boolean;
  readAt: string | null;
  tickers: string[];
}

interface PersistableArticle {
  url: string;
  title: string;
  publisher: string | null;
  publishedAt: string | null;
  tickers: Set<string>;
}

interface YahooNewsItem {
  title?: string;
  link?: string;
  publisher?: string;
  providerPublishTime?: number;
  relatedTickers?: string[];
}

const IMPORTANT_COMPANY_PATTERNS = [
  /\bearnings\b/i,
  /\bguidance\b/i,
  /\brevenue\b/i,
  /\bprofit\b/i,
  /\bdividend\b/i,
  /\bbuyback\b/i,
  /\bacqui(?:re|sition)\b/i,
  /\bmerger\b/i,
  /\blawsuit\b/i,
  /\binvestigation\b/i,
  /\bupgrade\b/i,
  /\bdowngrade\b/i,
  /\btarget price\b/i,
  /\bceo\b/i,
  /\bproduct launch\b/i,
  /\bpartnership\b/i,
  /\bcontract\b/i,
];

const GENERIC_MARKET_PATTERNS = [
  /\bstock market\b/i,
  /\bwall street\b/i,
  /\bmarket update\b/i,
  /\bstocks to watch\b/i,
  /\bbest stocks\b/i,
  /\btop stocks\b/i,
  /\bai stocks\b/i,
  /\btech stocks\b/i,
  /\benergy stocks\b/i,
  /\bsector\b/i,
  /\bindustry\b/i,
  /\bs&p\s*500\b/i,
  /\bdow\b/i,
  /\bnasdaq\b/i,
  /\betf\b/i,
];

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasTickerToken(text: string, ticker: string): boolean {
  const escaped = escapeForRegex(ticker);
  const tokenPattern = new RegExp(`(^|[^A-Z0-9])${escaped}([^A-Z0-9]|$)`, 'i');
  return tokenPattern.test(text);
}

function normalizeRelatedTickers(value?: string[]): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((ticker) => ticker?.trim().toUpperCase())
    .filter((ticker): ticker is string => Boolean(ticker));
}

function shouldKeepYahooItem(
  item: YahooNewsItem,
  requestedTicker: string,
  ownedTickers: Set<string>
): boolean {
  const title = item.title?.trim();
  if (!title) return false;

  const relatedTickers = normalizeRelatedTickers(item.relatedTickers);
  const ownedRelated = relatedTickers.filter((ticker) => ownedTickers.has(ticker));
  const isDirectlyConnected =
    ownedRelated.includes(requestedTicker) || hasTickerToken(title, requestedTicker);

  if (!isDirectlyConnected) {
    return false;
  }

  const isGenericMarketHeadline = GENERIC_MARKET_PATTERNS.some((pattern) => pattern.test(title));
  const isImportantCompanyHeadline = IMPORTANT_COMPANY_PATTERNS.some((pattern) =>
    pattern.test(title)
  );

  // Keep only high-signal, company-connected headlines and drop broad market roundups.
  if (isGenericMarketHeadline && !isImportantCompanyHeadline) {
    return false;
  }

  return true;
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Drop noisy query params so the same article dedupes consistently.
    parsed.searchParams.delete('guccounter');
    parsed.searchParams.delete('guce_referrer');
    parsed.searchParams.delete('guce_referrer_sig');
    parsed.searchParams.delete('utm_source');
    parsed.searchParams.delete('utm_medium');
    parsed.searchParams.delete('utm_campaign');
    return parsed.toString();
  } catch {
    return url;
  }
}

function toIsoDate(value?: number): string | null {
  if (!value || !Number.isFinite(value)) return null;
  return new Date(value * 1000).toISOString();
}

function buildInClause(values: string[]): string {
  return values.map(() => '?').join(', ');
}

async function fetchYahooNewsForTicker(ticker: string): Promise<YahooNewsItem[]> {
  const endpoint =
    `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}` +
    '&quotesCount=1&newsCount=8&enableFuzzyQuery=false';

  const response = await fetch(endpoint, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'CoinCraft/1.0',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Yahoo request failed for ${ticker} with status ${response.status}`);
  }

  const payload = (await response.json()) as { news?: YahooNewsItem[] };
  return Array.isArray(payload.news) ? payload.news : [];
}

export async function ensureNewsTables(db: Database): Promise<void> {
  await db.run(`
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
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS equity_news_mentions (
      article_url TEXT NOT NULL,
      ticker TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(article_url, ticker),
      FOREIGN KEY(article_url) REFERENCES equity_news_articles(url)
    )
  `);
}

export async function getOwnedEquityTickers(db: Database): Promise<string[]> {
  const hasHoldingsByAccount = await db.get<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='holdings_by_account'`
  );

  if (hasHoldingsByAccount) {
    const rows = await db.all<Array<{ ticker: string }>>(`
      SELECT ticker
      FROM holdings_by_account
      WHERE ticker IS NOT NULL
        AND ticker <> ''
        AND LOWER(COALESCE(asset_type, 'equity')) = 'equity'
      GROUP BY ticker
      ORDER BY SUM(market_value) DESC
      LIMIT 30
    `);
    return rows.map((row) => row.ticker.toUpperCase());
  }

  const rows = await db.all<Array<{ ticker: string }>>(`
    SELECT ticker
    FROM holdings
    WHERE ticker IS NOT NULL
      AND ticker <> ''
      AND LOWER(COALESCE(asset_type, 'equity')) = 'equity'
    ORDER BY market_value DESC
    LIMIT 30
  `);

  return rows.map((row) => row.ticker.toUpperCase());
}

export async function refreshNewsFromYahoo(
  db: Database
): Promise<{ articles: EquityNewsArticle[]; unreadCount: number; newCount: number }> {
  await ensureNewsTables(db);
  const tickers = await getOwnedEquityTickers(db);
  const ownedTickerSet = new Set(tickers);

  if (tickers.length === 0) {
    const existingArticles = await getStoredArticles(db);
    const unreadCount = await getUnreadCount(db);
    return { articles: existingArticles, unreadCount, newCount: 0 };
  }

  const collected = new Map<string, PersistableArticle>();

  await Promise.all(
    tickers.map(async (ticker) => {
      try {
        const items = await fetchYahooNewsForTicker(ticker);
        for (const item of items) {
          const rawUrl = item.link?.trim();
          const title = item.title?.trim();
          if (!rawUrl || !title) continue;
          if (!shouldKeepYahooItem(item, ticker, ownedTickerSet)) continue;

          const url = normalizeUrl(rawUrl);
          const article = collected.get(url) ?? {
            url,
            title,
            publisher: item.publisher?.trim() || null,
            publishedAt: toIsoDate(item.providerPublishTime),
            tickers: new Set<string>(),
          };

          article.title = title;
          article.publisher = article.publisher || item.publisher?.trim() || null;
          article.publishedAt = article.publishedAt || toIsoDate(item.providerPublishTime);
          article.tickers.add(ticker);

          const relatedTickers = normalizeRelatedTickers(item.relatedTickers);
          for (const related of relatedTickers) {
            article.tickers.add(related);
          }

          collected.set(url, article);
        }
      } catch (error) {
        console.error(`Yahoo news fetch failed for ${ticker}:`, error);
      }
    })
  );

  const urls = Array.from(collected.keys());
  let existingUrls = new Set<string>();

  if (urls.length > 0) {
    const placeholders = buildInClause(urls);
    const rows = await db.all<Array<{ url: string }>>(
      `SELECT url FROM equity_news_articles WHERE url IN (${placeholders})`,
      ...urls
    );
    existingUrls = new Set(rows.map((row) => row.url));
  }

  let newCount = 0;

  for (const article of collected.values()) {
    const isExisting = existingUrls.has(article.url);
    if (!isExisting) {
      await db.run(
        `
          INSERT INTO equity_news_articles (url, title, publisher, source, published_at, is_read)
          VALUES (?, ?, ?, 'yahoo_finance', ?, 0)
        `,
        article.url,
        article.title,
        article.publisher,
        article.publishedAt
      );
      newCount += 1;
    } else {
      await db.run(
        `
          UPDATE equity_news_articles
          SET title = ?,
              publisher = COALESCE(?, publisher),
              published_at = COALESCE(?, published_at),
              updated_at = CURRENT_TIMESTAMP
          WHERE url = ?
        `,
        article.title,
        article.publisher,
        article.publishedAt,
        article.url
      );
    }

    for (const ticker of article.tickers) {
      await db.run(
        `
          INSERT INTO equity_news_mentions (article_url, ticker)
          VALUES (?, ?)
          ON CONFLICT(article_url, ticker) DO NOTHING
        `,
        article.url,
        ticker
      );
    }
  }

  const articles = await getStoredArticles(db);
  const unreadCount = await getUnreadCount(db);

  return { articles, unreadCount, newCount };
}

export async function getStoredArticles(db: Database): Promise<EquityNewsArticle[]> {
  await ensureNewsTables(db);

  const rows = await db.all<
    Array<{
      url: string;
      title: string;
      publisher: string | null;
      published_at: string | null;
      discovered_at: string;
      is_read: number;
      read_at: string | null;
      tickers: string | null;
    }>
  >(`
    SELECT
      a.url,
      a.title,
      a.publisher,
      a.published_at,
      a.discovered_at,
      a.is_read,
      a.read_at,
      GROUP_CONCAT(m.ticker, ',') AS tickers
    FROM equity_news_articles a
    LEFT JOIN equity_news_mentions m ON m.article_url = a.url
    GROUP BY a.url
    ORDER BY COALESCE(a.published_at, a.discovered_at) DESC, a.discovered_at DESC
    LIMIT 120
  `);

  return rows.map((row) => ({
    url: row.url,
    title: row.title,
    publisher: row.publisher,
    publishedAt: row.published_at,
    discoveredAt: row.discovered_at,
    isRead: row.is_read === 1,
    readAt: row.read_at,
    tickers: row.tickers ? row.tickers.split(',').filter(Boolean) : [],
  }));
}

export async function markArticleRead(db: Database, url: string): Promise<number> {
  await ensureNewsTables(db);

  await db.run(
    `
      UPDATE equity_news_articles
      SET is_read = 1,
          read_at = COALESCE(read_at, CURRENT_TIMESTAMP),
          updated_at = CURRENT_TIMESTAMP
      WHERE url = ?
    `,
    normalizeUrl(url)
  );

  return getUnreadCount(db);
}

export async function getUnreadCount(db: Database): Promise<number> {
  await ensureNewsTables(db);

  const row = await db.get<{ count: number }>(
    'SELECT COUNT(*) AS count FROM equity_news_articles WHERE is_read = 0'
  );

  return row?.count || 0;
}


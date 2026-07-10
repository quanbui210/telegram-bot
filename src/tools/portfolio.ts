import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import YahooFinance from "yahoo-finance2";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { env } from "../config";

// --- types ---

interface Holding {
  ticker: string;
  quantity: number;
  avgCost: number;
  currency: string;
  broker: string | null;
  updatedAt: string;
}

export interface SeedHolding {
  ticker: string;
  quantity: number;
  avgCost: number;
  currency?: string;
  broker?: string;
}

interface PortfolioLine {
  ticker: string;
  quantity: number;
  avgCost: number;
  currency: string;
  broker: string | null;
  currentPrice: number;
  marketValueEur: number;
  costBasisEur: number;
  gainEur: number;
  gainPct: number;
  quoteUnavailable?: boolean;
}

export interface PortfolioSummary {
  lines: PortfolioLine[];
  totalMarketValueEur: number;
  totalCostBasisEur: number;
  totalGainEur: number;
  totalGainPct: number;
}

// --- database ---

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(env.DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db = new Database(env.DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS holdings (
        ticker     TEXT PRIMARY KEY,
        quantity   REAL NOT NULL,
        avg_cost   REAL NOT NULL,
        currency   TEXT NOT NULL DEFAULT 'EUR',
        broker     TEXT,
        updated_at TEXT NOT NULL
      );
    `);
  }
  return db;
}

export function initDb(): void {
  const database = getDb();
  const count = (
    database.prepare("SELECT COUNT(*) AS count FROM holdings").get() as {
      count: number;
    }
  ).count;
  console.log(`Portfolio DB ready: ${count} holdings at ${env.DB_PATH}`);
}

function rowToHolding(row: {
  ticker: string;
  quantity: number;
  avg_cost: number;
  currency: string;
  broker: string | null;
  updated_at: string;
}): Holding {
  return {
    ticker: row.ticker,
    quantity: row.quantity,
    avgCost: row.avg_cost,
    currency: row.currency,
    broker: row.broker,
    updatedAt: row.updated_at,
  };
}

function getAllHoldings(): Holding[] {
  const rows = getDb()
    .prepare(
      "SELECT ticker, quantity, avg_cost, currency, broker, updated_at FROM holdings ORDER BY ticker"
    )
    .all() as Array<{
    ticker: string;
    quantity: number;
    avg_cost: number;
    currency: string;
    broker: string | null;
    updated_at: string;
  }>;
  return rows.map(rowToHolding);
}

function findHolding(ticker: string): Holding | null {
  const row = getDb()
    .prepare(
      "SELECT ticker, quantity, avg_cost, currency, broker, updated_at FROM holdings WHERE ticker = ?"
    )
    .get(ticker.toUpperCase()) as
    | {
        ticker: string;
        quantity: number;
        avg_cost: number;
        currency: string;
        broker: string | null;
        updated_at: string;
      }
    | undefined;
  return row ? rowToHolding(row) : null;
}

function upsertHolding(input: {
  ticker: string;
  quantity: number;
  avgCost: number;
  currency: string;
  broker?: string | null;
}): Holding {
  const ticker = input.ticker.toUpperCase();
  const now = new Date().toISOString();

  getDb()
    .prepare(
      `INSERT INTO holdings (ticker, quantity, avg_cost, currency, broker, updated_at)
       VALUES (@ticker, @quantity, @avgCost, @currency, @broker, @updatedAt)
       ON CONFLICT(ticker) DO UPDATE SET
         quantity = excluded.quantity,
         avg_cost = excluded.avg_cost,
         currency = excluded.currency,
         broker = COALESCE(excluded.broker, holdings.broker),
         updated_at = excluded.updated_at`
    )
    .run({
      ticker,
      quantity: input.quantity,
      avgCost: input.avgCost,
      currency: input.currency,
      broker: input.broker ?? null,
      updatedAt: now,
    });

  return findHolding(ticker)!;
}

function removeHoldingFromDb(ticker: string): boolean {
  const result = getDb()
    .prepare("DELETE FROM holdings WHERE ticker = ?")
    .run(ticker.toUpperCase());
  return result.changes > 0;
}

export function seedHoldings(holdings: SeedHolding[]): number {
  let count = 0;
  for (const item of holdings) {
    upsertHolding({
      ticker: item.ticker,
      quantity: item.quantity,
      avgCost: item.avgCost,
      currency: item.currency ?? "EUR",
      broker: item.broker ?? null,
    });
    count++;
  }
  return count;
}

// --- market ---

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

function quoteCandidates(symbol: string): string[] {
  const upper = symbol.toUpperCase();
  if (upper.includes(".")) return [upper];
  return [...new Set([upper, `${upper}.DE`, `${upper}.AS`, `${upper}.L`])];
}

async function getQuote(ticker: string) {
  let lastError = `No price data for ${ticker.toUpperCase()}`;

  for (const symbol of quoteCandidates(ticker)) {
    const result = await yahooFinance.quote(symbol);
    if (!result || Array.isArray(result)) continue;

    const price = result.regularMarketPrice;
    const currency = result.currency;
    if (price == null || !currency) {
      lastError = `No price data for ${symbol}`;
      continue;
    }

    return {
      ticker: result.symbol ?? symbol,
      price,
      currency,
      changePct: result.regularMarketChangePercent ?? null,
    };
  }

  throw new Error(lastError);
}

async function convertToEur(amount: number, currency: string): Promise<number> {
  const normalized = currency.toUpperCase();
  if (normalized === "EUR") return amount;

  const pair = `EUR${normalized}=X`;
  const fx = await yahooFinance.quote(pair);
  if (!fx || Array.isArray(fx)) throw new Error(`No FX rate for ${normalized} → EUR`);

  const rate = fx.regularMarketPrice;
  if (!rate) throw new Error(`No FX rate for ${normalized} → EUR`);

  return amount / rate;
}

// --- portfolio logic ---

function formatMoney(value: number, currency = "EUR"): string {
  return new Intl.NumberFormat("en-FI", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPct(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

async function buildPortfolioLine(holding: Holding): Promise<PortfolioLine> {
  const costBasis = holding.quantity * holding.avgCost;
  const costBasisEur = await convertToEur(costBasis, holding.currency);

  try {
    const quote = await getQuote(holding.ticker);
    const marketValue = holding.quantity * quote.price;
    const marketValueEur = await convertToEur(marketValue, quote.currency);
    const gainEur = marketValueEur - costBasisEur;
    const gainPct = costBasisEur === 0 ? 0 : (gainEur / costBasisEur) * 100;

    return {
      ticker: holding.ticker,
      quantity: holding.quantity,
      avgCost: holding.avgCost,
      currency: holding.currency,
      broker: holding.broker,
      currentPrice: quote.price,
      marketValueEur,
      costBasisEur,
      gainEur,
      gainPct,
    };
  } catch {
    return {
      ticker: holding.ticker,
      quantity: holding.quantity,
      avgCost: holding.avgCost,
      currency: holding.currency,
      broker: holding.broker,
      currentPrice: holding.avgCost,
      marketValueEur: costBasisEur,
      costBasisEur,
      gainEur: 0,
      gainPct: 0,
      quoteUnavailable: true,
    };
  }
}

async function fetchPortfolioSummary(): Promise<PortfolioSummary> {
  const holdings = getAllHoldings();
  if (holdings.length === 0) {
    return {
      lines: [],
      totalMarketValueEur: 0,
      totalCostBasisEur: 0,
      totalGainEur: 0,
      totalGainPct: 0,
    };
  }

  const lines = await Promise.all(holdings.map(buildPortfolioLine));
  const pricedLines = lines.filter((line) => !line.quoteUnavailable);
  const totalMarketValueEur = pricedLines.reduce((s, l) => s + l.marketValueEur, 0);
  const totalCostBasisEur = lines.reduce((s, l) => s + l.costBasisEur, 0);
  const pricedCostBasisEur = pricedLines.reduce((s, l) => s + l.costBasisEur, 0);
  const totalGainEur = totalMarketValueEur - pricedCostBasisEur;
  const totalGainPct =
    pricedCostBasisEur === 0 ? 0 : (totalGainEur / pricedCostBasisEur) * 100;

  return { lines, totalMarketValueEur, totalCostBasisEur, totalGainEur, totalGainPct };
}

function formatPortfolioSummary(summary: PortfolioSummary): string {
  if (summary.lines.length === 0) return "No holdings in portfolio.";

  const lines = summary.lines.map((line) => {
    const broker = line.broker ? ` · ${line.broker}` : "";
    if (line.quoteUnavailable) {
      return `- **${line.ticker}** · ${line.quantity} @ ${formatMoney(line.avgCost, line.currency)} → price unavailable · cost basis ${formatMoney(line.costBasisEur)}${broker}`;
    }
    return `- **${line.ticker}** · ${line.quantity} @ ${formatMoney(line.avgCost, line.currency)} → ${formatMoney(line.marketValueEur)} (${formatPct(line.gainPct)})${broker}`;
  });

  const unavailable = summary.lines.filter((line) => line.quoteUnavailable);
  const footer =
    unavailable.length > 0
      ? [
          "",
          `_${unavailable.length} holding(s) excluded from total — live price unavailable._`,
        ]
      : [];

  return [
    `**Portfolio** — ${formatMoney(summary.totalMarketValueEur)}`,
    `- Cost basis: ${formatMoney(summary.totalCostBasisEur)}`,
    `- Total P&L: ${formatMoney(summary.totalGainEur)} (${formatPct(summary.totalGainPct)})`,
    "",
    ...lines,
    ...footer,
  ].join("\n");
}

async function fetchHoldingDetail(ticker: string): Promise<string> {
  const holding = findHolding(ticker);
  if (!holding) return `No holding found for ${ticker.toUpperCase()}.`;

  const line = await buildPortfolioLine(holding);
  if (line.quoteUnavailable) {
    return [
      `📈 **${line.ticker}**`,
      `- Qty: ${line.quantity}`,
      `- Avg cost: ${formatMoney(line.avgCost, line.currency)}`,
      `- Current: price unavailable`,
      `- Cost basis: ${formatMoney(line.costBasisEur)}`,
      line.broker ? `- Broker: ${line.broker}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const quote = await getQuote(holding.ticker);

  return [
    `📈 **${line.ticker}**`,
    `- Qty: ${line.quantity}`,
    `- Avg cost: ${formatMoney(line.avgCost, line.currency)}`,
    `- Current: ${formatMoney(quote.price, quote.currency)}${quote.changePct != null ? ` (${formatPct(quote.changePct)} today)` : ""}`,
    `- Market value: ${formatMoney(line.marketValueEur)}`,
    `- Cost basis: ${formatMoney(line.costBasisEur)}`,
    `- P&L: ${formatMoney(line.gainEur)} (${formatPct(line.gainPct)})`,
    line.broker ? `- Broker: ${line.broker}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

async function formatQuote(ticker: string): Promise<string> {
  const quote = await getQuote(ticker);
  const priceEur = await convertToEur(quote.price, quote.currency);
  const change =
    quote.changePct != null ? ` (${formatPct(quote.changePct)} today)` : "";

  return [
    `📊 **${quote.ticker}**`,
    `- Price: ${formatMoney(quote.price, quote.currency)}${change}`,
    `- In EUR: ${formatMoney(priceEur)}`,
  ].join("\n");
}

async function recordBuy(input: {
  ticker: string;
  quantity: number;
  price: number;
  currency?: string;
  broker?: string;
}): Promise<string> {
  const ticker = input.ticker.toUpperCase();
  const existing = findHolding(ticker);
  const currency =
    input.currency ?? (existing?.currency || (await getQuote(ticker)).currency);
  const newQuantity = (existing?.quantity ?? 0) + input.quantity;
  const newAvgCost = existing
    ? (existing.quantity * existing.avgCost + input.quantity * input.price) / newQuantity
    : input.price;

  upsertHolding({
    ticker,
    quantity: newQuantity,
    avgCost: newAvgCost,
    currency,
    broker: input.broker ?? existing?.broker ?? null,
  });

  return `Recorded buy: ${input.quantity} × **${ticker}** @ ${formatMoney(input.price, currency)}. New position: ${newQuantity} @ ${formatMoney(newAvgCost, currency)} avg.`;
}

async function recordSell(input: {
  ticker: string;
  quantity: number;
}): Promise<string> {
  const ticker = input.ticker.toUpperCase();
  const existing = findHolding(ticker);
  if (!existing) return `No holding found for ${ticker}.`;

  if (input.quantity >= existing.quantity) {
    removeHoldingFromDb(ticker);
    return `Closed position in **${ticker}** (${existing.quantity} units).`;
  }

  upsertHolding({
    ticker,
    quantity: existing.quantity - input.quantity,
    avgCost: existing.avgCost,
    currency: existing.currency,
    broker: existing.broker,
  });

  return `Recorded sell: ${input.quantity} × **${ticker}**. Remaining: ${existing.quantity - input.quantity}.`;
}

function removeHolding(ticker: string): string {
  const removed = removeHoldingFromDb(ticker);
  return removed
    ? `Removed **${ticker.toUpperCase()}** from portfolio.`
    : `No holding found for ${ticker.toUpperCase()}.`;
}

// --- tools ---

export const getStockQuote = tool(
  async ({ ticker }) => {
    try {
      return await formatQuote(ticker);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Failed to fetch quote for ${ticker}: ${msg}`;
    }
  },
  {
    name: "get_stock_quote",
    description:
      "Get the current market price of a stock, ETF, or crypto. Use Yahoo Finance ticker symbols (e.g. VWCE.DE, AAPL, BTC-USD).",
    schema: z.object({
      ticker: z.string().describe("Yahoo Finance ticker symbol"),
    }),
  }
);

export const getPortfolio = tool(
  async () => {
    try {
      const summary = await fetchPortfolioSummary();
      return formatPortfolioSummary(summary);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Failed to fetch portfolio: ${msg}`;
    }
  },
  {
    name: "get_portfolio",
    description:
      "Get the user's full portfolio: all holdings, total net worth in EUR, cost basis, and P&L.",
    schema: z.object({}),
  }
);

export const getHolding = tool(
  async ({ ticker }) => {
    try {
      return await fetchHoldingDetail(ticker);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Failed to fetch holding for ${ticker}: ${msg}`;
    }
  },
  {
    name: "get_holding",
    description:
      "Get details for a single holding: quantity, avg cost, current price, and P&L.",
    schema: z.object({
      ticker: z.string().describe("Yahoo Finance ticker symbol"),
    }),
  }
);

export const buyHolding = tool(
  async ({ ticker, quantity, price, currency, broker }) => {
    try {
      return await recordBuy({ ticker, quantity, price, currency, broker });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Failed to record buy for ${ticker}: ${msg}`;
    }
  },
  {
    name: "buy_holding",
    description:
      "Record a buy or add to an existing position. Updates weighted average cost automatically.",
    schema: z.object({
      ticker: z.string(),
      quantity: z.number().positive(),
      price: z.number().positive(),
      currency: z.string().optional(),
      broker: z.string().optional(),
    }),
  }
);

export const sellHolding = tool(
  async ({ ticker, quantity }) => {
    try {
      return await recordSell({ ticker, quantity });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Failed to record sell for ${ticker}: ${msg}`;
    }
  },
  {
    name: "sell_holding",
    description: "Record a sell. Reduces quantity or closes the position.",
    schema: z.object({
      ticker: z.string(),
      quantity: z.number().positive(),
    }),
  }
);

export const deleteHolding = tool(
  async ({ ticker }) => {
    try {
      return removeHolding(ticker);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Failed to delete holding for ${ticker}: ${msg}`;
    }
  },
  {
    name: "delete_holding",
    description: "Remove a holding entirely from the portfolio.",
    schema: z.object({ ticker: z.string() }),
  }
);

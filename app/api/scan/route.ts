import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { analyze, type SignalLabel } from "@/lib/analysis";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  BinanceError,
  fetchCandles,
  fetchMarkets,
  isInterval,
  normalizeSymbol,
} from "@/lib/binance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export type ScanRow = {
  symbol: string;
  base: string;
  quote: string;
  price: number;
  changePercent24h: number;
  quoteVolume: number;
  signal: SignalLabel;
  score: number;
  confidence: number;
  rsi: number | null;
  adx: number | null;
  atrPercent: number;
  trendLabel: string;
  patterns: string[];
};

/** Binance'i boğmamak için aynı anda en fazla bu kadar istek. */
const CONCURRENCY = 6;

async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function GET(request: Request) {
  // Tarama Binance kotasını en çok tüketen uç nokta: yalnızca üyelere açık ve sınırlı.
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Bu işlem için giriş yapmalısınız." }, { status: 401 });
  }
  const limiter = rateLimit(`scan:${session.user.email ?? clientIp(request)}`, 30, 60_000);
  if (!limiter.allowed) {
    return NextResponse.json(
      { error: "Çok sık tarama yapıldı, biraz bekleyip tekrar deneyin." },
      { status: 429, headers: { "retry-after": String(limiter.retryAfterSeconds) } },
    );
  }

  const { searchParams } = new URL(request.url);
  const intervalParam = searchParams.get("interval") ?? "4h";
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 30), 5), 60);
  const quote = (searchParams.get("quote") ?? "USDT").toUpperCase();
  const symbolsParam = searchParams.get("symbols");

  if (!isInterval(intervalParam)) {
    return NextResponse.json({ error: "Geçersiz zaman dilimi." }, { status: 400 });
  }
  const interval = intervalParam;

  try {
    let symbols: string[];
    let volumeBySymbol = new Map<string, number>();
    let changeBySymbol = new Map<string, number>();
    let source: "binance" | "demo" = "binance";

    if (symbolsParam) {
      // Takip listesi taraması: verilen semboller.
      symbols = symbolsParam
        .split(",")
        .map((s) => normalizeSymbol(s))
        .filter((s): s is string => s !== null)
        .slice(0, 60);
      const markets = await fetchMarkets(quote).catch(() => null);
      if (markets) {
        source = markets.source;
        for (const t of markets.tickers) {
          volumeBySymbol.set(t.symbol, t.quoteVolume);
          changeBySymbol.set(t.symbol, t.priceChangePercent);
        }
      }
    } else {
      const markets = await fetchMarkets(quote);
      source = markets.source;
      const top = markets.tickers.slice(0, limit);
      symbols = top.map((t) => t.symbol);
      volumeBySymbol = new Map(top.map((t) => [t.symbol, t.quoteVolume]));
      changeBySymbol = new Map(top.map((t) => [t.symbol, t.priceChangePercent]));
    }

    if (symbols.length === 0) {
      return NextResponse.json({ source, interval, rows: [], updatedAt: Date.now() });
    }

    const rows = await mapWithLimit(symbols, CONCURRENCY, async (symbol): Promise<ScanRow | null> => {
      try {
        const { candles, source: candleSource } = await fetchCandles(symbol, interval, 250);
        const analysis = analyze(symbol, interval, candles, candleSource);
        return {
          symbol,
          base: analysis.base,
          quote: analysis.quote,
          price: analysis.price,
          changePercent24h: changeBySymbol.get(symbol) ?? analysis.changePercent,
          quoteVolume: volumeBySymbol.get(symbol) ?? 0,
          signal: analysis.signal,
          score: analysis.score,
          confidence: analysis.confidence,
          rsi: analysis.indicators.rsi,
          adx: analysis.indicators.adx,
          atrPercent: analysis.volatility.atrPercent,
          trendLabel: analysis.trendStrength.label,
          patterns: analysis.patterns.map((p) => p.name),
        };
      } catch {
        // Tek bir sembol düşerse tarama devam etsin.
        return null;
      }
    });

    const clean = rows.filter((row): row is ScanRow => row !== null);
    clean.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      source,
      interval,
      updatedAt: Date.now(),
      scanned: clean.length,
      rows: clean,
    });
  } catch (error) {
    const status = error instanceof BinanceError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Tarama yapılamadı." },
      { status },
    );
  }
}

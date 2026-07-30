import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { analyze } from "@/lib/analysis";
import type { ScanRow } from "@/lib/api-types";
import { getCandles, getQuotes, mapWithLimit } from "@/lib/markets/provider";
import {
  isInterval,
  isMarketId,
  MarketDataError,
  MARKETS,
  parseInstrumentId,
  type DataSource,
  type Instrument,
  type Interval,
} from "@/lib/markets/types";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Sağlayıcıyı boğmamak için aynı anda en fazla bu kadar istek. */
const CONCURRENCY = 6;

export async function GET(request: Request) {
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
  const marketParam = searchParams.get("market") ?? "kripto";
  const intervalParam = searchParams.get("interval") ?? "4h";
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 30), 5), 60);
  const idsParam = searchParams.get("ids");

  if (!isMarketId(marketParam)) {
    return NextResponse.json({ error: "Geçersiz piyasa." }, { status: 400 });
  }
  if (!isInterval(intervalParam)) {
    return NextResponse.json({ error: "Geçersiz zaman dilimi." }, { status: 400 });
  }
  const interval = intervalParam as Interval;

  try {
    // Taranacak varlıklar: ya verilen kimlikler (takip listesi) ya da piyasanın ilk N'i.
    let targets: { instrument: Instrument; price: number; changePercent: number; volume: number }[] = [];
    let source: DataSource = "canli";

    if (idsParam) {
      const ids = idsParam
        .split(",")
        .map((id) => parseInstrumentId(id.trim()))
        .filter((v): v is { market: typeof marketParam; symbol: string } => v !== null)
        .slice(0, 60);

      const quoteCache = new Map<string, Awaited<ReturnType<typeof getQuotes>>>();
      for (const { market } of ids) {
        if (!quoteCache.has(market)) {
          const quotes = await getQuotes(market, 60).catch(() => null);
          if (quotes) {
            quoteCache.set(market, quotes);
            if (quotes.source === "demo") source = "demo";
          }
        }
      }

      targets = ids.map(({ market, symbol }) => {
        const quote = quoteCache.get(market)?.quotes.find((q) => q.symbol === symbol);
        return {
          instrument:
            quote ??
            ({
              id: `${market}:${symbol}`,
              market,
              symbol,
              name: symbol,
              ticker: symbol.replace(/\.IS$|=X$|=F$/, ""),
              currency: MARKETS[market].currency,
              kind: market === "kripto" ? "kripto" : "hisse",
            } satisfies Instrument),
          price: quote?.price ?? 0,
          changePercent: quote?.changePercent ?? 0,
          volume: quote?.volume ?? 0,
        };
      });
    } else {
      const { quotes, source: quoteSource } = await getQuotes(marketParam, limit);
      source = quoteSource;
      targets = quotes.slice(0, limit).map((quote) => ({
        instrument: quote,
        price: quote.price,
        changePercent: quote.changePercent,
        volume: quote.volume,
      }));
    }

    if (targets.length === 0) {
      return NextResponse.json({
        market: idsParam ? "mixed" : marketParam,
        interval,
        source,
        updatedAt: Date.now(),
        scanned: 0,
        rows: [],
      });
    }

    const rows = await mapWithLimit(targets, CONCURRENCY, async (target): Promise<ScanRow | null> => {
      const { instrument } = target;
      // Bu piyasada desteklenmeyen periyot için en yakın desteklenene düş.
      const supported = MARKETS[instrument.market].intervals;
      const effective = supported.includes(interval) ? interval : supported[supported.length - 2];

      try {
        const { candles, source: candleSource } = await getCandles(
          instrument.market,
          instrument.symbol,
          effective,
          250,
        );
        const analysis = analyze(instrument, effective, candles, candleSource);
        return {
          id: instrument.id,
          market: instrument.market,
          symbol: instrument.symbol,
          name: instrument.name,
          ticker: instrument.ticker,
          currency: instrument.currency,
          price: target.price || analysis.price,
          changePercent: target.changePercent || analysis.changePercent,
          volume: target.volume,
          signal: analysis.signal,
          score: analysis.score,
          confidence: analysis.confidence,
          rsi: analysis.indicators.rsi,
          adx: analysis.indicators.adx,
          atrPercent: analysis.volatility.atrPercent,
          trendLabelKey: analysis.trendStrength.labelKey,
          patterns: analysis.patterns.map((p) => p.id),
        };
      } catch {
        // Tek bir varlık düşerse tarama devam etsin.
        return null;
      }
    });

    const clean = rows.filter((row): row is ScanRow => row !== null);
    clean.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      market: idsParam ? "mixed" : marketParam,
      interval,
      source,
      updatedAt: Date.now(),
      scanned: clean.length,
      rows: clean,
    });
  } catch (error) {
    const status = error instanceof MarketDataError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Tarama yapılamadı." },
      { status },
    );
  }
}

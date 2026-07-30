import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { analyze } from "@/lib/analysis";
import type { ScanRow } from "@/lib/api-types";
import { displayTicker } from "@/lib/markets/instruments";
import { getCandles, getInstruments, getQuotes, mapWithLimit } from "@/lib/markets/provider";
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

/**
 * Aynı anda en fazla kaç istek. Kripto sağlayıcısı yüksek hacme dayanıklıdır;
 * Yahoo tarafı çok daha çabuk hız sınırı uygular, bu yüzden daha yavaş gidilir.
 */
const CONCURRENCY = { kripto: 6, diger: 3 } as const;

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
              ticker: displayTicker(market, symbol),
              currency: MARKETS[market].currency,
              kind: market === "kripto" ? "kripto" : "hisse",
            } satisfies Instrument),
          price: quote?.price ?? 0,
          changePercent: quote?.changePercent ?? 0,
          volume: quote?.volume ?? 0,
        };
      });
    } else if (marketParam === "kripto") {
      const { quotes, source: quoteSource } = await getQuotes(marketParam, limit);
      source = quoteSource;
      targets = quotes.slice(0, limit).map((quote) => ({
        instrument: quote,
        price: quote.price,
        changePercent: quote.changePercent,
        volume: quote.volume,
      }));
    } else {
      // Kripto dışı piyasalarda fiyat listesi ayrıca çekilmez: taramada zaten
      // her sembolün mumları alınıyor, fiyat ve değişim oradan türetilir.
      // Aksi hâlde sembol başına iki istek atılır ve sağlayıcı hız sınırına
      // takılır (60 varlık = 120 istek).
      targets = (await getInstruments(marketParam, limit)).slice(0, limit).map((instrument) => ({
        instrument,
        price: 0,
        changePercent: 0,
        volume: 0,
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

    const concurrency = marketParam === "kripto" && !idsParam ? CONCURRENCY.kripto : CONCURRENCY.diger;
    // Hepsi başarısız olursa kullanıcıya boş tablo değil sebep gösterilir.
    let firstFailure: unknown = null;
    const rows = await mapWithLimit(targets, concurrency, async (target): Promise<ScanRow | null> => {
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
        if (candleSource === "demo") source = "demo";
        const last = candles[candles.length - 1];
        return {
          id: instrument.id,
          market: instrument.market,
          symbol: instrument.symbol,
          name: instrument.name,
          ticker: instrument.ticker,
          currency: instrument.currency,
          price: target.price || analysis.price,
          changePercent: target.changePercent || analysis.changePercent,
          // Fiyat listesi çekilmediğinde hacim son mumdan gelir.
          volume: target.volume || last.quoteVolume,
          signal: analysis.signal,
          score: analysis.score,
          confidence: analysis.confidence,
          rsi: analysis.indicators.rsi,
          adx: analysis.indicators.adx,
          atrPercent: analysis.volatility.atrPercent,
          trendLabelKey: analysis.trendStrength.labelKey,
          patterns: analysis.patterns.map((p) => p.id),
        };
      } catch (error) {
        // Tek bir varlık düşerse tarama devam etsin; sebebi yine de sakla.
        firstFailure ??= error;
        return null;
      }
    });

    const clean = rows.filter((row): row is ScanRow => row !== null);
    if (clean.length === 0 && firstFailure) throw firstFailure;
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

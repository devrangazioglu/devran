import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { analyze, chartSeries } from "@/lib/analysis";
import { buildCommentary } from "@/lib/commentary";
import { analysisReady } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { getCandles, getQuotes, normalizeSymbol } from "@/lib/markets/provider";
import {
  isInterval,
  isMarketId,
  MarketDataError,
  MARKETS,
  type Interval,
  type MarketId,
} from "@/lib/markets/types";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

/** Detay sayfasında karşılaştırılacak üst zaman dilimleri. */
function higherTimeframes(market: MarketId, interval: Interval): Interval[] {
  const available = MARKETS[market].intervals;
  const index = available.indexOf(interval);
  const higher = available.slice(index + 1, index + 4);
  // Yeterli üst periyot yoksa alt periyotlarla tamamla.
  if (higher.length < 3) {
    const lower = available.slice(Math.max(index - (3 - higher.length), 0), index);
    return [...higher, ...lower].slice(0, 3);
  }
  return higher;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Bu işlem için giriş yapmalısınız." }, { status: 401 });
  }
  const limiter = rateLimit(`analyze:${session.user.email ?? clientIp(request)}`, 90, 60_000);
  if (!limiter.allowed) {
    return NextResponse.json(
      { error: "Çok sık analiz isteği yapıldı, biraz bekleyin." },
      { status: 429, headers: { "retry-after": String(limiter.retryAfterSeconds) } },
    );
  }

  const { searchParams } = new URL(request.url);
  const marketParam = searchParams.get("market") ?? "kripto";
  const intervalParam = searchParams.get("interval") ?? "4h";

  if (!isMarketId(marketParam)) {
    return NextResponse.json({ error: "Geçersiz piyasa." }, { status: 400 });
  }
  const symbol = normalizeSymbol(marketParam, searchParams.get("symbol") ?? "");
  if (!symbol) {
    return NextResponse.json({ error: "Geçersiz sembol." }, { status: 400 });
  }
  if (!isInterval(intervalParam) || !MARKETS[marketParam].intervals.includes(intervalParam)) {
    return NextResponse.json({ error: "Bu piyasa için geçersiz zaman dilimi." }, { status: 400 });
  }
  const interval = intervalParam;
  const locale = await getLocale();

  try {
    const { candles, source, instrument } = await getCandles(marketParam, symbol, interval, 300);
    const analysis = analyze(instrument, interval, candles, source);
    const commentary = buildCommentary(analysis, locale);
    const series = chartSeries(candles);

    // Fiyat listesinden gün içi istatistikler (varsa).
    const quote = await getQuotes(marketParam, 60)
      .then(({ quotes }) => quotes.find((q) => q.symbol === symbol) ?? null)
      .catch(() => null);

    const timeframes = await Promise.all(
      higherTimeframes(marketParam, interval).map(async (other) => {
        try {
          const result = await getCandles(marketParam, symbol, other, 250);
          const otherAnalysis = analyze(instrument, other, result.candles, result.source);
          return {
            interval: other,
            signal: otherAnalysis.signal,
            score: otherAnalysis.score,
            confidence: otherAnalysis.confidence,
          };
        } catch {
          return null;
        }
      }),
    );

    const visible = 180;
    const trim = <T,>(list: T[]) => list.slice(-visible);

    return NextResponse.json({
      analysis,
      commentary,
      analysisLocalized: analysisReady(locale),
      quote,
      candles: trim(candles),
      series: {
        ema21: trim(series.ema21),
        ema50: trim(series.ema50),
        ema200: trim(series.ema200),
        bbUpper: trim(series.bbUpper),
        bbLower: trim(series.bbLower),
        rsi: trim(series.rsi),
        macd: trim(series.macd),
        macdSignal: trim(series.macdSignal),
        macdHistogram: trim(series.macdHistogram),
      },
      timeframes: timeframes.filter((t) => t !== null),
    });
  } catch (error) {
    const status = error instanceof MarketDataError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analiz yapılamadı." },
      { status },
    );
  }
}

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { analyze, chartSeries } from "@/lib/analysis";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  BinanceError,
  fetchCandles,
  fetchTicker,
  isInterval,
  normalizeSymbol,
  type Interval,
} from "@/lib/binance";
import { buildCommentary } from "@/lib/commentary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Detay sayfasında üst zaman dilimleriyle uyum kontrolü için. */
const HIGHER_TIMEFRAMES: Record<Interval, Interval[]> = {
  "1m": ["5m", "15m", "1h"],
  "5m": ["15m", "1h", "4h"],
  "15m": ["1h", "4h", "1d"],
  "30m": ["1h", "4h", "1d"],
  "1h": ["4h", "1d", "1w"],
  "4h": ["1h", "1d", "1w"],
  "1d": ["4h", "1w", "1w"],
  "1w": ["1d", "4h", "1h"],
};

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Bu işlem için giriş yapmalısınız." }, { status: 401 });
  }
  const limiter = rateLimit(`analyze:${session.user.email ?? clientIp(request)}`, 60, 60_000);
  if (!limiter.allowed) {
    return NextResponse.json(
      { error: "Çok sık analiz isteği yapıldı, biraz bekleyin." },
      { status: 429, headers: { "retry-after": String(limiter.retryAfterSeconds) } },
    );
  }

  const { searchParams } = new URL(request.url);
  const symbol = normalizeSymbol(searchParams.get("symbol") ?? "");
  const intervalParam = searchParams.get("interval") ?? "4h";

  if (!symbol) {
    return NextResponse.json({ error: "Geçersiz sembol." }, { status: 400 });
  }
  if (!isInterval(intervalParam)) {
    return NextResponse.json({ error: "Geçersiz zaman dilimi." }, { status: 400 });
  }
  const interval = intervalParam;

  try {
    const [{ candles, source }, tickerResult] = await Promise.all([
      fetchCandles(symbol, interval, 300),
      fetchTicker(symbol).catch(() => null),
    ]);

    const analysis = analyze(symbol, interval, candles, source);
    const commentary = buildCommentary(analysis);
    const series = chartSeries(candles);

    // Üst zaman dilimlerinde de hızlı bir bakış (trend uyumu).
    const others = [...new Set(HIGHER_TIMEFRAMES[interval])].filter((i) => i !== interval);
    const timeframes = await Promise.all(
      others.map(async (other) => {
        try {
          const result = await fetchCandles(symbol, other, 250);
          const otherAnalysis = analyze(symbol, other, result.candles, result.source);
          return {
            interval: other,
            label: otherAnalysis.intervalLabel,
            signal: otherAnalysis.signal,
            score: otherAnalysis.score,
            confidence: otherAnalysis.confidence,
          };
        } catch {
          return null;
        }
      }),
    );

    // Grafik yükünü küçük tutmak için son 180 mum yeterli.
    const visible = 180;
    const trim = <T,>(list: T[]) => list.slice(-visible);

    return NextResponse.json({
      analysis,
      commentary,
      ticker: tickerResult?.ticker ?? null,
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
    const status = error instanceof BinanceError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analiz yapılamadı." },
      { status },
    );
  }
}

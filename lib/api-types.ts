/** API route'larının döndürdüğü gövdelerin paylaşılan tipleri. */

import type { Analysis, SignalLabel } from "./analysis";
import type { Candle, DataSource, Interval, Ticker } from "./binance";
import type { Commentary } from "./commentary";

export type AnalyzeResponse = {
  analysis: Analysis;
  commentary: Commentary;
  ticker: Ticker | null;
  candles: Candle[];
  series: {
    ema21: (number | null)[];
    ema50: (number | null)[];
    ema200: (number | null)[];
    bbUpper: (number | null)[];
    bbLower: (number | null)[];
    rsi: (number | null)[];
    macd: (number | null)[];
    macdSignal: (number | null)[];
    macdHistogram: (number | null)[];
  };
  timeframes: {
    interval: Interval;
    label: string;
    signal: SignalLabel;
    score: number;
    confidence: number;
  }[];
};

export type MarketsResponse = {
  source: DataSource;
  updatedAt: number;
  tickers: Ticker[];
};

export type ScanResponse = {
  source: DataSource;
  interval: Interval;
  updatedAt: number;
  scanned: number;
  rows: {
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
  }[];
};

export type ApiError = { error: string };

/** JSON getirir; hata gövdesindeki Türkçe mesajı fırlatır. */
export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: "no-store" });
  const body = (await response.json().catch(() => null)) as T | ApiError | null;

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? (body as ApiError).error
        : `İstek başarısız (${response.status})`;
    throw new Error(message);
  }
  if (!body) throw new Error("Sunucudan boş yanıt geldi.");
  return body as T;
}

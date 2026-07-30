/** API route'larının döndürdüğü gövdelerin paylaşılan tipleri. */

import type { Analysis, SignalLabel } from "./analysis";
import type { Candle, DataSource, Instrument, Interval, MarketId, Quote } from "./markets/types";
import type { Commentary } from "./commentary";

export type MarketsResponse = {
  market: MarketId;
  source: DataSource;
  updatedAt: number;
  quotes: Quote[];
};

export type AnalyzeResponse = {
  analysis: Analysis;
  commentary: Commentary;
  /** Analiz metinleri aktif dilde hazır değilse arayüz not gösterir. */
  analysisLocalized: boolean;
  quote: Quote | null;
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
    signal: SignalLabel;
    score: number;
    confidence: number;
  }[];
};

export type ScanRow = {
  id: string;
  market: MarketId;
  symbol: string;
  name: string;
  ticker: string;
  currency: string;
  price: number;
  changePercent: number;
  volume: number;
  signal: SignalLabel;
  score: number;
  confidence: number;
  rsi: number | null;
  adx: number | null;
  atrPercent: number;
  trendLabelKey: string;
  patterns: string[];
};

export type ScanResponse = {
  market: MarketId | "mixed";
  interval: Interval;
  source: DataSource;
  updatedAt: number;
  scanned: number;
  rows: ScanRow[];
};

export type SearchResponse = { results: Instrument[] };

export type ApiError = { error: string };

/** JSON getirir; hata gövdesindeki mesajı fırlatır. */
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

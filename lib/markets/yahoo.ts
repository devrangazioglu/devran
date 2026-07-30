/**
 * Hisse, endeks, emtia ve döviz verisi için Yahoo Finance uç noktaları.
 *
 * Anahtar gerektirmez. Bu uç noktalar Yahoo tarafından resmî olarak
 * dokümante edilmemiştir; sözleşme değişirse yalnızca bu dosya güncellenir
 * (piyasa katmanının geri kalanı sağlayıcıdan bağımsızdır).
 */

import {
  aggregateCandles,
  intervalMinutes,
  MarketDataError,
  type Candle,
  type Interval,
} from "./types";

const HOSTS = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];

// Yahoo, tarayıcı benzeri bir User-Agent olmadan bazı isteklere yanıt vermez.
const HEADERS = {
  accept: "application/json",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

let lastGoodHost: string | null = null;

async function request<T>(path: string, timeoutMs = 12_000): Promise<T> {
  const hosts = lastGoodHost ? [lastGoodHost, ...HOSTS.filter((h) => h !== lastGoodHost)] : HOSTS;
  let lastError: unknown = null;

  for (const host of hosts) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(host + path, {
        signal: controller.signal,
        headers: HEADERS,
        cache: "no-store",
      });

      if (response.status === 404) {
        throw new MarketDataError("Sembol bulunamadı.", 404);
      }
      if (response.status === 429) {
        throw new MarketDataError("Veri sağlayıcı istek limitine takıldı, birazdan tekrar deneyin.", 429);
      }
      if (!response.ok) throw new MarketDataError(`Veri sağlayıcı yanıtı: ${response.status}`, 502);

      lastGoodHost = host;
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof MarketDataError && (error.status === 404 || error.status === 429)) throw error;
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new MarketDataError(
    `Piyasa verisine ulaşılamadı (${lastError instanceof Error ? lastError.message : "bilinmeyen hata"}).`,
    503,
  );
}

/* ────────────────────────── Mum verisi ────────────────────────── */

type ChartResponse = {
  chart: {
    result:
      | {
          meta: {
            currency?: string;
            symbol: string;
            regularMarketPrice?: number;
            previousClose?: number;
            chartPreviousClose?: number;
            shortName?: string;
            longName?: string;
          };
          timestamp?: number[];
          indicators: {
            quote: {
              open?: (number | null)[];
              high?: (number | null)[];
              low?: (number | null)[];
              close?: (number | null)[];
              volume?: (number | null)[];
            }[];
          };
        }[]
      | null;
    error?: { description?: string } | null;
  };
};

/**
 * Yahoo'nun desteklediği periyot ve o periyot için istenecek geçmiş aralık.
 * 4 saatlik veri sunulmadığı için 1 saatlik mumlar dörtlü gruplanır; hisse
 * seanslarında bu gruplar seans saatlerine tam oturmaz, yaklaşık bir görünüm verir.
 */
const INTERVAL_MAP: Record<Interval, { interval: string; range: string; aggregate: number }> = {
  "1m": { interval: "1m", range: "5d", aggregate: 1 },
  "5m": { interval: "5m", range: "1mo", aggregate: 1 },
  "15m": { interval: "15m", range: "1mo", aggregate: 1 },
  "30m": { interval: "30m", range: "3mo", aggregate: 1 },
  "1h": { interval: "60m", range: "1y", aggregate: 1 },
  "4h": { interval: "60m", range: "2y", aggregate: 4 },
  "1d": { interval: "1d", range: "5y", aggregate: 1 },
  "1w": { interval: "1wk", range: "10y", aggregate: 1 },
};

export type YahooChart = {
  candles: Candle[];
  currency: string | null;
  name: string | null;
  price: number | null;
  previousClose: number | null;
};

export async function fetchChart(
  symbol: string,
  interval: Interval,
  limit = 300,
): Promise<YahooChart> {
  const map = INTERVAL_MAP[interval];
  const body = await request<ChartResponse>(
    `/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${map.interval}&range=${map.range}&includePrePost=false`,
  );

  const result = body.chart.result?.[0];
  if (!result) {
    throw new MarketDataError(
      body.chart.error?.description ?? "Bu sembol için veri bulunamadı.",
      404,
    );
  }

  const times = result.timestamp ?? [];
  const quote = result.indicators.quote[0] ?? {};
  const stepMs = intervalMinutes(interval) * 60_000;
  const raw: Candle[] = [];

  for (let i = 0; i < times.length; i++) {
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    // Yahoo, veri olmayan noktalarda null döndürür; bunlar atlanır.
    if (
      open === null || open === undefined ||
      high === null || high === undefined ||
      low === null || low === undefined ||
      close === null || close === undefined
    ) {
      continue;
    }
    const volume = quote.volume?.[i] ?? 0;
    const openTime = times[i] * 1000;
    raw.push({
      openTime,
      open,
      high,
      low,
      close,
      volume: volume ?? 0,
      closeTime: openTime + stepMs - 1,
      quoteVolume: (volume ?? 0) * close,
      trades: 0,
    });
  }

  const aggregated = aggregateCandles(raw, map.aggregate);

  return {
    candles: aggregated.slice(-limit),
    currency: result.meta.currency ?? null,
    name: result.meta.longName ?? result.meta.shortName ?? null,
    price: result.meta.regularMarketPrice ?? null,
    previousClose: result.meta.previousClose ?? result.meta.chartPreviousClose ?? null,
  };
}

/* ────────────────────────── Anlık fiyatlar ────────────────────────── */

type QuoteResponse = {
  quoteResponse?: {
    result?: {
      symbol: string;
      regularMarketPrice?: number;
      regularMarketPreviousClose?: number;
      regularMarketChangePercent?: number;
      regularMarketDayHigh?: number;
      regularMarketDayLow?: number;
      regularMarketVolume?: number;
      currency?: string;
      shortName?: string;
      longName?: string;
    }[];
  };
};

export type YahooQuote = {
  symbol: string;
  price: number;
  previousClose: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
  currency: string | null;
  name: string | null;
};

/**
 * Toplu fiyat sorgusu. Bu uç nokta zaman zaman oturum çerezi ister; başarısız
 * olursa çağıran taraf mum verisinden fiyat üretmeye düşer (bkz. `provider.ts`).
 */
export async function fetchQuotes(symbols: string[]): Promise<YahooQuote[]> {
  if (symbols.length === 0) return [];

  const body = await request<QuoteResponse>(
    `/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(","))}`,
  );
  const rows = body.quoteResponse?.result;
  if (!rows || rows.length === 0) {
    throw new MarketDataError("Toplu fiyat sorgusu boş döndü.", 502);
  }

  return rows
    .filter((row) => typeof row.regularMarketPrice === "number")
    .map((row) => {
      const price = row.regularMarketPrice as number;
      const previousClose = row.regularMarketPreviousClose ?? price;
      return {
        symbol: row.symbol,
        price,
        previousClose,
        changePercent:
          row.regularMarketChangePercent ??
          (previousClose === 0 ? 0 : ((price - previousClose) / previousClose) * 100),
        high: row.regularMarketDayHigh ?? price,
        low: row.regularMarketDayLow ?? price,
        volume: row.regularMarketVolume ?? 0,
        currency: row.currency ?? null,
        name: row.longName ?? row.shortName ?? null,
      };
    });
}

/* ────────────────────────── Arama ────────────────────────── */

type SearchResponse = {
  quotes?: {
    symbol?: string;
    shortname?: string;
    longname?: string;
    exchange?: string;
    quoteType?: string;
  }[];
};

export type YahooSearchHit = {
  symbol: string;
  name: string;
  exchange: string | null;
  quoteType: string | null;
};

export async function searchSymbols(query: string, count = 10): Promise<YahooSearchHit[]> {
  const body = await request<SearchResponse>(
    `/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=${count}&newsCount=0`,
    8000,
  );

  return (body.quotes ?? [])
    .filter((hit): hit is Required<Pick<typeof hit, "symbol">> & typeof hit => Boolean(hit.symbol))
    .map((hit) => ({
      symbol: hit.symbol as string,
      name: hit.longname ?? hit.shortname ?? (hit.symbol as string),
      exchange: hit.exchange ?? null,
      quoteType: hit.quoteType ?? null,
    }));
}

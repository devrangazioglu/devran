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

/**
 * Sağlayıcı adresleri. `MARKET_API_BASE` tanımlıysa yalnızca o kullanılır;
 * testlerde ve kapalı ağlarda sahte bir sunucuya yönlendirmeyi sağlar.
 */
const HOSTS = process.env.MARKET_API_BASE
  ? [process.env.MARKET_API_BASE]
  : ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];

// Yahoo, tarayıcı benzeri bir User-Agent olmadan bazı isteklere yanıt vermez.
const HEADERS = {
  accept: "application/json",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

let lastGoodHost: string | null = null;

/**
 * Hız sınırına takılınca kısa süre bekleyip yeniden dener.
 *
 * Yahoo 429'u ani yük sonrası birkaç yüz milisaniyede bırakabiliyor; tek bir
 * yavaş isteği beklemek, tüm taramayı hata ile bitirmekten iyidir. Deneme
 * sayısı bilinçli olarak düşük: sunucusuz ortamda istek süresi sınırlıdır.
 */
const RETRY_DELAYS_MS = [400, 1200];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/* ── Devre kesici ──────────────────────────────────────────────────
 *
 * Hız sınırına takıldığımızda yapılabilecek en kötü şey daha çok istek
 * atmaktır: 60 sembollük bir taramada her biri ayrı ayrı yeniden denenir,
 * hem sağlayıcı daha da kızar hem de istek dakikalarca sürer. Bir kez 429
 * gördükten sonra kısa bir süre boyunca ağa hiç çıkmadan aynı hatayı
 * döndürürüz; bekleme bitince normale dönülür.
 */
const COOLDOWN_MS = 30_000;
let blockedUntil = 0;

const RATE_LIMIT_MESSAGE = "Veri sağlayıcı istek limitine takıldı, birazdan tekrar deneyin.";

/** Testler için: devre kesiciyi sıfırlar. */
export function resetRateLimitState(): void {
  blockedUntil = 0;
}

export function rateLimitedUntil(): number {
  return blockedUntil;
}

async function requestOnce<T>(path: string, timeoutMs: number): Promise<T> {
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
        throw new MarketDataError(RATE_LIMIT_MESSAGE, 429);
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

async function request<T>(path: string, timeoutMs = 12_000): Promise<T> {
  // Bekleme süresi dolmadıysa ağa hiç çıkma.
  if (Date.now() < blockedUntil) throw new MarketDataError(RATE_LIMIT_MESSAGE, 429);

  for (let attempt = 0; ; attempt++) {
    try {
      return await requestOnce<T>(path, timeoutMs);
    } catch (error) {
      const rateLimited = error instanceof MarketDataError && error.status === 429;
      if (!rateLimited) throw error;
      if (attempt >= RETRY_DELAYS_MS.length) {
        // Yeniden denemeler de yetmedi: bir süre tamamen geri çekil.
        blockedUntil = Date.now() + COOLDOWN_MS;
        throw error;
      }
      await sleep(RETRY_DELAYS_MS[attempt]);
      if (Date.now() < blockedUntil) throw error;
    }
  }
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

/* ── Toplu fiyat: spark ────────────────────────────────────────────
 *
 * `/v7/finance/quote` artık oturum çerezi (crumb) istiyor ve çoğu zaman
 * reddediliyor. Bunun yerine tek istekte çok sembol dönen `spark` uç noktası
 * kullanılır: 60 sembol için 60 değil 1 istek demektir; hız sınırına
 * takılmanın başlıca sebebi buydu.
 */

type SparkResponse = {
  spark?: {
    result?: {
      symbol: string;
      response?: {
        meta?: {
          symbol?: string;
          currency?: string;
          regularMarketPrice?: number;
          previousClose?: number;
          chartPreviousClose?: number;
          regularMarketDayHigh?: number;
          regularMarketDayLow?: number;
          regularMarketVolume?: number;
          shortName?: string;
          longName?: string;
        };
        indicators?: { quote?: { close?: (number | null)[] }[] };
      }[];
    }[];
  };
};

/** Spark yanıtını fiyat listesine çevirir. Ağdan bağımsızdır (test edilebilir). */
export function parseSpark(body: SparkResponse): YahooQuote[] {
  const out: YahooQuote[] = [];

  for (const entry of body.spark?.result ?? []) {
    const meta = entry.response?.[0]?.meta;
    if (!meta) continue;

    const closes = (entry.response?.[0]?.indicators?.quote?.[0]?.close ?? []).filter(
      (value): value is number => typeof value === "number",
    );
    const price = meta.regularMarketPrice ?? closes[closes.length - 1];
    if (typeof price !== "number") continue;

    const previousClose = meta.previousClose ?? meta.chartPreviousClose ?? closes[0] ?? price;
    out.push({
      symbol: meta.symbol ?? entry.symbol,
      price,
      previousClose,
      changePercent: previousClose === 0 ? 0 : ((price - previousClose) / previousClose) * 100,
      // Spark gün içi uç değerleri vermiyor; seriden türetilir.
      high: meta.regularMarketDayHigh ?? (closes.length ? Math.max(...closes) : price),
      low: meta.regularMarketDayLow ?? (closes.length ? Math.min(...closes) : price),
      volume: meta.regularMarketVolume ?? 0,
      currency: meta.currency ?? null,
      name: meta.longName ?? meta.shortName ?? null,
    });
  }

  return out;
}

/** Tek istekte birçok sembolün fiyatı. Sembol sayısı fazlaysa parçalara böler. */
export async function fetchSparkQuotes(symbols: string[]): Promise<YahooQuote[]> {
  if (symbols.length === 0) return [];

  const CHUNK = 40; // uzun URL'ler reddedilebiliyor
  const chunks: string[][] = [];
  for (let i = 0; i < symbols.length; i += CHUNK) chunks.push(symbols.slice(i, i + CHUNK));

  const results: YahooQuote[] = [];
  for (const chunk of chunks) {
    const body = await request<SparkResponse>(
      `/v8/finance/spark?symbols=${encodeURIComponent(chunk.join(","))}&range=1d&interval=5m`,
    );
    results.push(...parseSpark(body));
  }

  if (results.length === 0) throw new MarketDataError("Toplu fiyat sorgusu boş döndü.", 502);
  return results;
}

/**
 * Eski toplu fiyat uç noktası. Oturum çerezi istediği için çoğu ortamda
 * çalışmaz; `fetchSparkQuotes` başarısız olursa denenir.
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

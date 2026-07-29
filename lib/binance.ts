/**
 * Binance genel (public) REST API istemcisi.
 *
 * - API anahtarı gerektirmez; yalnızca herkese açık piyasa verisi okunur.
 * - Birden fazla uç nokta denenir (bir bölge/host engellenirse diğerine düşer).
 * - Yanıtlar kısa süreli bellek içi önbellekte tutulur (istek limitini korumak için).
 * - Hiçbir uç noktaya ulaşılamazsa `DEMO_DATA=1` ile üretilmiş, açıkça
 *   "demo" olarak işaretlenen sentetik veriye düşülür (geliştirme/çevrimdışı için).
 */

export type Candle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  quoteVolume: number;
  trades: number;
};

export type Ticker = {
  symbol: string;
  base: string;
  quote: string;
  lastPrice: number;
  priceChange: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  quoteVolume: number;
  trades: number;
};

export type DataSource = "binance" | "demo";

export type Interval =
  | "1m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "4h"
  | "1d"
  | "1w";

export const INTERVALS: { value: Interval; label: string; minutes: number }[] = [
  { value: "1m", label: "1 dakika", minutes: 1 },
  { value: "5m", label: "5 dakika", minutes: 5 },
  { value: "15m", label: "15 dakika", minutes: 15 },
  { value: "30m", label: "30 dakika", minutes: 30 },
  { value: "1h", label: "1 saat", minutes: 60 },
  { value: "4h", label: "4 saat", minutes: 240 },
  { value: "1d", label: "1 gün", minutes: 1440 },
  { value: "1w", label: "1 hafta", minutes: 10080 },
];

export function isInterval(value: string): value is Interval {
  return INTERVALS.some((i) => i.value === value);
}

/** Sembolün geçerli bir Binance sembolü olup olmadığını kabaca doğrular. */
export function normalizeSymbol(input: string): string | null {
  const symbol = input.trim().toUpperCase();
  return /^[A-Z0-9]{4,20}$/.test(symbol) ? symbol : null;
}

const HOSTS = [
  "https://api.binance.com",
  "https://api-gcp.binance.com",
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://data-api.binance.vision",
];

const QUOTES = ["USDT", "FDUSD", "USDC", "TUSD", "BTC", "ETH", "BNB", "TRY", "EUR"];

/** Sembolü baz ve kotasyon varlığına ayırır: BTCUSDT → BTC / USDT. */
export function splitSymbol(symbol: string): { base: string; quote: string } {
  for (const quote of QUOTES) {
    if (symbol.endsWith(quote) && symbol.length > quote.length) {
      return { base: symbol.slice(0, -quote.length), quote };
    }
  }
  return { base: symbol, quote: "" };
}

/* ────────────────────────────── Önbellek ────────────────────────────── */

type CacheEntry = { expires: number; value: unknown };
const cache = new Map<string, CacheEntry>();

function readCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

function writeCache(key: string, value: unknown, ttlMs: number) {
  // Önbellek sınırsız büyümesin.
  if (cache.size > 500) {
    for (const [k, v] of cache) if (v.expires < Date.now()) cache.delete(k);
  }
  cache.set(key, { expires: Date.now() + ttlMs, value });
}

/* ────────────────────────────── İstek ────────────────────────────── */

export class BinanceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "BinanceError";
  }
}

let lastGoodHost: string | null = null;

async function request<T>(path: string, timeoutMs = 10_000): Promise<T> {
  const hosts = lastGoodHost ? [lastGoodHost, ...HOSTS.filter((h) => h !== lastGoodHost)] : HOSTS;
  let lastError: unknown = null;

  for (const host of hosts) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(host + path, {
        signal: controller.signal,
        headers: { accept: "application/json" },
        cache: "no-store",
      });

      if (response.status === 429 || response.status === 418) {
        throw new BinanceError(
          "Binance istek limitine takıldı, birazdan tekrar deneyin.",
          429,
        );
      }
      if (response.status === 400) {
        // Geçersiz sembol/parametre — başka host denemek anlamsız.
        const body = (await response.json().catch(() => null)) as { msg?: string } | null;
        throw new BinanceError(body?.msg ?? "Geçersiz istek (sembol bulunamadı?)", 400);
      }
      if (!response.ok) throw new BinanceError(`Binance yanıtı: ${response.status}`, 502);

      lastGoodHost = host;
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof BinanceError && (error.status === 400 || error.status === 429)) throw error;
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new BinanceError(
    `Binance API'sine ulaşılamadı (${lastError instanceof Error ? lastError.message : "bilinmeyen hata"}).`,
    503,
  );
}

/** Ağ erişimi yoksa sentetik veriye düşülsün mü? */
function demoEnabled(): boolean {
  return process.env.DEMO_DATA === "1";
}

/* ────────────────────────────── Mum verisi ────────────────────────────── */

type RawKline = [
  number, string, string, string, string, string, number, string, number,
  string, string, string,
];

export type CandleResponse = { candles: Candle[]; source: DataSource };

export async function fetchCandles(
  symbol: string,
  interval: Interval,
  limit = 300,
): Promise<CandleResponse> {
  const key = `klines:${symbol}:${interval}:${limit}`;
  const cached = readCache<CandleResponse>(key);
  if (cached) return cached;

  try {
    const raw = await request<RawKline[]>(
      `/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`,
    );
    const candles: Candle[] = raw.map((k) => ({
      openTime: k[0],
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5]),
      closeTime: k[6],
      quoteVolume: Number(k[7]),
      trades: k[8],
    }));
    const result: CandleResponse = { candles, source: "binance" };
    writeCache(key, result, ttlForInterval(interval));
    return result;
  } catch (error) {
    if (error instanceof BinanceError && error.status === 503 && demoEnabled()) {
      const result: CandleResponse = {
        candles: demoCandles(symbol, interval, limit),
        source: "demo",
      };
      writeCache(key, result, 30_000);
      return result;
    }
    throw error;
  }
}

function ttlForInterval(interval: Interval): number {
  const minutes = INTERVALS.find((i) => i.value === interval)?.minutes ?? 60;
  // Mum periyodunun ~1/20'si kadar, 10 sn ile 5 dk arasında.
  return Math.min(Math.max((minutes * 60_000) / 20, 10_000), 300_000);
}

/* ────────────────────────────── Piyasa özeti ────────────────────────────── */

type RawTicker = {
  symbol: string;
  lastPrice: string;
  priceChange: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  count: number;
};

export type TickerResponse = { tickers: Ticker[]; source: DataSource };

function toTicker(raw: RawTicker): Ticker {
  const { base, quote } = splitSymbol(raw.symbol);
  return {
    symbol: raw.symbol,
    base,
    quote,
    lastPrice: Number(raw.lastPrice),
    priceChange: Number(raw.priceChange),
    priceChangePercent: Number(raw.priceChangePercent),
    highPrice: Number(raw.highPrice),
    lowPrice: Number(raw.lowPrice),
    volume: Number(raw.volume),
    quoteVolume: Number(raw.quoteVolume),
    trades: raw.count,
  };
}

/** Tüm USDT paritelerinin 24 saatlik özeti, hacme göre sıralı. */
export async function fetchMarkets(quote = "USDT"): Promise<TickerResponse> {
  const key = `markets:${quote}`;
  const cached = readCache<TickerResponse>(key);
  if (cached) return cached;

  try {
    const raw = await request<RawTicker[]>("/api/v3/ticker/24hr", 15_000);
    const tickers = raw
      .map(toTicker)
      .filter(
        (t) =>
          t.quote === quote &&
          // Kaldıraçlı token'ları ve stablecoin-stablecoin paritelerini ele
          !/(UP|DOWN|BULL|BEAR)$/.test(t.base) &&
          !["USDC", "FDUSD", "TUSD", "BUSD", "DAI", "EUR", "TRY"].includes(t.base) &&
          t.quoteVolume > 0,
      )
      .sort((a, b) => b.quoteVolume - a.quoteVolume);

    const result: TickerResponse = { tickers, source: "binance" };
    writeCache(key, result, 20_000);
    return result;
  } catch (error) {
    if (error instanceof BinanceError && error.status === 503 && demoEnabled()) {
      const result: TickerResponse = { tickers: demoMarkets(quote), source: "demo" };
      writeCache(key, result, 20_000);
      return result;
    }
    throw error;
  }
}

/** Tek bir sembolün 24 saatlik özeti. */
export async function fetchTicker(symbol: string): Promise<{ ticker: Ticker; source: DataSource }> {
  const key = `ticker:${symbol}`;
  const cached = readCache<{ ticker: Ticker; source: DataSource }>(key);
  if (cached) return cached;

  try {
    const raw = await request<RawTicker>(
      `/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`,
    );
    const result = { ticker: toTicker(raw), source: "binance" as const };
    writeCache(key, result, 15_000);
    return result;
  } catch (error) {
    if (error instanceof BinanceError && error.status === 503 && demoEnabled()) {
      const markets = demoMarkets(splitSymbol(symbol).quote || "USDT");
      const found =
        markets.find((t) => t.symbol === symbol) ?? demoTicker(symbol);
      const result = { ticker: found, source: "demo" as const };
      writeCache(key, result, 15_000);
      return result;
    }
    throw error;
  }
}

/* ────────────────────────────── Demo veri ────────────────────────────── */
/*
 * Ağ erişimi olmayan ortamlarda (kapalı geliştirme ortamı, CI) arayüzün ve
 * analiz motorunun çalışabilmesi için deterministik sentetik veri üretir.
 * Bu veri gerçek piyasayı YANSITMAZ; arayüzde "demo veri" rozetiyle gösterilir.
 */

const DEMO_COINS: { base: string; price: number; vol: number }[] = [
  { base: "BTC", price: 83411, vol: 2_400_000_000 },
  { base: "ETH", price: 1799.47, vol: 1_100_000_000 },
  { base: "SOL", price: 116.45, vol: 720_000_000 },
  { base: "BNB", price: 592.3, vol: 410_000_000 },
  { base: "XRP", price: 2.13, vol: 390_000_000 },
  { base: "DOGE", price: 0.1642, vol: 280_000_000 },
  { base: "ADA", price: 0.6421, vol: 190_000_000 },
  { base: "AVAX", price: 21.87, vol: 150_000_000 },
  { base: "LINK", price: 14.31, vol: 140_000_000 },
  { base: "DOT", price: 3.97, vol: 95_000_000 },
  { base: "LTC", price: 82.77, vol: 88_000_000 },
  { base: "TRX", price: 0.2431, vol: 76_000_000 },
  { base: "MATIC", price: 0.2187, vol: 62_000_000 },
  { base: "NEAR", price: 2.41, vol: 54_000_000 },
  { base: "ATOM", price: 4.12, vol: 41_000_000 },
  { base: "UNI", price: 5.83, vol: 38_000_000 },
  { base: "APT", price: 5.11, vol: 33_000_000 },
  { base: "ARB", price: 0.3312, vol: 29_000_000 },
  { base: "OP", price: 0.7241, vol: 24_000_000 },
  { base: "INJ", price: 8.94, vol: 21_000_000 },
];

/** Tohumlanabilir (deterministik) sözde rastgele üreteç — mulberry32. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function basePrice(symbol: string): number {
  const { base } = splitSymbol(symbol);
  const known = DEMO_COINS.find((c) => c.base === base);
  if (known) return known.price;
  return 1 + (hash(base) % 40000) / 100;
}

function demoCandles(symbol: string, interval: Interval, limit: number): Candle[] {
  const minutes = INTERVALS.find((i) => i.value === interval)?.minutes ?? 60;
  const step = minutes * 60_000;
  const now = Math.floor(Date.now() / step) * step;
  const random = seeded(hash(symbol + interval));

  const start = basePrice(symbol);
  // Rastgele yürüyüş + yavaş trend dalgası, gerçekçi bir görüntü için.
  const drift = (random() - 0.5) * 0.0006;
  const volatility = 0.004 + random() * 0.01;

  const candles: Candle[] = [];
  let price = start * (0.8 + random() * 0.3);

  for (let i = limit - 1; i >= 0; i--) {
    const openTime = now - i * step;
    const wave = Math.sin((limit - i) / 18) * volatility * 0.8;
    const shock = (random() - 0.5) * volatility * 2;
    const open = price;
    price = Math.max(price * (1 + drift + wave * 0.25 + shock), 0.00001);
    const close = price;
    const spread = Math.abs(close - open) + open * volatility * random();
    const high = Math.max(open, close) + spread * random() * 0.6;
    const low = Math.min(open, close) - spread * random() * 0.6;
    const volume = (1000 + random() * 4000) * (1 + Math.abs(shock) * 40);

    candles.push({
      openTime,
      open,
      high,
      low: Math.max(low, 0.000001),
      close,
      volume,
      closeTime: openTime + step - 1,
      quoteVolume: volume * close,
      trades: Math.round(volume / 3),
    });
  }
  return candles;
}

function demoTicker(symbol: string): Ticker {
  const candles = demoCandles(symbol, "1h", 25);
  const { base, quote } = splitSymbol(symbol);
  const first = candles[0].open;
  const lastCandle = candles[candles.length - 1];
  const known = DEMO_COINS.find((c) => c.base === base);
  const volume = known?.vol ?? 5_000_000 + (hash(symbol) % 20_000_000);
  return {
    symbol,
    base,
    quote: quote || "USDT",
    lastPrice: lastCandle.close,
    priceChange: lastCandle.close - first,
    priceChangePercent: ((lastCandle.close - first) / first) * 100,
    highPrice: Math.max(...candles.map((c) => c.high)),
    lowPrice: Math.min(...candles.map((c) => c.low)),
    volume: volume / lastCandle.close,
    quoteVolume: volume,
    trades: Math.round(volume / 1000),
  };
}

function demoMarkets(quote: string): Ticker[] {
  return DEMO_COINS.map((coin) => demoTicker(`${coin.base}${quote}`)).sort(
    (a, b) => b.quoteVolume - a.quoteVolume,
  );
}

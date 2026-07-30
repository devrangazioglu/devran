/**
 * Tüm piyasalar için tek giriş noktası.
 *
 * Sayfalar ve API route'ları yalnızca bu modülü kullanır; hangi piyasanın
 * hangi sağlayıcıdan geldiğini bilmeleri gerekmez.
 *   • kripto            → `lib/binance.ts`
 *   • abd / bist / emtia → `lib/markets/yahoo.ts`
 */

import { fetchCandles as fetchCryptoCandles, fetchMarkets as fetchCryptoMarkets } from "../binance";
import { demoCandles } from "./demo";
import {
  allStaticInstruments,
  findStaticInstrument,
  instrumentAliases,
  staticInstruments,
} from "./instruments";
import {
  demoEnabled,
  foldText,
  instrumentId,
  MarketDataError,
  MARKETS,
  type Candle,
  type DataSource,
  type Instrument,
  type Interval,
  type MarketId,
  type Quote,
} from "./types";
import { fetchChart, fetchQuotes, searchSymbols } from "./yahoo";

/* ────────────────────────── Kripto adları ────────────────────────── */

const COIN_NAMES: Record<string, string> = {
  BTC: "Bitcoin", ETH: "Ethereum", BNB: "BNB", SOL: "Solana", XRP: "XRP",
  ADA: "Cardano", DOGE: "Dogecoin", TRX: "TRON", DOT: "Polkadot", LINK: "Chainlink",
  MATIC: "Polygon", LTC: "Litecoin", AVAX: "Avalanche", ATOM: "Cosmos", UNI: "Uniswap",
  NEAR: "NEAR Protocol", APT: "Aptos", ARB: "Arbitrum", OP: "Optimism", INJ: "Injective",
  FIL: "Filecoin", ETC: "Ethereum Classic", XLM: "Stellar", ICP: "Internet Computer",
  HBAR: "Hedera", VET: "VeChain", ALGO: "Algorand", AAVE: "Aave", SUI: "Sui",
  SEI: "Sei", TIA: "Celestia", RNDR: "Render", FET: "Artificial Superintelligence",
  PEPE: "Pepe", SHIB: "Shiba Inu", WIF: "dogwifhat", BONK: "Bonk",
};

const QUOTE_ASSETS = ["USDT", "FDUSD", "USDC", "TUSD", "BTC", "ETH", "BNB", "TRY", "EUR"];

function splitCryptoSymbol(symbol: string): { base: string; quote: string } {
  for (const quote of QUOTE_ASSETS) {
    if (symbol.endsWith(quote) && symbol.length > quote.length) {
      return { base: symbol.slice(0, -quote.length), quote };
    }
  }
  return { base: symbol, quote: "USDT" };
}

function cryptoInstrument(symbol: string): Instrument {
  const { base, quote } = splitCryptoSymbol(symbol);
  return {
    id: instrumentId("kripto", symbol),
    market: "kripto",
    symbol,
    name: COIN_NAMES[base] ?? base,
    ticker: `${base}/${quote}`,
    currency: quote,
    kind: "kripto",
  };
}

/* ────────────────────────── Önbellek ────────────────────────── */

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
  if (cache.size > 400) {
    for (const [k, v] of cache) if (v.expires < Date.now()) cache.delete(k);
  }
  cache.set(key, { expires: Date.now() + ttlMs, value });
}

/* ────────────────────────── Enstrüman çözümleme ────────────────────────── */

/** Sembolü kabaca doğrular (enjeksiyon ve saçma girdileri engeller). */
export function normalizeSymbol(market: MarketId, input: string): string | null {
  const symbol = input.trim().toUpperCase();
  if (market === "kripto") {
    return /^[A-Z0-9]{4,20}$/.test(symbol) ? symbol : null;
  }
  // Yahoo sembolleri: AAPL, THYAO.IS, GC=F, EURUSD=X, DX-Y.NYB, ^GSPC
  return /^[\^A-Z0-9][A-Z0-9.=\-^]{0,14}$/.test(symbol) ? symbol : null;
}

/** Piyasa + sembol için enstrüman bilgisi; tanımlı listede yoksa sağlayıcıdan türetir. */
export async function getInstrument(market: MarketId, symbol: string): Promise<Instrument> {
  if (market === "kripto") return cryptoInstrument(symbol);

  const known = findStaticInstrument(market, symbol);
  if (known) return known;

  // Listede olmayan sembol (aramadan gelmiş olabilir): adını sağlayıcıdan al.
  const fallback: Instrument = {
    id: instrumentId(market, symbol),
    market,
    symbol,
    name: symbol,
    ticker: symbol.replace(/\.IS$|=X$|=F$/, ""),
    currency: MARKETS[market].currency,
    kind: market === "bist" || market === "abd" ? "hisse" : "emtia",
  };

  try {
    const chart = await fetchChart(symbol, "1d", 5);
    return {
      ...fallback,
      name: chart.name ?? fallback.name,
      currency: chart.currency ?? fallback.currency,
    };
  } catch {
    return fallback;
  }
}

/** Bir piyasadaki tüm enstrümanlar (kriptoda hacme göre ilk N parite). */
export async function getInstruments(market: MarketId, limit = 60): Promise<Instrument[]> {
  if (market !== "kripto") return staticInstruments(market);

  try {
    const { tickers } = await fetchCryptoMarkets("USDT");
    return tickers.slice(0, limit).map((t) => cryptoInstrument(t.symbol));
  } catch {
    return [];
  }
}

/* ────────────────────────── Fiyat listeleri ────────────────────────── */

export type QuoteList = { quotes: Quote[]; source: DataSource; updatedAt: number };

/** Yahoo tarafındaki enstrümanlar için fiyat listesi. */
async function yahooQuotes(instruments: Instrument[]): Promise<QuoteList> {
  const symbols = instruments.map((i) => i.symbol);
  const bySymbol = new Map(instruments.map((i) => [i.symbol, i]));

  try {
    const rows = await fetchQuotes(symbols);
    const quotes: Quote[] = [];
    for (const row of rows) {
      const instrument = bySymbol.get(row.symbol);
      if (!instrument) continue;
      quotes.push({
        ...instrument,
        name: instrument.name || row.name || instrument.symbol,
        currency: row.currency ?? instrument.currency,
        price: row.price,
        previousClose: row.previousClose,
        changePercent: row.changePercent,
        high: row.high,
        low: row.low,
        // Karşılaştırılabilir olması için hacmi para birimi cinsine çeviriyoruz.
        volume: row.volume * row.price,
        updatedAt: Date.now(),
      });
    }
    if (quotes.length > 0) return { quotes, source: "canli", updatedAt: Date.now() };
    throw new MarketDataError("Fiyat listesi boş döndü.", 502);
  } catch (error) {
    // Toplu sorgu çalışmazsa günlük mumlardan fiyat üret (uç nokta oturum isteyebiliyor).
    const quotes = await mapWithLimit(instruments, 6, async (instrument) => {
      try {
        const chart = await fetchChart(instrument.symbol, "1d", 5);
        const candles = chart.candles;
        if (candles.length === 0) return null;
        const last = candles[candles.length - 1];
        const previousClose =
          chart.previousClose ?? candles[candles.length - 2]?.close ?? last.open;
        const price = chart.price ?? last.close;
        return {
          ...instrument,
          name: instrument.name || chart.name || instrument.symbol,
          currency: chart.currency ?? instrument.currency,
          price,
          previousClose,
          changePercent: previousClose === 0 ? 0 : ((price - previousClose) / previousClose) * 100,
          high: last.high,
          low: last.low,
          volume: last.volume * price,
          updatedAt: Date.now(),
        } satisfies Quote;
      } catch {
        return null;
      }
    });

    const clean = quotes.filter((q): q is Quote => q !== null);
    if (clean.length > 0) return { quotes: clean, source: "canli", updatedAt: Date.now() };

    if (demoEnabled()) return demoQuotes(instruments);
    throw error instanceof MarketDataError
      ? error
      : new MarketDataError("Piyasa verisi alınamadı.", 503);
  }
}

/** Demo fiyat listesi (sentetik veri). */
function demoQuotes(instruments: Instrument[]): QuoteList {
  const quotes = instruments.map((instrument) => {
    const candles = demoCandles(instrument.symbol, "1d", 8);
    const last = candles[candles.length - 1];
    const previousClose = candles[candles.length - 2]?.close ?? last.open;
    return {
      ...instrument,
      price: last.close,
      previousClose,
      changePercent: ((last.close - previousClose) / previousClose) * 100,
      high: Math.max(...candles.slice(-2).map((c) => c.high)),
      low: Math.min(...candles.slice(-2).map((c) => c.low)),
      volume: last.volume * last.close,
      updatedAt: Date.now(),
    } satisfies Quote;
  });
  return { quotes, source: "demo", updatedAt: Date.now() };
}

/** Bir piyasanın fiyat listesi, hacme göre sıralı. */
export async function getQuotes(market: MarketId, limit = 60): Promise<QuoteList> {
  const key = `quotes:${market}:${limit}`;
  const cached = readCache<QuoteList>(key);
  if (cached) return cached;

  let result: QuoteList;

  if (market === "kripto") {
    try {
      const { tickers, source } = await fetchCryptoMarkets("USDT");
      result = {
        quotes: tickers.slice(0, limit).map((t) => ({
          ...cryptoInstrument(t.symbol),
          price: t.lastPrice,
          previousClose: t.lastPrice - t.priceChange,
          changePercent: t.priceChangePercent,
          high: t.highPrice,
          low: t.lowPrice,
          volume: t.quoteVolume,
          updatedAt: Date.now(),
        })),
        source,
        updatedAt: Date.now(),
      };
    } catch (error) {
      if (!demoEnabled()) throw error;
      result = demoQuotes(await getInstruments("kripto", limit));
    }
  } else {
    result = await yahooQuotes(staticInstruments(market).slice(0, limit));
  }

  // Endeksler listenin başında kalsın, gerisi hacme göre sıralanır.
  result.quotes.sort((a, b) => {
    if (a.kind === "endeks" && b.kind !== "endeks") return -1;
    if (b.kind === "endeks" && a.kind !== "endeks") return 1;
    return b.volume - a.volume;
  });

  writeCache(key, result, market === "kripto" ? 20_000 : 60_000);
  return result;
}

/* ────────────────────────── Mum verisi ────────────────────────── */

export type CandleSet = {
  instrument: Instrument;
  candles: Candle[];
  source: DataSource;
};

export async function getCandles(
  market: MarketId,
  symbol: string,
  interval: Interval,
  limit = 300,
): Promise<CandleSet> {
  const instrument = await getInstrument(market, symbol);

  if (market === "kripto") {
    const { candles, source } = await fetchCryptoCandles(symbol, interval, limit);
    return { instrument, candles, source };
  }

  const key = `candles:${market}:${symbol}:${interval}:${limit}`;
  const cached = readCache<CandleSet>(key);
  if (cached) return cached;

  try {
    const chart = await fetchChart(symbol, interval, limit);
    if (chart.candles.length === 0) {
      throw new MarketDataError("Bu sembol ve periyot için veri bulunamadı.", 404);
    }
    const result: CandleSet = {
      instrument: {
        ...instrument,
        name: instrument.name || chart.name || symbol,
        currency: chart.currency ?? instrument.currency,
      },
      candles: chart.candles,
      source: "canli",
    };
    writeCache(key, result, 60_000);
    return result;
  } catch (error) {
    if (demoEnabled() && (!(error instanceof MarketDataError) || error.status >= 500)) {
      const result: CandleSet = {
        instrument,
        candles: demoCandles(symbol, interval, limit),
        source: "demo",
      };
      writeCache(key, result, 30_000);
      return result;
    }
    throw error;
  }
}

/* ────────────────────────── Arama ────────────────────────── */

/** `needle` daha önce `foldText` ile indirgenmiş olmalıdır. */
function matches(instrument: Instrument, needle: string): boolean {
  return (
    foldText(instrument.ticker).includes(needle) ||
    foldText(instrument.symbol).includes(needle) ||
    foldText(instrument.name).includes(needle) ||
    instrumentAliases(instrument.id).includes(needle)
  );
}

/** Yahoo arama sonucunu uygulama piyasalarına eşler. */
function mapSearchHit(exchange: string | null, quoteType: string | null): MarketId | null {
  const type = (quoteType ?? "").toUpperCase();
  const market = (exchange ?? "").toUpperCase();

  if (type === "CRYPTOCURRENCY") return null; // kripto tarafı kendi sağlayıcısından geliyor
  if (market === "IST") return "bist";
  if (type === "CURRENCY" || type === "FUTURE" || type === "COMMODITY") return "emtia";
  if (["NMS", "NYQ", "NGM", "PCX", "ASE", "BTS", "NCM", "NYS"].includes(market)) return "abd";
  if (type === "INDEX") return "abd";
  return null;
}

/** Tüm piyasalarda varlık arar. */
export async function searchInstruments(query: string, limit = 12): Promise<Instrument[]> {
  const needle = foldText(query.trim());
  if (needle.length < 1) return [];

  const results: Instrument[] = [];
  const seen = new Set<string>();
  const push = (instrument: Instrument) => {
    if (seen.has(instrument.id) || results.length >= limit) return;
    seen.add(instrument.id);
    results.push(instrument);
  };

  // 1) Tanımlı listeler (hisse, endeks, emtia, döviz)
  for (const instrument of allStaticInstruments()) {
    if (matches(instrument, needle)) push(instrument);
  }

  // 2) Kripto pariteleri
  try {
    const { tickers } = await fetchCryptoMarkets("USDT");
    for (const ticker of tickers) {
      const instrument = cryptoInstrument(ticker.symbol);
      if (matches(instrument, needle)) push(instrument);
    }
  } catch {
    // kripto listesi alınamadıysa arama yalnızca diğer piyasalarda çalışır
  }

  // 3) Listede olmayan semboller için sağlayıcı aramasına başvur
  if (results.length < limit && needle.length >= 2) {
    try {
      const hits = await searchSymbols(query, 12);
      for (const hit of hits) {
        const market = mapSearchHit(hit.exchange, hit.quoteType);
        if (!market) continue;
        const symbol = normalizeSymbol(market, hit.symbol);
        if (!symbol) continue;
        push({
          id: instrumentId(market, symbol),
          market,
          symbol,
          name: hit.name,
          ticker: symbol.replace(/\.IS$|=X$|=F$/, ""),
          currency: MARKETS[market].currency,
          kind: market === "emtia" ? "emtia" : "hisse",
        });
      }
    } catch {
      // sağlayıcı araması çalışmazsa yerel sonuçlar yeterli
    }
  }

  return results.slice(0, limit);
}

/* ────────────────────────── Yardımcı ────────────────────────── */

export async function mapWithLimit<T, R>(
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

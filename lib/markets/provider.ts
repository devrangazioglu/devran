/**
 * Tüm piyasalar için tek giriş noktası.
 *
 * Sayfalar ve API route'ları yalnızca bu modülü kullanır; hangi piyasanın
 * hangi sağlayıcıdan geldiğini bilmeleri gerekmez.
 *   • kripto            → `lib/binance.ts`
 *   • abd / bist / emtia → `lib/markets/yahoo.ts`
 */

import { fetchCandles as fetchCryptoCandles, fetchMarkets as fetchCryptoMarkets } from "../binance";
import { cryptoInstrument } from "./crypto-symbols";
import { demoCandles } from "./demo";
import {
  allStaticInstruments,
  displayTicker,
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
import { paylasilanOku, paylasilanYaz } from "./cache-store";
import { fetchFxCandles, fetchFxQuotes, parseFxPair } from "./frankfurter";
import { fetchStooqCandles, fetchStooqQuotes, toStooqSymbol, toStooqSymbols } from "./stooq";
import { fetchTwelveBatch, fetchTwelveCandles, twelveDataEnabled } from "./twelvedata";
import { fetchChart, fetchQuotes, fetchSparkQuotes, searchSymbols } from "./yahoo";

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
  if (cache.size > 800) {
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
    ticker: displayTicker(market, symbol),
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

/**
 * Bir kaynağın neden düştüğünü kısa, kullanıcıya gösterilebilir biçimde özetler.
 *
 * Kaynaklar sırayla denendiği için tek bir hata mesajı yanıltıcıydı: birinci
 * kaynak bambaşka bir sebeple düşse bile kullanıcı ikincinin mesajını
 * ("istek limitine takıldı") görüyor, hangisinin bozuk olduğu anlaşılmıyordu.
 */
function hataOzeti(error: unknown): string {
  if (error instanceof MarketDataError) return `HTTP ${error.status}`;
  if (error instanceof Error) return error.message.slice(0, 60);
  return "bilinmeyen";
}

export type QuoteList = { quotes: Quote[]; source: DataSource; updatedAt: number };

/* ──────────────── Paylaşımlı mum önbelleği ────────────────
 *
 * Kripto dışı her piyasa aynı ücretsiz katmandan besleniyor: dakikada birkaç,
 * günde birkaç yüz sembol. Bu yüzden veri iki yerde birden ekonomik tutulur:
 *
 *   • Anahtar periyot başına tek: `candles:piyasa:sembol:periyot`. İstenen mum
 *     sayısı anahtara girmez, yoksa aynı sembol 250 ve 300 mum için iki kez
 *     çekilirdi (iki kredi, aynı veri).
 *   • Fiyat listesi ayrı bir istek atmaz; son iki mumdan türetilir. Böylece bir
 *     kredi hem tabloyu hem grafiği doldurur.
 *
 * Önbellek Postgres'te paylaşılır: sunucusuz örnekler birbirinin belleğini
 * görmediği ve soğuk başlangıçta bellek silindiği için, tek başına bellek
 * kotayı boşa harcıyor ve liste hiç dolmuyordu.
 */

/** Günlük mum gün içinde ancak bir kez değişir; kotayı korumak için uzun tutulur. */
const GUNLUK_TTL_MS = 4 * 60 * 60_000;
const GUN_ICI_TTL_MS = 5 * 60_000;

/** Kripto dışı sağlayıcıdan her zaman bu kadar mum istenir (kredi aynı). */
const TAM_MUM = 300;

function candleCacheKey(market: MarketId, symbol: string, interval: Interval): string {
  return `candles:${market}:${symbol}:${interval}`;
}

/** Bellek → paylaşımlı önbellek sırasıyla okur, bulduğunu belleğe de yazar. */
async function paylasimliOku<T>(keys: string[]): Promise<Map<string, T>> {
  const out = new Map<string, T>();
  const eksik: string[] = [];

  for (const key of keys) {
    const mem = readCache<T>(key);
    if (mem) out.set(key, mem);
    else eksik.push(key);
  }
  if (eksik.length === 0) return out;

  for (const [key, kayit] of await paylasilanOku<T>(eksik)) {
    writeCache(key, kayit.deger, Math.max(1_000, kayit.biter - Date.now()));
    out.set(key, kayit.deger);
  }
  return out;
}

async function paylasimliYaz(key: string, value: unknown, ttlMs: number): Promise<void> {
  writeCache(key, value, ttlMs);
  await paylasilanYaz(key, value, ttlMs);
}

/** Mumlardan fiyat satırı türetir; ayrı bir kotasyon isteği harcamaz. */
function quoteFromCandles(instrument: Instrument, set: CandleSet): Quote | null {
  const candles = set.candles;
  if (candles.length === 0) return null;

  const son = candles[candles.length - 1];
  const onceki = candles[candles.length - 2] ?? son;
  return {
    ...instrument,
    price: son.close,
    previousClose: onceki.close,
    changePercent: onceki.close === 0 ? 0 : ((son.close - onceki.close) / onceki.close) * 100,
    high: son.high,
    low: son.low,
    volume: son.quoteVolume,
    // Verinin gerçek tazeliği gösterilsin; önbellekten geleni "şimdi" saymak
    // kullanıcıya yanlış bilgi olurdu.
    updatedAt: set.fetchedAt ?? Date.now(),
  };
}

/**
 * Toplu sorgu çalışmadığında sembol başına kaç istek atılacağının üst sınırı.
 *
 * En kalabalık piyasayı (ABD, 46 enstrüman) kapsayacak kadar geniş: aksi hâlde
 * sağlayıcı sağlıklıyken bile piyasa sayfası sessizce yarım listelenirdi.
 * İstek fırtınasına karşı asıl koruma bu sınır değil, hız sınırı görülünce
 * devreye giren geri çekilmedir (bkz. `yahoo.ts`).
 */
const PER_SYMBOL_FALLBACK_LIMIT = 60;

/**
 * Yahoo tarafındaki enstrümanlar için fiyat listesi.
 *
 * Sıra önemlidir: önce tek istekte çok sembol dönen `spark`, sonra eski toplu
 * uç nokta, en son sembol başına mum sorgusu. Sonuncusu 60 sembol için 60
 * istek demek olduğundan hız sınırını hızla tüketir; bu yüzden hem son çare
 * hem de sayıca sınırlıdır.
 */
async function yahooQuotes(instruments: Instrument[]): Promise<QuoteList> {
  const bySymbol = new Map(instruments.map((i) => [i.symbol, i]));

  const toplanan: Quote[] = [];
  let kalan = instruments;

  // Önce önbellekteki günlük mumlar: kota harcamadan fiyat verirler.
  // Liste tek anahtarda tutulsaydı, kredi bütçesi yüzünden yarım kalan liste
  // olduğu gibi saklanır ve her tazelemede yine aynı ilk semboller istenirdi —
  // liste hiç dolmazdı. Sembol başına saklayınca dolmuş semboller sıradan
  // çıkar, bütçe her turda YENİ sembollere harcanır ve liste birkaç turda
  // tamamlanır; üstelik dolduran ziyaretçi tek kişi olsa bile herkese açılır.
  const onbellekli = await paylasimliOku<CandleSet>(
    instruments.map((i) => candleCacheKey(i.market, i.symbol, "1d")),
  );
  for (const instrument of instruments) {
    const set = onbellekli.get(candleCacheKey(instrument.market, instrument.symbol, "1d"));
    const quote = set ? quoteFromCandles(instrument, set) : null;
    if (quote) toplanan.push(quote);
  }
  if (toplanan.length > 0) {
    const gelenler = new Set(toplanan.map((q) => q.symbol));
    kalan = kalan.filter((i) => !gelenler.has(i.symbol));
    if (kalan.length === 0) return { quotes: toplanan, source: "canli", updatedAt: Date.now() };
  }

  // Dövizler: anahtarsız çalışan tek kaynak. Taban para birimi başına tek istek.
  const fxSemboller = kalan.filter((i) => parseFxPair(i.symbol));
  if (fxSemboller.length > 0) {
    try {
      const satirlar = await fetchFxQuotes(fxSemboller.map((i) => i.symbol));
      const bySymbol = new Map(fxSemboller.map((i) => [i.symbol, i]));
      const yeni: Quote[] = [];
      for (const satir of satirlar) {
        const instrument = bySymbol.get(satir.symbol);
        if (!instrument) continue;
        yeni.push({
          ...instrument,
          price: satir.price,
          previousClose: satir.previousClose,
          changePercent:
            satir.previousClose === 0
              ? 0
              : ((satir.price - satir.previousClose) / satir.previousClose) * 100,
          high: Math.max(satir.price, satir.previousClose),
          low: Math.min(satir.price, satir.previousClose),
          // ECB kur verisinde hacim yok.
          volume: 0,
          updatedAt: Date.now(),
        });
      }
      toplanan.push(...yeni);
      const gelenler = new Set(yeni.map((q) => q.symbol));
      kalan = kalan.filter((i) => !gelenler.has(i.symbol));
    } catch {
      // Kur kaynağı düşerse aşağıdaki sağlayıcılar denenir.
    }
  }

  // Hisse, endeks ve emtia: anahtarlı sağlayıcı. Son iki mumdan fiyat türetilir,
  // böylece ayrı bir kotasyon isteği harcanmaz.
  if (kalan.length > 0 && twelveDataEnabled()) {
    try {
      // Fiyat için iki mum yeterdi ama tam seri de aynı krediye geliyor:
      // aynı istek hem tabloyu hem grafik/analiz önbelleğini dolduruyor.
      const seriler = await fetchTwelveBatch(
        kalan[0].market,
        kalan.map((i) => i.symbol),
        "1d",
        TAM_MUM,
      );
      const bySymbol = new Map(kalan.map((i) => [i.symbol, i]));
      const yeni: Quote[] = [];
      for (const [symbol, candles] of seriler) {
        const instrument = bySymbol.get(symbol);
        if (!instrument || candles.length === 0) continue;
        const set: CandleSet = {
          instrument,
          candles,
          source: "canli",
          fetchedAt: Date.now(),
        };
        await paylasimliYaz(
          candleCacheKey(instrument.market, instrument.symbol, "1d"),
          set,
          GUNLUK_TTL_MS,
        );
        const quote = quoteFromCandles(instrument, set);
        if (quote) yeni.push(quote);
      }
      toplanan.push(...yeni);
      const gelenler = new Set(yeni.map((q) => q.symbol));
      kalan = kalan.filter((i) => !gelenler.has(i.symbol));
    } catch {
      // Anahtar sorunluysa ya da kredi bittiyse eski kaynaklar denenir.
    }
  }

  if (kalan.length === 0 && toplanan.length > 0) {
    return { quotes: toplanan, source: "canli", updatedAt: Date.now() };
  }

  // Kalanlar için eski (anahtarsız) kaynaklar. Bunlar bulut IP'lerini
  // engelliyor olabilir; sonuç boş dönerse elde olanla devam edilir.
  const stooqEsleme = new Map<string, Instrument>();
  for (const instrument of kalan) {
    const stooq = toStooqSymbol(instrument.market, instrument.symbol);
    if (stooq) stooqEsleme.set(stooq, instrument);
  }

  let stooqQuoteHatasi: string | null = null;
  if (stooqEsleme.size > 0) {
    try {
      const satirlar = await fetchStooqQuotes([...stooqEsleme.keys()]);
      const quotes: Quote[] = [];
      for (const satir of satirlar) {
        const instrument = stooqEsleme.get(satir.symbol);
        if (!instrument) continue;
        const oncekiKapanis = satir.open || satir.close;
        quotes.push({
          ...instrument,
          price: satir.close,
          previousClose: oncekiKapanis,
          changePercent:
            oncekiKapanis === 0 ? 0 : ((satir.close - oncekiKapanis) / oncekiKapanis) * 100,
          high: satir.high,
          low: satir.low,
          volume: satir.volume * satir.close,
          updatedAt: Date.now(),
        });
      }
      if (quotes.length > 0) {
        return { quotes: [...toplanan, ...quotes], source: "canli", updatedAt: Date.now() };
      }
      stooqQuoteHatasi = "sonuç boş";
    } catch (error) {
      // Stooq çalışmazsa aşağıdaki Yahoo yolu denenir.
      stooqQuoteHatasi = hataOzeti(error);
    }
  }

  try {
    // Yalnızca eksik semboller sorulur: elde olanı yeniden istemek hem kotayı
    // harcar hem de listede aynı varlığı iki kez gösterirdi.
    const eksik = kalan.map((i) => i.symbol);
    const rows = await fetchSparkQuotes(eksik).catch(() => fetchQuotes(eksik));
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
    if (quotes.length > 0) {
      return { quotes: [...toplanan, ...quotes], source: "canli", updatedAt: Date.now() };
    }
    throw new MarketDataError("Fiyat listesi boş döndü.", 502);
  } catch (error) {
    // Toplu sorguların ikisi de çalışmazsa günlük mumlardan fiyat üretilir.
    // Sağlayıcıyı boğmamak için hem az eşzamanlılık hem de sembol üst sınırı var.
    const quotes = await mapWithLimit(kalan.slice(0, PER_SYMBOL_FALLBACK_LIMIT), 3, async (instrument) => {
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

    // Önceki kaynaklardan gelenler burada kaybolmamalı: bir piyasanın yarısı
    // çalışıyorsa yarısını göstermek, hepsini hataya çevirmekten iyidir.
    const hepsi = [...toplanan, ...clean];
    if (hepsi.length > 0) return { quotes: hepsi, source: "canli", updatedAt: Date.now() };

    if (demoEnabled()) return demoQuotes(instruments);

    // Kota hatası teknik ayrıntı değil, bekleme meselesi: kullanıcıya ne
    // yapması gerektiğini söyleyen bir cümle daha yararlı.
    if (error instanceof MarketDataError && error.status === 429) {
      throw new MarketDataError(
        "Ücretsiz veri kotası şu an dolu. Liste birkaç dakika içinde kendiliğinden dolacak.",
        429,
      );
    }
    throw new MarketDataError(
      `Fiyat listesi alınamadı (kaynak 1: ${stooqQuoteHatasi ?? "denenmedi"}, kaynak 2: ${hataOzeti(error)}).`,
      error instanceof MarketDataError ? error.status : 503,
    );
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
  let hedefSayisi = 0;

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
    hedefSayisi = staticInstruments(market).slice(0, limit).length;
    result = await yahooQuotes(staticInstruments(market).slice(0, limit));
  }

  // Endeksler listenin başında kalsın, gerisi hacme göre sıralanır.
  result.quotes.sort((a, b) => {
    if (a.kind === "endeks" && b.kind !== "endeks") return -1;
    if (b.kind === "endeks" && a.kind !== "endeks") return 1;
    return b.volume - a.volume;
  });

  // Liste eksikse kısa süre saklanır: kredi bütçesi dakikada yenilendiği için
  // bir sonraki ziyaret kalan sembolleri çekip listeyi büyütebilsin.
  const eksikListe = hedefSayisi > 0 && result.quotes.length < hedefSayisi;
  writeCache(key, result, market === "kripto" ? 20_000 : eksikListe ? 45_000 : 180_000);
  return result;
}

/* ────────────────────────── Mum verisi ────────────────────────── */

export type CandleSet = {
  instrument: Instrument;
  candles: Candle[];
  source: DataSource;
  /** Verinin sağlayıcıdan çekildiği an; önbellekten gelenin yaşı görünsün diye. */
  fetchedAt?: number;
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

  // Anahtarda mum sayısı yok: 250 ve 300 mumluk iki istek aynı krediyi iki kez
  // harcıyordu. Her zaman tam seri çekilir, istenen kadarı kesilerek verilir.
  const key = candleCacheKey(market, symbol, interval);
  const cached = (await paylasimliOku<CandleSet>([key])).get(key);
  if (cached) return { ...cached, candles: cached.candles.slice(-limit) };

  const cekilecek = Math.max(limit, TAM_MUM);

  // Kaynak sırası ölçüme dayanır (bkz. /tani): anahtar isteyen sağlayıcı bulut
  // sunucusundan çalışıyor, anahtarsız olanlar IP'yi engelliyor. Dövizde
  // anahtarsız ve çalışan bir kaynak olduğu için önce o denenir.
  const gunlukVeHaftalik = interval === "1d" || interval === "1w";

  if (gunlukVeHaftalik && market === "emtia" && parseFxPair(symbol)) {
    try {
      const candles = await fetchFxCandles(symbol, interval, cekilecek);
      const result: CandleSet = { instrument, candles, source: "canli", fetchedAt: Date.now() };
      await paylasimliYaz(key, result, GUNLUK_TTL_MS);
      return { ...result, candles: candles.slice(-limit) };
    } catch {
      // Kur kaynağı düşerse aşağıdaki sağlayıcılar denenir.
    }
  }

  if (twelveDataEnabled()) {
    try {
      const candles = await fetchTwelveCandles(market, symbol, interval, cekilecek);
      const result: CandleSet = { instrument, candles, source: "canli", fetchedAt: Date.now() };
      // Günlük mum gün içinde değişmez; ücretsiz katmanın kredisini korumak
      // için uzun süre ve tüm örneklerle paylaşılarak saklanır.
      await paylasimliYaz(key, result, gunlukVeHaftalik ? GUNLUK_TTL_MS : GUN_ICI_TTL_MS);
      return { ...result, candles: candles.slice(-limit) };
    } catch (error) {
      // Anahtar yanlışsa ya da kredi bittiyse aşağıdaki kaynaklar denenir.
      if (error instanceof MarketDataError && error.status === 429) throw error;
    }
  }

  const stooqSymbols = toStooqSymbols(market, symbol);
  let stooqHatasi: string | null = null;
  if (stooqSymbols.length > 0 && (interval === "1d" || interval === "1w")) {
    try {
      const candles = await fetchStooqCandles(stooqSymbols, interval, cekilecek);
      const result: CandleSet = { instrument, candles, source: "canli", fetchedAt: Date.now() };
      await paylasimliYaz(key, result, gunlukVeHaftalik ? GUNLUK_TTL_MS : GUN_ICI_TTL_MS);
      return { ...result, candles: candles.slice(-limit) };
    } catch (error) {
      // Stooq'ta yoksa Yahoo denenir; sebebi hata mesajında görünsün.
      stooqHatasi = hataOzeti(error);
    }
  } else if (stooqSymbols.length === 0) {
    stooqHatasi = "sembol eşlenmedi";
  } else {
    stooqHatasi = "gün içi veri yok";
  }

  try {
    const chart = await fetchChart(symbol, interval, cekilecek);
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
      fetchedAt: Date.now(),
    };
    // Hisse/emtia verisi kriptoya göre yavaş değişir; uzun önbellek hem
    // sayfayı hızlandırır hem de sağlayıcı hız sınırından korur.
    await paylasimliYaz(key, result, gunlukVeHaftalik ? GUNLUK_TTL_MS : GUN_ICI_TTL_MS);
    return { ...result, candles: result.candles.slice(-limit) };
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
    // Kullanıcı hangi kaynağın neden düştüğünü görebilsin.
    throw new MarketDataError(
      `${symbol} için veri alınamadı (kaynak 1: ${stooqHatasi ?? "denenmedi"}, kaynak 2: ${hataOzeti(error)}).`,
      error instanceof MarketDataError ? error.status : 503,
    );
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
          ticker: displayTicker(market, symbol),
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

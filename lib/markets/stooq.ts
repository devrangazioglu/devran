/**
 * Hisse, endeks, emtia ve döviz verisi için Stooq.
 *
 * Neden ikinci bir kaynak: Yahoo, veri merkezi IP aralıklarından gelen
 * istekleri sınırlıyor. Uygulama Vercel'de çalıştığı için kripto dışı her
 * piyasa "istek limitine takıldı" hatası veriyordu; aynı sunucudan kripto
 * sağlayıcısı sorunsuz yanıt verdiği hâlde. Stooq anahtar istemez, CSV döner
 * ve bulut IP'lerini engellemez.
 *
 * Sınırı: yalnızca GÜNLÜK ve HAFTALIK veri sunar. Gün içi periyotlar için
 * Yahoo denenmeye devam edilir (bkz. `provider.ts`).
 */

import { MarketDataError, type Candle, type Interval, type MarketId } from "./types";

const BASE = process.env.STOOQ_API_BASE ?? "https://stooq.com";

const HEADERS = {
  accept: "text/csv,*/*",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

/* ────────────────────────── Sembol eşlemesi ────────────────────────── */

/** Uygulama sembolü → Stooq sembolü. Listede olmayanlar için kural uygulanır. */
const OZEL: Record<string, string> = {
  // ABD endeksleri
  "^GSPC": "^spx",
  "^IXIC": "^ndq",
  "^DJI": "^dji",

  // Emtia
  "GC=F": "xauusd",
  "SI=F": "xagusd",
  "PL=F": "xptusd",
  "PA=F": "xpdusd",
  "HG=F": "hg.f",
  "CL=F": "cl.f",
  "BZ=F": "cb.f",
  "NG=F": "ng.f",
  "ZW=F": "zw.f",
  "KC=F": "kc.f",

  // Dolar endeksi
  "DX-Y.NYB": "dx.f",
};

/**
 * Uygulama sembolünü Stooq biçimine çevirir; karşılığı yoksa null döner.
 *
 * BIST kapsaması belirsiz olduğu için "THYAO.IS" → "thyao.tr" biçimi en iyi
 * tahmin olarak denenir; veri gelmezse çağıran Yahoo'ya düşer.
 */
export function toStooqSymbol(market: MarketId, symbol: string): string | null {
  return toStooqSymbols(market, symbol)[0] ?? null;
}

/**
 * Denenecek Stooq sembollerini sırayla verir.
 *
 * Sağlayıcının bazı varlıklar için hangi yazımı kullandığı belgeli değil
 * (altın "xauusd" mu "gc.f" mi, BIST "thyao.tr" mi "thyao" mu). Tek bir
 * tahmine bağlı kalmak o varlığı sessizce boş bırakıyordu; sıradaki yazım
 * yalnızca bir öncekinden veri gelmediğinde denenir.
 */
export function toStooqSymbols(market: MarketId, symbol: string): string[] {
  if (market === "kripto") return [];

  if (market === "bist") {
    if (!symbol.endsWith(".IS")) return [];
    const kok = symbol.slice(0, -3).toLowerCase();
    return [`${kok}.tr`, kok];
  }

  const adaylar: string[] = [];
  const ozel = OZEL[symbol];
  if (ozel) adaylar.push(ozel);

  // Döviz: "USDTRY=X" → "usdtry"
  if (symbol.endsWith("=X")) adaylar.push(symbol.slice(0, -2).toLowerCase());

  // Vadeli: "XX=F" → "xx.f"
  if (symbol.endsWith("=F")) adaylar.push(`${symbol.slice(0, -2).toLowerCase()}.f`);

  // Endeksler
  if (symbol.startsWith("^")) adaylar.push(symbol.toLowerCase());

  // ABD hissesi: "AAPL" → "aapl.us", olmazsa "aapl"
  if (market === "abd" && !symbol.startsWith("^")) {
    adaylar.push(`${symbol.toLowerCase()}.us`, symbol.toLowerCase());
  }

  return [...new Set(adaylar)];
}

/* ────────────────────────── CSV ────────────────────────── */

function parseCsv(text: string): string[][] {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(","));
}

const sayi = (value: string | undefined): number | null => {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export type StooqQuote = {
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

/**
 * Toplu fiyat yanıtını çözümler.
 * Başlık: Symbol,Date,Time,Open,High,Low,Close,Volume
 */
export function parseQuoteCsv(text: string): StooqQuote[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];

  const out: StooqQuote[] = [];
  for (const row of rows.slice(1)) {
    const [symbol, , , open, high, low, close, volume] = row;
    const kapanis = sayi(close);
    // Veri bulunamayan sembollerde Stooq "N/D" döndürür; bunlar atlanır.
    if (!symbol || kapanis === null || kapanis <= 0) continue;
    out.push({
      symbol: symbol.toLowerCase(),
      open: sayi(open) ?? kapanis,
      high: sayi(high) ?? kapanis,
      low: sayi(low) ?? kapanis,
      close: kapanis,
      volume: sayi(volume) ?? 0,
    });
  }
  return out;
}

/**
 * Günlük mum yanıtını çözümler.
 * Başlık: Date,Open,High,Low,Close,Volume
 */
export function parseCandleCsv(text: string, interval: Interval): Candle[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];

  const stepMs = interval === "1w" ? 7 * 86_400_000 : 86_400_000;
  const out: Candle[] = [];

  for (const row of rows.slice(1)) {
    const [date, open, high, low, close, volume] = row;
    const o = sayi(open);
    const h = sayi(high);
    const l = sayi(low);
    const c = sayi(close);
    if (o === null || h === null || l === null || c === null || c <= 0) continue;

    const openTime = Date.parse(`${date}T00:00:00Z`);
    if (!Number.isFinite(openTime)) continue;

    const hacim = sayi(volume) ?? 0;
    out.push({
      openTime,
      open: o,
      high: h,
      low: l,
      close: c,
      volume: hacim,
      closeTime: openTime + stepMs - 1,
      quoteVolume: hacim * c,
      trades: 0,
    });
  }

  return out;
}

/* ────────────────────────── İstekler ────────────────────────── */

async function iste(path: string, timeoutMs = 12_000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(BASE + path, {
      signal: controller.signal,
      headers: HEADERS,
      cache: "no-store",
    });
    if (response.status === 429) {
      throw new MarketDataError("Veri sağlayıcı istek limitine takıldı, birazdan tekrar deneyin.", 429);
    }
    // Gerçek durum kodu korunur: hata mesajında "502" görüp 404'ü aramak
    // teşhisi yanlış yöne çeviriyordu.
    if (!response.ok) {
      throw new MarketDataError(`Veri sağlayıcı yanıtı: ${response.status}`, response.status);
    }
    return await response.text();
  } catch (error) {
    if (error instanceof MarketDataError) throw error;
    throw new MarketDataError(
      `Piyasa verisine ulaşılamadı (${error instanceof Error ? error.message : "bilinmeyen hata"}).`,
      503,
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Tek istekte birçok sembolün son fiyatı. */
export async function fetchStooqQuotes(stooqSymbols: string[]): Promise<StooqQuote[]> {
  if (stooqSymbols.length === 0) return [];

  const CHUNK = 25;
  const out: StooqQuote[] = [];
  for (let i = 0; i < stooqSymbols.length; i += CHUNK) {
    const parca = stooqSymbols.slice(i, i + CHUNK);
    const text = await iste(`/q/l/?s=${encodeURIComponent(parca.join("+"))}&f=sd2t2ohlcv&h&e=csv`);
    out.push(...parseQuoteCsv(text));
  }
  return out;
}

/**
 * Günlük ya da haftalık mumlar. Gün içi periyot desteklenmez.
 * Verilen yazımlardan veri döndüren ilki kullanılır.
 */
export async function fetchStooqCandles(
  stooqSymbols: string | string[],
  interval: Interval,
  limit = 300,
): Promise<Candle[]> {
  if (interval !== "1d" && interval !== "1w") {
    throw new MarketDataError("Bu kaynak gün içi veri sunmuyor.", 400);
  }

  const adaylar = typeof stooqSymbols === "string" ? [stooqSymbols] : stooqSymbols;
  let sonHata: unknown = null;

  for (const aday of adaylar) {
    try {
      const text = await iste(
        `/q/d/l/?s=${encodeURIComponent(aday)}&i=${interval === "1w" ? "w" : "d"}`,
      );
      const candles = parseCandleCsv(text, interval);
      // Analiz en az birkaç yüz mum ister; birkaç satırlık yanıt genelde
      // "sembol bulunamadı" demektir, sıradaki yazım denenir.
      if (candles.length >= 30) return candles.slice(-limit);
      sonHata = new MarketDataError("Bu sembol için yeterli veri yok.", 404);
    } catch (error) {
      sonHata = error;
      // Hız sınırında sıradaki yazımı denemenin anlamı yok.
      if (error instanceof MarketDataError && error.status === 429) throw error;
    }
  }

  throw sonHata instanceof MarketDataError
    ? sonHata
    : new MarketDataError("Bu sembol için veri bulunamadı.", 404);
}

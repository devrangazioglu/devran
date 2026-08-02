/**
 * Hisse, endeks, emtia ve BIST verisi için Twelve Data.
 *
 * Neden bu kaynak: anahtarsız sağlayıcılar (Yahoo, Stooq) veri merkezi IP
 * aralıklarını engelliyor — ölçüldü, sırasıyla 429 ve CSV yerine HTML engel
 * sayfası dönüyorlar. Twelve Data çağıranı IP'sine değil anahtarına göre
 * tanıdığı için bulut sunucusundan çalışıyor.
 *
 * `TWELVEDATA_API_KEY` tanımlı değilse bu modül devre dışıdır ve çağıran
 * eski kaynaklara düşer; anahtar yoksa sessizce boş liste dönmek yerine
 * açık bir hata verilir.
 *
 * Ücretsiz katman dar (günlük kredi ve dakikalık istek sınırı var), bu yüzden:
 *   • tek istekte çok sembol sorulur (`symbol=A,B,C`),
 *   • günlük mumlar uzun süre önbelleklenir (gün içinde zaten değişmez),
 *   • kaç sembol isteneceğine paylaşımlı kredi sayacı karar verir (`kota.ts`).
 */

import { MarketDataError, type Candle, type Interval, type MarketId } from "./types";

const BASE = process.env.TWELVEDATA_API_BASE ?? "https://api.twelvedata.com";

export function twelveDataKey(): string | null {
  const key = process.env.TWELVEDATA_API_KEY?.trim();
  return key ? key : null;
}

export function twelveDataEnabled(): boolean {
  return twelveDataKey() !== null;
}

/* ────────────────────────── Sembol eşlemesi ────────────────────────── */

const OZEL: Record<string, string> = {
  // Endeksler
  "^GSPC": "SPX",
  "^IXIC": "IXIC",
  "^DJI": "DJI",
  "DX-Y.NYB": "DXY",

  // Emtia — sağlayıcı bunları döviz çifti biçiminde sunuyor
  "GC=F": "XAU/USD",
  "SI=F": "XAG/USD",
  "PL=F": "XPT/USD",
  "PA=F": "XPD/USD",
  "CL=F": "WTI/USD",
  "BZ=F": "BRENT/USD",
  "NG=F": "NG/USD",
  "HG=F": "COPPER/USD",
  "ZW=F": "WHEAT/USD",
  "KC=F": "COFFEE/USD",
};

/** Uygulama sembolünü sağlayıcı biçimine çevirir; karşılığı yoksa null. */
export function toTwelveSymbol(market: MarketId, symbol: string): string | null {
  if (market === "kripto") return null;

  const ozel = OZEL[symbol];
  if (ozel) return ozel;

  // Döviz: "USDTRY=X" → "USD/TRY"
  if (symbol.endsWith("=X")) {
    const temiz = symbol.slice(0, -2);
    return temiz.length === 6 ? `${temiz.slice(0, 3)}/${temiz.slice(3)}` : null;
  }

  // BIST: "THYAO.IS" → "THYAO" (borsa ayrı parametreyle verilir)
  if (market === "bist") {
    return symbol.endsWith(".IS") ? symbol.slice(0, -3) : symbol;
  }

  if (market === "abd") return symbol.replace(/^\^/, "");

  return null;
}

/** BIST sembolleri borsa adıyla nitelenmeli, yoksa aynı kod başka borsada eşleşir. */
function borsaParametresi(market: MarketId): string {
  return market === "bist" ? "&exchange=BIST" : "";
}

const INTERVAL_MAP: Partial<Record<Interval, string>> = {
  "1d": "1day",
  "1w": "1week",
  "1h": "1h",
  "4h": "4h",
};

/* ────────────────────────── Yanıt çözümleme ────────────────────────── */

type Deger = {
  datetime?: string;
  open?: string;
  high?: string;
  low?: string;
  close?: string;
  volume?: string;
};

type SeriesGovde = {
  status?: string;
  message?: string;
  code?: number;
  values?: Deger[];
};

const sayi = (value: string | undefined): number | null => {
  if (value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * Tek sembolün zaman serisini mum dizisine çevirir.
 * Sağlayıcı en yeniden eskiye sıralı döndürür; analiz motoru eskiden yeniye ister.
 */
export function parseSeries(govde: SeriesGovde, interval: Interval): Candle[] {
  if (govde.status === "error") {
    throw new MarketDataError(
      govde.message ?? "Veri sağlayıcı hatası.",
      govde.code === 429 ? 429 : 502,
    );
  }

  const stepMs = interval === "1w" ? 7 * 86_400_000 : 86_400_000;
  const out: Candle[] = [];

  for (const deger of govde.values ?? []) {
    const open = sayi(deger.open);
    const high = sayi(deger.high);
    const low = sayi(deger.low);
    const close = sayi(deger.close);
    if (open === null || high === null || low === null || close === null || close <= 0) continue;

    // "2026-07-29" ya da "2026-07-29 15:30:00" biçiminde gelebilir.
    const metin = (deger.datetime ?? "").trim();
    const openTime = Date.parse(metin.includes(" ") ? `${metin.replace(" ", "T")}Z` : `${metin}T00:00:00Z`);
    if (!Number.isFinite(openTime)) continue;

    const volume = sayi(deger.volume) ?? 0;
    out.push({
      openTime,
      open,
      high,
      low,
      close,
      volume,
      closeTime: openTime + stepMs - 1,
      quoteVolume: volume * close,
      trades: 0,
    });
  }

  // Eskiden yeniye sırala.
  out.sort((a, b) => a.openTime - b.openTime);
  return out;
}

/* ────────────────────────── İstekler ────────────────────────── */

async function iste<T>(path: string, timeoutMs = 15_000): Promise<T> {
  const key = twelveDataKey();
  if (!key) throw new MarketDataError("Veri sağlayıcı anahtarı tanımlı değil.", 503);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${BASE}${path}&apikey=${encodeURIComponent(key)}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (response.status === 429) {
      throw new MarketDataError("Veri sağlayıcı istek limitine takıldı, birazdan tekrar deneyin.", 429);
    }
    if (!response.ok) throw new MarketDataError(`Veri sağlayıcı yanıtı: ${response.status}`, 502);
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof MarketDataError) throw error;
    throw new MarketDataError(
      `Piyasa verisine ulaşılamadı (${error instanceof Error ? error.message : "bilinmeyen"}).`,
      503,
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Tek sembolün mumları. */
export async function fetchTwelveCandles(
  market: MarketId,
  symbol: string,
  interval: Interval,
  limit = 300,
): Promise<Candle[]> {
  const hedef = toTwelveSymbol(market, symbol);
  const periyot = INTERVAL_MAP[interval];
  if (!hedef || !periyot) throw new MarketDataError("Bu sembol/periyot desteklenmiyor.", 400);

  const govde = await iste<SeriesGovde>(
    `/time_series?symbol=${encodeURIComponent(hedef)}&interval=${periyot}` +
      `&outputsize=${Math.min(limit, 5000)}${borsaParametresi(market)}`,
  );

  const candles = parseSeries(govde, interval);
  if (candles.length === 0) throw new MarketDataError("Bu sembol için veri bulunamadı.", 404);
  return candles.slice(-limit);
}

type TopluGovde = Record<string, SeriesGovde> | SeriesGovde;

/**
 * Toplu yanıttaki ortak hatayı bulur.
 *
 * Sağlayıcı kota hatasını her sembolün altında ayrı ayrı bildiriyor. Bunlar
 * sembol bazında yutulunca "veri yok" sanılıyor, kota bittiği anlaşılmıyor ve
 * uygulama istemeye devam ediyordu. Hiçbir sembol çözülemediyse ilk hata
 * yüzeye çıkarılır.
 */
export function batchHatasi(govde: TopluGovde): MarketDataError | null {
  const kayitlar: SeriesGovde[] =
    "values" in govde || "status" in govde
      ? [govde as SeriesGovde]
      : Object.values(govde as Record<string, SeriesGovde>);

  for (const kayit of kayitlar) {
    if (kayit?.status === "error") {
      return new MarketDataError(
        kayit.message ?? "Veri sağlayıcı hatası.",
        kayit.code === 429 ? 429 : 502,
      );
    }
  }
  return null;
}

/** Çoklu sembol yanıtını sembol→mum eşlemesine çevirir. */
export function parseBatch(
  govde: TopluGovde,
  interval: Interval,
  hedefler: string[],
): Map<string, Candle[]> {
  const out = new Map<string, Candle[]>();

  // Tek sembol istendiğinde sağlayıcı sarmalamadan döndürür.
  if (hedefler.length === 1 && ("values" in govde || "status" in govde)) {
    try {
      const candles = parseSeries(govde as SeriesGovde, interval);
      if (candles.length > 0) out.set(hedefler[0], candles);
    } catch {
      // tek sembol düştüyse boş bırak
    }
    return out;
  }

  for (const [anahtar, deger] of Object.entries(govde as Record<string, SeriesGovde>)) {
    try {
      const candles = parseSeries(deger, interval);
      if (candles.length > 0) out.set(anahtar, candles);
    } catch {
      // bir sembol düşerse diğerleri devam etsin
    }
  }
  return out;
}

/**
 * Birden çok sembolün mumları — tek HTTP isteğinde.
 * Ücretsiz katmanda dakikalık istek sınırı olduğu için toplu sorgu şart.
 */
export async function fetchTwelveBatch(
  market: MarketId,
  symbols: string[],
  interval: Interval,
  limit = 300,
): Promise<Map<string, Candle[]>> {
  const periyot = INTERVAL_MAP[interval];
  if (!periyot) throw new MarketDataError("Bu periyot desteklenmiyor.", 400);

  const eslesme = new Map<string, string>(); // sağlayıcı sembolü → uygulama sembolü
  for (const symbol of symbols) {
    const hedef = toTwelveSymbol(market, symbol);
    if (hedef) eslesme.set(hedef, symbol);
  }
  if (eslesme.size === 0) return new Map();

  // Kaç sembol isteneceğine çağıran karar verir (bkz. `kota.ts`): kredi
  // bütçesi sunucular arasında paylaşıldığı için burada sayılmaz.
  const hedefler = [...eslesme.keys()];

  const PARCA = 8; // tek isteğe sığdırılan sembol sayısı
  const sonuc = new Map<string, Candle[]>();

  for (let i = 0; i < hedefler.length; i += PARCA) {
    const parca = hedefler.slice(i, i + PARCA);
    const govde = await iste<TopluGovde>(
      `/time_series?symbol=${encodeURIComponent(parca.join(","))}&interval=${periyot}` +
        `&outputsize=${Math.min(limit, 5000)}${borsaParametresi(market)}`,
    );

    const cozulen = parseBatch(govde, interval, parca);
    // Tek bir sembol bile çözülemediyse sebebi yut­ma: kota hatası buradan
    // anlaşılıyor ve çağıran buna göre geri çekiliyor.
    if (cozulen.size === 0) {
      const hata = batchHatasi(govde);
      if (hata) throw hata;
    }

    for (const [hedef, candles] of cozulen) {
      const uygulamaSembolu = eslesme.get(hedef);
      if (uygulamaSembolu) sonuc.set(uygulamaSembolu, candles.slice(-limit));
    }
  }

  return sonuc;
}

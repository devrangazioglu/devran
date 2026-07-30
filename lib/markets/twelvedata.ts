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
 *   • günlük mumlar uzun süre önbelleklenir (gün içinde zaten değişmez).
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

/* ────────────────────────── Kredi bütçesi ──────────────────────────
 *
 * Ücretsiz katman dakikada sabit sayıda kredi verir ve her sembol bir kredi
 * harcar. ABD listesinde 46, BIST'te 43 sembol var; hepsini bir anda istemek
 * sınırı ilk saniyede tüketip tüm piyasayı hataya çeviriyordu.
 *
 * Bunun yerine her istekte bütçe kadar YENİ sembol çekilir, gerisi atlanır.
 * Mumlar uzun süre önbelleklendiği için liste birkaç sayfa açılışında dolar
 * ve sonrasında önbellekten gelir. Yarım liste, boş listeden iyidir.
 *
 * Bütçenin tamamı toplu listeye gitmez: kullanıcı listeden bir varlığa
 * tıkladığında o sembolün mumları tek tek isteniyor. Liste bütçeyi tümüyle
 * yerse detay sayfası hep "kota doldu" derdi. Bu yüzden birkaç kredi tekil
 * isteklere ayrılır.
 */
const KREDI_PENCERESI_MS = 60_000;
const KREDI_LIMITI = Math.max(1, Number(process.env.TWELVEDATA_CREDITS_PER_MIN ?? 8));
const TOPLU_PAY = Math.max(1, KREDI_LIMITI - 2);

let pencereBasi = 0;
let kullanilan = 0;

/** İstenen kadar kredi ayırmayı dener; ayrılabilen sayıyı döndürür. */
export function krediAyir(adet: number): number {
  const simdi = Date.now();
  if (simdi - pencereBasi > KREDI_PENCERESI_MS) {
    pencereBasi = simdi;
    kullanilan = 0;
  }
  const verilen = Math.min(adet, Math.max(0, KREDI_LIMITI - kullanilan));
  kullanilan += verilen;
  return verilen;
}

/** Testler için bütçeyi sıfırlar. */
export function krediSifirla(): void {
  pencereBasi = 0;
  kullanilan = 0;
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

  // Bütçe dolduysa isteği hiç atma: sağlayıcıdan 429 almak yerine sırayı
  // bir sonraki dakikaya bırak.
  if (krediAyir(1) < 1) {
    throw new MarketDataError("Dakikalık veri kotası doldu, birazdan tekrar deneyin.", 429);
  }

  const govde = await iste<SeriesGovde>(
    `/time_series?symbol=${encodeURIComponent(hedef)}&interval=${periyot}` +
      `&outputsize=${Math.min(limit, 5000)}${borsaParametresi(market)}`,
  );

  const candles = parseSeries(govde, interval);
  if (candles.length === 0) throw new MarketDataError("Bu sembol için veri bulunamadı.", 404);
  return candles.slice(-limit);
}

type TopluGovde = Record<string, SeriesGovde> | SeriesGovde;

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

  // Bütçe kadar sembol istenir; gerisi bu turda atlanır.
  const tumHedefler = [...eslesme.keys()];
  const butce = krediAyir(Math.min(tumHedefler.length, TOPLU_PAY));
  if (butce < 1) {
    throw new MarketDataError("Dakikalık veri kotası doldu, birazdan tekrar deneyin.", 429);
  }
  const hedefler = tumHedefler.slice(0, butce);

  const PARCA = 8; // tek isteğe sığdırılan sembol sayısı
  const sonuc = new Map<string, Candle[]>();

  for (let i = 0; i < hedefler.length; i += PARCA) {
    const parca = hedefler.slice(i, i + PARCA);
    const govde = await iste<TopluGovde>(
      `/time_series?symbol=${encodeURIComponent(parca.join(","))}&interval=${periyot}` +
        `&outputsize=${Math.min(limit, 5000)}${borsaParametresi(market)}`,
    );

    for (const [hedef, candles] of parseBatch(govde, interval, parca)) {
      const uygulamaSembolu = eslesme.get(hedef);
      if (uygulamaSembolu) sonuc.set(uygulamaSembolu, candles.slice(-limit));
    }
  }

  return sonuc;
}

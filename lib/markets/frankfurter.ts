/**
 * Döviz kurları için Frankfurter (Avrupa Merkez Bankası verisi).
 *
 * Neden bu kaynak: Yahoo ve Stooq, veri merkezi IP aralıklarını engelliyor
 * (ölçüldü: 429 ve CSV yerine HTML engel sayfası). Frankfurter anahtar
 * istemiyor ve bulut sunucularına cevap veriyor, bu yüzden dövizler için
 * anahtar gerekmeden çalışan tek yol.
 *
 * Sınırı: ECB günlük referans kurları. Yani yalnızca **kapanış** değeri var,
 * gün içi en yüksek/en düşük yok ve hafta sonu/tatil verisi yok. Mumlar
 * kapanıştan türetilir (bkz. `toCandles`), dolayısıyla gün içi aralığa dayanan
 * göstergeler (ATR, Stokastik, Williams %R) burada dar kalır; kapanışa dayanan
 * göstergeler (RSI, MACD, EMA, Bollinger) tam çalışır.
 */

import { MarketDataError, type Candle, type Interval } from "./types";

const BASE = process.env.FRANKFURTER_API_BASE ?? "https://api.frankfurter.app";

/** ECB'nin yayımladığı para birimleri; listede olmayan çift bu kaynaktan gelmez. */
const DESTEKLENEN = new Set([
  "USD", "EUR", "TRY", "GBP", "JPY", "CHF", "AUD", "CAD", "SEK", "NOK",
  "DKK", "PLN", "CZK", "HUF", "RON", "BGN", "ISK", "CNY", "HKD", "SGD",
  "KRW", "INR", "BRL", "MXN", "ZAR", "NZD", "IDR", "ILS", "MYR", "PHP", "THB",
]);

/** "USDTRY=X" → { from: "USD", to: "TRY" }; çözümlenemezse null. */
export function parseFxPair(symbol: string): { from: string; to: string } | null {
  const temiz = symbol.endsWith("=X") ? symbol.slice(0, -2) : symbol;
  if (temiz.length !== 6) return null;

  const from = temiz.slice(0, 3).toUpperCase();
  const to = temiz.slice(3).toUpperCase();
  if (!DESTEKLENEN.has(from) || !DESTEKLENEN.has(to) || from === to) return null;
  return { from, to };
}

type SeriesResponse = { rates?: Record<string, Record<string, number>> };

async function iste<T>(path: string, timeoutMs = 12_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(BASE + path, {
      signal: controller.signal,
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new MarketDataError(`Veri sağlayıcı yanıtı: ${response.status}`, response.status);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof MarketDataError) throw error;
    throw new MarketDataError(
      `Kur verisine ulaşılamadı (${error instanceof Error ? error.message : "bilinmeyen"}).`,
      503,
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tarih→kur eşlemesini mum dizisine çevirir.
 *
 * Tek değer olduğu için mum şöyle kurulur: açılış = bir önceki kapanış,
 * en yüksek/en düşük = ikisinin uç noktaları. Böylece gerçek aralık
 * (true range) günlük değişim kadar olur; uydurma bir dalgalanma eklenmez.
 */
export function toCandles(
  rates: Record<string, number>,
  interval: Interval,
  limit: number,
): Candle[] {
  const gunler = Object.keys(rates).sort();
  const stepMs = interval === "1w" ? 7 * 86_400_000 : 86_400_000;
  const out: Candle[] = [];

  for (let i = 0; i < gunler.length; i++) {
    const close = rates[gunler[i]];
    if (!Number.isFinite(close) || close <= 0) continue;

    const open = i === 0 ? close : (rates[gunler[i - 1]] ?? close);
    const openTime = Date.parse(`${gunler[i]}T00:00:00Z`);
    if (!Number.isFinite(openTime)) continue;

    out.push({
      openTime,
      open,
      high: Math.max(open, close),
      low: Math.min(open, close),
      close,
      // Bu kaynakta hacim yok; sıfır bırakmak uydurmaktan iyidir.
      volume: 0,
      closeTime: openTime + stepMs - 1,
      quoteVolume: 0,
      trades: 0,
    });
  }

  return out.slice(-limit);
}

/** Haftalık mumlar için günlük seriyi haftaya indirger (her haftanın son kaydı). */
function haftalik(candles: Candle[]): Candle[] {
  const gruplar = new Map<string, Candle[]>();
  for (const candle of candles) {
    const d = new Date(candle.openTime);
    // ISO hafta yerine yıl+hafta numarası yaklaşımı yeterli: seri sıralı geliyor.
    const anahtar = `${d.getUTCFullYear()}-${Math.floor(
      (d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / (7 * 86_400_000),
    )}`;
    const liste = gruplar.get(anahtar);
    if (liste) liste.push(candle);
    else gruplar.set(anahtar, [candle]);
  }

  return [...gruplar.values()].map((grup) => ({
    openTime: grup[0].openTime,
    open: grup[0].open,
    high: Math.max(...grup.map((c) => c.high)),
    low: Math.min(...grup.map((c) => c.low)),
    close: grup[grup.length - 1].close,
    volume: 0,
    closeTime: grup[grup.length - 1].closeTime,
    quoteVolume: 0,
    trades: 0,
  }));
}

/** Verilen döviz çifti için günlük ya da haftalık mumlar. */
export async function fetchFxCandles(
  symbol: string,
  interval: Interval,
  limit = 300,
): Promise<Candle[]> {
  const cift = parseFxPair(symbol);
  if (!cift) throw new MarketDataError("Bu çift kur kaynağında yok.", 404);
  if (interval !== "1d" && interval !== "1w") {
    throw new MarketDataError("Bu kaynak gün içi veri sunmuyor.", 400);
  }

  // Haftalık için daha uzun geçmiş gerekir; ECB yalnızca iş günü yayımlar.
  const gunSayisi = interval === "1w" ? limit * 9 : Math.ceil(limit * 1.5);
  const baslangic = new Date(Date.now() - gunSayisi * 86_400_000).toISOString().slice(0, 10);

  const body = await iste<SeriesResponse>(
    `/${baslangic}..?from=${cift.from}&to=${cift.to}`,
  );

  const duz: Record<string, number> = {};
  for (const [gun, kurlar] of Object.entries(body.rates ?? {})) {
    const deger = kurlar[cift.to];
    if (typeof deger === "number") duz[gun] = deger;
  }

  const gunluk = toCandles(duz, "1d", interval === "1w" ? 100_000 : limit);
  if (gunluk.length === 0) throw new MarketDataError("Bu çift için veri bulunamadı.", 404);

  return interval === "1w" ? haftalik(gunluk).slice(-limit) : gunluk;
}

/* ────────────────────────── Fiyat listesi ────────────────────────── */

export type FxQuote = { symbol: string; price: number; previousClose: number };

/**
 * Birden çok çiftin son kuru ve bir önceki kapanışı.
 *
 * Çiftler taban para birimine göre gruplanır: sağlayıcı bir istekte tek taban
 * için tüm karşı kurları verdiğinden, dokuz çift dört istekle çözülür.
 * Son iki iş günü istenir ki günlük değişim yüzdesi hesaplanabilsin.
 */
export async function fetchFxQuotes(symbols: string[]): Promise<FxQuote[]> {
  const gruplar = new Map<string, { symbol: string; to: string }[]>();
  for (const symbol of symbols) {
    const cift = parseFxPair(symbol);
    if (!cift) continue;
    const liste = gruplar.get(cift.from);
    if (liste) liste.push({ symbol, to: cift.to });
    else gruplar.set(cift.from, [{ symbol, to: cift.to }]);
  }
  if (gruplar.size === 0) return [];

  // Tatiller yüzünden son iki yayın gününü yakalamak için bir hafta geriye bakılır.
  const baslangic = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
  const out: FxQuote[] = [];

  for (const [from, hedefler] of gruplar) {
    try {
      const body = await iste<SeriesResponse>(
        `/${baslangic}..?from=${from}&to=${hedefler.map((h) => h.to).join(",")}`,
      );
      const gunler = Object.keys(body.rates ?? {}).sort();
      if (gunler.length === 0) continue;

      const son = body.rates?.[gunler[gunler.length - 1]] ?? {};
      const onceki = body.rates?.[gunler[gunler.length - 2]] ?? son;

      for (const hedef of hedefler) {
        const price = son[hedef.to];
        if (typeof price !== "number" || price <= 0) continue;
        out.push({
          symbol: hedef.symbol,
          price,
          previousClose: onceki[hedef.to] ?? price,
        });
      }
    } catch {
      // Bir taban düşerse diğerleri gelmeye devam etsin.
    }
  }

  return out;
}

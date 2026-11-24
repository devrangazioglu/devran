/**
 * Sentetik (demo) piyasa verisi.
 *
 * Ağ erişimi olmayan ortamlarda (kapalı geliştirme ortamı, CI) arayüzün ve
 * analiz motorunun çalışabilmesi için deterministik veri üretir. Bu veri
 * gerçek piyasayı YANSITMAZ; arayüzde "demo veri" rozetiyle gösterilir.
 * `DEMO_DATA=1` ile açılır.
 */

import { intervalMinutes, type Candle, type Interval } from "./types";

/** Tohumlanabilir sözde rastgele üreteç — mulberry32. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Bilinen enstrümanlar için gerçeğe yakın başlangıç fiyatları (yalnızca demo). */
const BASE_PRICES: Record<string, number> = {
  // ABD
  "^GSPC": 5600, "^IXIC": 18200, "^DJI": 41000,
  AAPL: 226, MSFT: 420, NVDA: 118, GOOGL: 165, AMZN: 185, META: 512, TSLA: 245,
  AVGO: 165, JPM: 212, V: 275, MA: 470, UNH: 580, XOM: 118, WMT: 74, JNJ: 158,
  PG: 172, HD: 365, COST: 880, ORCL: 142, KO: 68, PEP: 172, BAC: 40, NFLX: 685,
  AMD: 145, CRM: 255, ADBE: 555, INTC: 22, DIS: 92, PFE: 29, CSCO: 49, MCD: 292,
  NKE: 82, BA: 175, CAT: 355, IBM: 210, QCOM: 168, T: 20, UBER: 72, SBUX: 95,
  GM: 46, F: 11, PLTR: 32, COIN: 195,
  // BIST
  "XU100.IS": 9800, "XU030.IS": 10700,
  "THYAO.IS": 305, "ASELS.IS": 62, "BIMAS.IS": 545, "EREGL.IS": 45, "KCHOL.IS": 215,
  "SAHOL.IS": 92, "SISE.IS": 47, "TUPRS.IS": 165, "FROTO.IS": 940, "TOASO.IS": 235,
  "GARAN.IS": 118, "AKBNK.IS": 62, "ISCTR.IS": 13.5, "YKBNK.IS": 31, "VAKBN.IS": 25,
  "HALKB.IS": 18, "PETKM.IS": 21, "TCELL.IS": 92, "TTKOM.IS": 46, "ARCLK.IS": 145,
  "PGSUS.IS": 232, "TAVHL.IS": 285, "ENKAI.IS": 55, "KOZAL.IS": 32, "SASA.IS": 4.2,
  "HEKTS.IS": 12, "ALARK.IS": 92, "TKFEN.IS": 68, "VESTL.IS": 78, "MGROS.IS": 520,
  "ULKER.IS": 105, "DOAS.IS": 215, "EKGYO.IS": 12, "ASTOR.IS": 105, "SOKM.IS": 62,
  "TSKB.IS": 12, "ZOREN.IS": 3.4, "AEFES.IS": 195, "CCOLA.IS": 62, "KRDMD.IS": 24,
  "OYAKC.IS": 32,
  // Emtia ve döviz
  "GC=F": 2480, "SI=F": 29.4, "PL=F": 965, "PA=F": 945, "HG=F": 4.15,
  "CL=F": 76.5, "BZ=F": 80.2, "NG=F": 2.15, "ZW=F": 545, "KC=F": 242,
  "USDTRY=X": 41.2, "EURTRY=X": 47.8, "GBPTRY=X": 55.4, "EURUSD=X": 1.085,
  "GBPUSD=X": 1.285, "USDJPY=X": 152.4, "USDCHF=X": 0.88, "AUDUSD=X": 0.665,
  "USDCAD=X": 1.375, "DX-Y.NYB": 104.2,
  // Kripto
  BTCUSDT: 83411, ETHUSDT: 1799.47, SOLUSDT: 116.45, BNBUSDT: 592.3, XRPUSDT: 2.13,
  DOGEUSDT: 0.1642, ADAUSDT: 0.6421, AVAXUSDT: 21.87, LINKUSDT: 14.31, DOTUSDT: 3.97,
  LTCUSDT: 82.77, TRXUSDT: 0.2431, MATICUSDT: 0.2187, NEARUSDT: 2.41, ATOMUSDT: 4.12,
  UNIUSDT: 5.83, APTUSDT: 5.11, ARBUSDT: 0.3312, OPUSDT: 0.7241, INJUSDT: 8.94,
};

export function demoBasePrice(symbol: string): number {
  const known = BASE_PRICES[symbol];
  if (known !== undefined) return known;
  // Bilinmeyen sembollere sembolden türetilmiş, sabit bir fiyat.
  return 5 + (hash(symbol) % 30000) / 100;
}

/** Verilen sembol ve periyot için deterministik mum dizisi üretir. */
export function demoCandles(symbol: string, interval: Interval, limit: number): Candle[] {
  const step = intervalMinutes(interval) * 60_000;
  const now = Math.floor(Date.now() / step) * step;
  const random = seeded(hash(symbol + interval));

  const start = demoBasePrice(symbol);
  const drift = (random() - 0.5) * 0.0006;
  const volatility = 0.004 + random() * 0.01;

  const candles: Candle[] = [];
  let price = start * (0.82 + random() * 0.3);

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

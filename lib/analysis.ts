/**
 * Sinyal motoru.
 *
 * Binance mum verisinden 16 teknik göstergeyi hesaplar, her birini ağırlıklı
 * bir "oy"a çevirir ve toplam skordan AL / SAT / BEKLE sinyali üretir.
 * Ayrıca destek-direnç seviyeleri, mum formasyonları ve ATR tabanlı bir
 * işlem planı (giriş, zarar durdur, hedefler) çıkarır.
 *
 * Not: Üretilen çıktı yatırım tavsiyesi değildir; kural tabanlı bir
 * teknik analiz özetidir.
 */

import type { Candle, DataSource, Interval } from "./binance";
import { INTERVALS, splitSymbol } from "./binance";
import { formatNumber, formatPercent, formatPrice } from "./format";
import {
  adx,
  atr,
  bollinger,
  cci,
  ema,
  last,
  macd,
  mfi,
  obv,
  prev,
  roc,
  rsi,
  sma,
  stochastic,
  supertrend,
  vwap,
  williamsR,
  type Series,
} from "./indicators";

export type Verdict = "AL" | "SAT" | "NÖTR";
export type SignalLabel = "GÜÇLÜ AL" | "AL" | "BEKLE" | "SAT" | "GÜÇLÜ SAT";
export type Category = "Trend" | "Momentum" | "Volatilite" | "Hacim";

export type IndicatorCheck = {
  id: string;
  name: string;
  category: Category;
  /** Göstergenin okunabilir değeri. */
  value: string;
  /** Yön: -1 (güçlü satış) ile +1 (güçlü alış) arası. */
  direction: number;
  verdict: Verdict;
  weight: number;
  /** Bu göstergenin neden bu yönde oy verdiğini anlatan kısa cümle. */
  note: string;
};

export type Pattern = {
  id: string;
  name: string;
  bias: Verdict;
  note: string;
};

export type Level = {
  price: number;
  /** Seviyeye kaç kez dokunulduğu — güç göstergesi (1-5). */
  strength: number;
  /** Güncel fiyata uzaklık, yüzde. */
  distancePercent: number;
};

export type TradePlan = {
  side: "LONG" | "SHORT";
  entry: number;
  stopLoss: number;
  targets: number[];
  /** Zarar durdur mesafesi, yüzde. */
  riskPercent: number;
  /** İlk hedefe göre risk/ödül oranı. */
  riskReward: number;
  atr: number;
  atrPercent: number;
  /** Sinyal zayıfsa plan yalnızca senaryo olarak sunulur. */
  advisory: boolean;
};

export type IndicatorSnapshot = {
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  ema9: number | null;
  ema21: number | null;
  ema50: number | null;
  ema200: number | null;
  sma20: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  bbPercentB: number | null;
  bbBandwidth: number | null;
  stochK: number | null;
  stochD: number | null;
  atr: number | null;
  adx: number | null;
  plusDI: number | null;
  minusDI: number | null;
  cci: number | null;
  williamsR: number | null;
  mfi: number | null;
  obv: number | null;
  vwap: number | null;
  supertrend: number | null;
  supertrendDirection: 1 | -1 | null;
};

/** Grafikte çizilecek gösterge serileri (mumlarla hizalı). */
export type ChartSeries = {
  ema21: Series;
  ema50: Series;
  ema200: Series;
  bbUpper: Series;
  bbLower: Series;
  rsi: Series;
  macd: Series;
  macdSignal: Series;
  macdHistogram: Series;
};

export type Analysis = {
  symbol: string;
  base: string;
  quote: string;
  interval: Interval;
  intervalLabel: string;
  source: DataSource;
  updatedAt: number;
  price: number;
  /** Seçilen zaman diliminde son mumun değişimi. */
  changePercent: number;
  score: number;
  signal: SignalLabel;
  confidence: number;
  checks: IndicatorCheck[];
  tally: { al: number; sat: number; notr: number };
  indicators: IndicatorSnapshot;
  patterns: Pattern[];
  levels: { supports: Level[]; resistances: Level[] };
  trade: TradePlan;
  volatility: { atrPercent: number; regime: "düşük" | "normal" | "yüksek"; squeeze: boolean };
  trendStrength: { adx: number | null; label: string };
};

/* ────────────────────────── Yardımcılar ────────────────────────── */

function verdictOf(direction: number): Verdict {
  if (direction >= 0.15) return "AL";
  if (direction <= -0.15) return "SAT";
  return "NÖTR";
}

/** Değeri -1..1 aralığına sıkıştırır. */
function clamp(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

export function signalFromScore(score: number): SignalLabel {
  if (score >= 45) return "GÜÇLÜ AL";
  if (score >= 18) return "AL";
  if (score <= -45) return "GÜÇLÜ SAT";
  if (score <= -18) return "SAT";
  return "BEKLE";
}

export function signalTone(signal: SignalLabel): "up" | "down" | "flat" {
  if (signal === "GÜÇLÜ AL" || signal === "AL") return "up";
  if (signal === "GÜÇLÜ SAT" || signal === "SAT") return "down";
  return "flat";
}

/* ────────────────────────── Ana analiz ────────────────────────── */

export function analyze(
  symbol: string,
  interval: Interval,
  candles: Candle[],
  source: DataSource,
): Analysis {
  if (candles.length < 60) {
    throw new Error("Analiz için yeterli mum verisi yok (en az 60 mum gerekir).");
  }

  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const volumes = candles.map((c) => c.volume);
  const price = closes[closes.length - 1];
  const previousClose = closes[closes.length - 2];

  // ── Göstergeler ─────────────────────────────────────────────
  const ema9 = ema(closes, 9);
  const ema21 = ema(closes, 21);
  const ema50 = ema(closes, 50);
  const ema200 = ema(closes, 200);
  const sma20 = sma(closes, 20);
  const rsiSeries = rsi(closes, 14);
  const macdResult = macd(closes);
  const bb = bollinger(closes, 20, 2);
  const stoch = stochastic(highs, lows, closes);
  const atrSeries = atr(highs, lows, closes, 14);
  const adxResult = adx(highs, lows, closes, 14);
  const cciSeries = cci(highs, lows, closes, 20);
  const willr = williamsR(highs, lows, closes, 14);
  const mfiSeries = mfi(highs, lows, closes, volumes, 14);
  const obvSeries = obv(closes, volumes);
  const vwapSeries = vwap(highs, lows, closes, volumes, 20);
  const st = supertrend(highs, lows, closes, 10, 3);
  const rocSeries = roc(closes, 10);

  const snapshot: IndicatorSnapshot = {
    rsi: last(rsiSeries),
    macd: last(macdResult.macd),
    macdSignal: last(macdResult.signal),
    macdHistogram: last(macdResult.histogram),
    ema9: last(ema9),
    ema21: last(ema21),
    ema50: last(ema50),
    ema200: last(ema200),
    sma20: last(sma20),
    bbUpper: last(bb.upper),
    bbMiddle: last(bb.middle),
    bbLower: last(bb.lower),
    bbPercentB: last(bb.percentB),
    bbBandwidth: last(bb.bandwidth),
    stochK: last(stoch.k),
    stochD: last(stoch.d),
    atr: last(atrSeries),
    adx: last(adxResult.adx),
    plusDI: last(adxResult.plusDI),
    minusDI: last(adxResult.minusDI),
    cci: last(cciSeries),
    williamsR: last(willr),
    mfi: last(mfiSeries),
    obv: last(obvSeries),
    vwap: last(vwapSeries),
    supertrend: last(st.value),
    supertrendDirection: lastDirection(st.direction),
  };

  const checks: IndicatorCheck[] = [];
  const push = (check: IndicatorCheck) => checks.push(check);

  // ── Trend göstergeleri ───────────────────────────────────────
  if (snapshot.ema9 !== null && snapshot.ema21 !== null) {
    const spread = ((snapshot.ema9 - snapshot.ema21) / snapshot.ema21) * 100;
    const direction = clamp(spread / 1.2);
    push({
      id: "ema-cross",
      name: "EMA 9 / EMA 21",
      category: "Trend",
      value: `${formatPrice(snapshot.ema9)} / ${formatPrice(snapshot.ema21)}`,
      direction,
      verdict: verdictOf(direction),
      weight: 1.2,
      note:
        spread > 0
          ? `Kısa vadeli ortalama, orta vadelinin %${formatNumber(Math.abs(spread))} üzerinde — kısa vadeli yön yukarı.`
          : `Kısa vadeli ortalama, orta vadelinin %${formatNumber(Math.abs(spread))} altında — kısa vadeli yön aşağı.`,
    });
  }

  if (snapshot.ema50 !== null && snapshot.ema200 !== null) {
    const golden = snapshot.ema50 > snapshot.ema200;
    const spread = ((snapshot.ema50 - snapshot.ema200) / snapshot.ema200) * 100;
    const direction = clamp(spread / 5);
    push({
      id: "ema-50-200",
      name: "EMA 50 / EMA 200",
      category: "Trend",
      value: `${formatPrice(snapshot.ema50)} / ${formatPrice(snapshot.ema200)}`,
      direction,
      verdict: verdictOf(direction),
      weight: 1.5,
      note: golden
        ? "EMA 50, EMA 200'ün üzerinde: ana trend yukarı yönlü (golden cross bölgesi)."
        : "EMA 50, EMA 200'ün altında: ana trend aşağı yönlü (death cross bölgesi).",
    });
  }

  if (snapshot.ema200 !== null) {
    const distance = ((price - snapshot.ema200) / snapshot.ema200) * 100;
    const direction = clamp(distance / 8);
    push({
      id: "price-ema200",
      name: "Fiyat / EMA 200",
      category: "Trend",
      value: formatPercent(distance),
      direction,
      verdict: verdictOf(direction),
      weight: 1.1,
      note:
        distance > 0
          ? "Fiyat 200 periyotluk ortalamanın üzerinde; uzun vadeli görünüm boğa tarafında."
          : "Fiyat 200 periyotluk ortalamanın altında; uzun vadeli görünüm ayı tarafında.",
    });
  }

  if (snapshot.supertrendDirection !== null && snapshot.supertrend !== null) {
    const up = snapshot.supertrendDirection === 1;
    push({
      id: "supertrend",
      name: "Supertrend (10, 3)",
      category: "Trend",
      value: formatPrice(snapshot.supertrend),
      direction: up ? 0.8 : -0.8,
      verdict: up ? "AL" : "SAT",
      weight: 1.4,
      note: up
        ? `Supertrend alıcı tarafta; ${formatPrice(snapshot.supertrend)} takip eden destek gibi çalışıyor.`
        : `Supertrend satıcı tarafta; ${formatPrice(snapshot.supertrend)} takip eden direnç gibi çalışıyor.`,
    });
  }

  if (snapshot.adx !== null && snapshot.plusDI !== null && snapshot.minusDI !== null) {
    const diSpread = snapshot.plusDI - snapshot.minusDI;
    // ADX trendin gücünü verir; yön farkı işareti belirler.
    const strength = Math.min(snapshot.adx / 40, 1);
    const direction = clamp((diSpread / 25) * strength * 1.6);
    push({
      id: "adx",
      name: "ADX / DI",
      category: "Trend",
      value: `${formatNumber(snapshot.adx, 1)} (+DI ${formatNumber(snapshot.plusDI, 1)} / -DI ${formatNumber(snapshot.minusDI, 1)})`,
      direction,
      verdict: verdictOf(direction),
      weight: 1.3,
      note:
        snapshot.adx < 20
          ? "ADX 20'nin altında: trend zayıf, fiyat yatay bantta sıkışmış olabilir."
          : diSpread > 0
            ? `ADX ${formatNumber(snapshot.adx, 0)} ile trend güçlü ve +DI önde: yükseliş trendi hakim.`
            : `ADX ${formatNumber(snapshot.adx, 0)} ile trend güçlü ve -DI önde: düşüş trendi hakim.`,
    });
  }

  if (snapshot.vwap !== null) {
    const distance = ((price - snapshot.vwap) / snapshot.vwap) * 100;
    const direction = clamp(distance / 3);
    push({
      id: "vwap",
      name: "VWAP (20)",
      category: "Trend",
      value: formatPrice(snapshot.vwap),
      direction,
      verdict: verdictOf(direction),
      weight: 0.8,
      note:
        distance > 0
          ? "Fiyat hacim ağırlıklı ortalamanın üzerinde; alıcılar ortalama maliyetin üstünde işlem yapıyor."
          : "Fiyat hacim ağırlıklı ortalamanın altında; satıcı baskısı ortalama maliyetin altında.",
    });
  }

  // ── Momentum göstergeleri ────────────────────────────────────
  if (snapshot.rsi !== null) {
    const value = snapshot.rsi;
    let direction: number;
    let note: string;
    if (value <= 30) {
      direction = 0.85;
      note = `RSI ${formatNumber(value, 1)} ile aşırı satım bölgesinde — tepki alımı ihtimali yüksek.`;
    } else if (value >= 70) {
      direction = -0.85;
      note = `RSI ${formatNumber(value, 1)} ile aşırı alım bölgesinde — kâr satışı riski var.`;
    } else {
      direction = clamp((value - 50) / 25) * 0.6;
      note = `RSI ${formatNumber(value, 1)}: momentum ${value > 50 ? "alıcı" : "satıcı"} tarafta, aşırı bölge yok.`;
    }
    push({
      id: "rsi",
      name: "RSI (14)",
      category: "Momentum",
      value: formatNumber(value, 1),
      direction,
      verdict: verdictOf(direction),
      weight: 1.5,
      note,
    });
  }

  if (snapshot.macd !== null && snapshot.macdSignal !== null && snapshot.macdHistogram !== null) {
    const previousHistogram = prev(macdResult.histogram, 1) ?? 0;
    const rising = snapshot.macdHistogram > previousHistogram;
    const above = snapshot.macd > snapshot.macdSignal;
    const magnitude = Math.abs(snapshot.macdHistogram) / (price * 0.004 || 1);
    let direction = clamp((above ? 1 : -1) * Math.min(0.4 + magnitude * 0.5, 1));
    if (above && !rising) direction *= 0.6;
    if (!above && rising) direction *= 0.6;
    push({
      id: "macd",
      name: "MACD (12, 26, 9)",
      category: "Momentum",
      value: `${formatNumber(snapshot.macd, 4)} / ${formatNumber(snapshot.macdSignal, 4)}`,
      direction,
      verdict: verdictOf(direction),
      weight: 1.5,
      note: above
        ? `MACD sinyal çizgisinin üzerinde ve histogram ${rising ? "genişliyor" : "daralıyor"} — alıcı momentum ${rising ? "güçleniyor" : "zayıflıyor"}.`
        : `MACD sinyal çizgisinin altında ve histogram ${rising ? "daralıyor" : "genişliyor"} — satıcı momentum ${rising ? "zayıflıyor" : "güçleniyor"}.`,
    });
  }

  if (snapshot.stochK !== null && snapshot.stochD !== null) {
    const k = snapshot.stochK;
    let direction: number;
    let note: string;
    if (k <= 20) {
      direction = 0.7;
      note = `Stokastik ${formatNumber(k, 1)} ile dip bölgede; ${snapshot.stochK > snapshot.stochD ? "yukarı kesişim başlamış." : "henüz yukarı kesişim yok."}`;
    } else if (k >= 80) {
      direction = -0.7;
      note = `Stokastik ${formatNumber(k, 1)} ile tepe bölgede; ${snapshot.stochK < snapshot.stochD ? "aşağı kesişim başlamış." : "henüz aşağı kesişim yok."}`;
    } else {
      direction = clamp((k - 50) / 30) * 0.5;
      note = `Stokastik ${formatNumber(k, 1)}: orta bantta, ${k > 50 ? "yukarı" : "aşağı"} eğilimli.`;
    }
    push({
      id: "stochastic",
      name: "Stokastik (14, 3, 3)",
      category: "Momentum",
      value: `%K ${formatNumber(k, 1)} / %D ${formatNumber(snapshot.stochD, 1)}`,
      direction,
      verdict: verdictOf(direction),
      weight: 1.0,
      note,
    });
  }

  if (snapshot.cci !== null) {
    const value = snapshot.cci;
    const direction = clamp(value / 200) * (Math.abs(value) > 100 ? 1 : 0.6);
    push({
      id: "cci",
      name: "CCI (20)",
      category: "Momentum",
      value: formatNumber(value, 1),
      direction,
      verdict: verdictOf(direction),
      weight: 0.8,
      note:
        value > 100
          ? "CCI +100 üzerinde: güçlü yukarı momentum, ancak aşırı ısınma da olabilir."
          : value < -100
            ? "CCI -100 altında: güçlü aşağı momentum veya aşırı satım."
            : "CCI normal bantta; belirgin bir momentum baskısı yok.",
    });
  }

  if (snapshot.williamsR !== null) {
    const value = snapshot.williamsR;
    const direction = value <= -80 ? 0.6 : value >= -20 ? -0.6 : clamp((value + 50) / 30) * 0.4;
    push({
      id: "williams",
      name: "Williams %R (14)",
      category: "Momentum",
      value: formatNumber(value, 1),
      direction,
      verdict: verdictOf(direction),
      weight: 0.6,
      note:
        value <= -80
          ? "Williams %R aşırı satım bölgesinde."
          : value >= -20
            ? "Williams %R aşırı alım bölgesinde."
            : "Williams %R nötr bölgede.",
    });
  }

  const rocValue = last(rocSeries);
  if (rocValue !== null) {
    const direction = clamp(rocValue / 8);
    push({
      id: "roc",
      name: "Momentum (ROC 10)",
      category: "Momentum",
      value: formatPercent(rocValue),
      direction,
      verdict: verdictOf(direction),
      weight: 0.7,
      note: `Son 10 mumda fiyat ${formatPercent(rocValue)} değişti.`,
    });
  }

  // ── Volatilite ───────────────────────────────────────────────
  if (snapshot.bbPercentB !== null && snapshot.bbUpper !== null && snapshot.bbLower !== null) {
    const b = snapshot.bbPercentB;
    let direction: number;
    let note: string;
    if (b <= 0.05) {
      direction = 0.7;
      note = "Fiyat alt Bollinger bandına yapıştı — aşırı satım / tepki bölgesi.";
    } else if (b >= 0.95) {
      direction = -0.7;
      note = "Fiyat üst Bollinger bandını zorluyor — aşırı alım / kâr satışı bölgesi.";
    } else {
      direction = clamp((b - 0.5) * 1.2) * 0.5;
      note = `Fiyat bantların ${(b * 100).toFixed(0)}% seviyesinde; ${b > 0.5 ? "üst" : "alt"} banda daha yakın.`;
    }
    push({
      id: "bollinger",
      name: "Bollinger %B (20, 2)",
      category: "Volatilite",
      value: formatNumber(b * 100, 1),
      direction,
      verdict: verdictOf(direction),
      weight: 1.0,
      note,
    });
  }

  // ── Hacim ────────────────────────────────────────────────────
  const obvSlope = slopePercent(obvSeries, 14);
  if (obvSlope !== null) {
    const direction = clamp(obvSlope / 15);
    push({
      id: "obv",
      name: "OBV eğimi",
      category: "Hacim",
      value: formatPercent(obvSlope),
      direction,
      verdict: verdictOf(direction),
      weight: 1.0,
      note:
        obvSlope > 0
          ? "Bakiye hacim yükseliyor: alımlar satışlardan daha yüksek hacimle geliyor."
          : "Bakiye hacim düşüyor: satışlar daha yüksek hacimle geliyor.",
    });
  }

  if (snapshot.mfi !== null) {
    const value = snapshot.mfi;
    const direction = value <= 20 ? 0.7 : value >= 80 ? -0.7 : clamp((value - 50) / 30) * 0.5;
    push({
      id: "mfi",
      name: "Para Akış Endeksi (14)",
      category: "Hacim",
      value: formatNumber(value, 1),
      direction,
      verdict: verdictOf(direction),
      weight: 0.9,
      note:
        value <= 20
          ? "Para akışı aşırı satım bölgesinde; para çıkışı tükenmiş olabilir."
          : value >= 80
            ? "Para akışı aşırı alım bölgesinde; giriş hızı sürdürülemez olabilir."
            : `Para akışı ${formatNumber(value, 0)}: ${value > 50 ? "net giriş" : "net çıkış"} eğilimi var.`,
    });
  }

  const volumeRatio = volumeSurge(volumes);
  if (volumeRatio !== null) {
    const priceUp = price >= previousClose;
    const surge = volumeRatio > 1.5;
    const direction = surge ? (priceUp ? 0.6 : -0.6) : clamp((volumeRatio - 1) * (priceUp ? 0.4 : -0.4));
    push({
      id: "volume",
      name: "Hacim / 20 mum ort.",
      category: "Hacim",
      value: `${formatNumber(volumeRatio, 2)}×`,
      direction,
      verdict: verdictOf(direction),
      weight: 0.6,
      note: surge
        ? `Hacim ortalamanın ${formatNumber(volumeRatio, 1)} katı ve mum ${priceUp ? "yeşil" : "kırmızı"} — hareket ${priceUp ? "alıcı" : "satıcı"} tarafından destekleniyor.`
        : "Hacim ortalamaya yakın; hareketin arkasında güçlü bir katılım yok.",
    });
  }

  // ── Skor ─────────────────────────────────────────────────────
  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const weighted = checks.reduce((sum, c) => sum + c.weight * c.direction, 0);
  const score = totalWeight === 0 ? 0 : (weighted / totalWeight) * 100;
  const signal = signalFromScore(score);

  const tally = {
    al: checks.filter((c) => c.verdict === "AL").length,
    sat: checks.filter((c) => c.verdict === "SAT").length,
    notr: checks.filter((c) => c.verdict === "NÖTR").length,
  };

  // Güven: skorun büyüklüğü + göstergelerin uyumu + trendin gücü.
  const agreement =
    totalWeight === 0
      ? 0
      : checks
          .filter((c) => Math.sign(c.direction) === Math.sign(score) && c.direction !== 0)
          .reduce((sum, c) => sum + c.weight, 0) / totalWeight;
  const adxBoost = snapshot.adx === null ? 0 : Math.min(snapshot.adx, 40) / 40;
  const confidence = Math.round(
    Math.min(100, Math.abs(score) * 0.55 + agreement * 45 + adxBoost * 12),
  );

  // ── Formasyonlar ve seviyeler ────────────────────────────────
  const patterns = detectPatterns(candles, {
    rsiSeries,
    macdResult,
    ema50,
    ema200,
    bbBandwidth: bb.bandwidth,
  });
  const levels = findLevels(candles, price);

  // ── İşlem planı ──────────────────────────────────────────────
  const atrValue = snapshot.atr ?? price * 0.02;
  const atrPercent = (atrValue / price) * 100;
  const side: "LONG" | "SHORT" = score >= 0 ? "LONG" : "SHORT";
  const swingLow = Math.min(...lows.slice(-12));
  const swingHigh = Math.max(...highs.slice(-12));

  const stopLoss =
    side === "LONG"
      ? Math.min(price - atrValue * 1.5, swingLow * 0.999)
      : Math.max(price + atrValue * 1.5, swingHigh * 1.001);
  const risk = Math.abs(price - stopLoss);
  // İlk hedef, mümkünse en yakın anlamlı direnç/destek; yoksa 1R.
  const structural =
    side === "LONG"
      ? levels.resistances.find((l) => l.price - price > risk * 0.6)?.price
      : levels.supports.find((l) => price - l.price > risk * 0.6)?.price;
  const firstTarget = structural ?? (side === "LONG" ? price + risk : price - risk);
  const targets =
    side === "LONG"
      ? [firstTarget, price + risk * 1.618, price + risk * 2.618].sort((a, b) => a - b)
      : [firstTarget, price - risk * 1.618, price - risk * 2.618].sort((a, b) => b - a);

  const trade: TradePlan = {
    side,
    entry: price,
    stopLoss,
    targets,
    riskPercent: (risk / price) * 100,
    riskReward: risk === 0 ? 0 : Math.abs(targets[0] - price) / risk,
    atr: atrValue,
    atrPercent,
    advisory: signal === "BEKLE",
  };

  const bandwidth = snapshot.bbBandwidth ?? 0;
  const bandwidthHistory = bb.bandwidth.filter((v): v is number => v !== null).slice(-60);
  const bandwidthMin = bandwidthHistory.length ? Math.min(...bandwidthHistory) : bandwidth;
  const squeeze = bandwidth > 0 && bandwidth <= bandwidthMin * 1.2;

  return {
    symbol,
    ...splitSymbol(symbol),
    interval,
    intervalLabel: INTERVALS.find((i) => i.value === interval)?.label ?? interval,
    source,
    updatedAt: Date.now(),
    price,
    changePercent: ((price - previousClose) / previousClose) * 100,
    score: Number(score.toFixed(1)),
    signal,
    confidence,
    checks,
    tally,
    indicators: snapshot,
    patterns,
    levels,
    trade,
    volatility: {
      atrPercent,
      regime: atrPercent < 1 ? "düşük" : atrPercent > 3 ? "yüksek" : "normal",
      squeeze,
    },
    trendStrength: {
      adx: snapshot.adx,
      label:
        snapshot.adx === null
          ? "belirsiz"
          : snapshot.adx >= 40
            ? "çok güçlü"
            : snapshot.adx >= 25
              ? "güçlü"
              : snapshot.adx >= 20
                ? "gelişiyor"
                : "zayıf / yatay",
    },
  };
}

/** Grafikte çizilecek serileri hesaplar (analizden ayrı tutulur, JSON boyutu için). */
export function chartSeries(candles: Candle[]): ChartSeries {
  const closes = candles.map((c) => c.close);
  const macdResult = macd(closes);
  const bb = bollinger(closes, 20, 2);
  return {
    ema21: ema(closes, 21),
    ema50: ema(closes, 50),
    ema200: ema(closes, 200),
    bbUpper: bb.upper,
    bbLower: bb.lower,
    rsi: rsi(closes, 14),
    macd: macdResult.macd,
    macdSignal: macdResult.signal,
    macdHistogram: macdResult.histogram,
  };
}

function lastDirection(directions: (1 | -1 | null)[]): 1 | -1 | null {
  for (let i = directions.length - 1; i >= 0; i--) {
    if (directions[i] !== null) return directions[i];
  }
  return null;
}

/** Son `period` mumdaki yüzde eğim (OBV gibi ölçeksiz seriler için). */
function slopePercent(series: Series, period: number): number | null {
  const current = last(series);
  const past = prev(series, period);
  if (current === null || past === null) return null;
  const base = Math.abs(past);
  if (base < 1e-9) return current > 0 ? 100 : current < 0 ? -100 : 0;
  return ((current - past) / base) * 100;
}

/** Son mumun hacminin, önceki 20 mumun ortalamasına oranı. */
function volumeSurge(volumes: number[]): number | null {
  if (volumes.length < 21) return null;
  const window = volumes.slice(-21, -1);
  const average = window.reduce((sum, v) => sum + v, 0) / window.length;
  if (average === 0) return null;
  return volumes[volumes.length - 1] / average;
}

/* ────────────────────────── Formasyonlar ────────────────────────── */

function detectPatterns(
  candles: Candle[],
  context: {
    rsiSeries: Series;
    macdResult: { macd: Series; signal: Series; histogram: Series };
    ema50: Series;
    ema200: Series;
    bbBandwidth: Series;
  },
): Pattern[] {
  const patterns: Pattern[] = [];
  const n = candles.length;
  const c1 = candles[n - 1];
  const c2 = candles[n - 2];
  const c3 = candles[n - 3];

  const body = (c: Candle) => Math.abs(c.close - c.open);
  const range = (c: Candle) => Math.max(c.high - c.low, 1e-12);
  const isBull = (c: Candle) => c.close > c.open;
  const upperWick = (c: Candle) => c.high - Math.max(c.close, c.open);
  const lowerWick = (c: Candle) => Math.min(c.close, c.open) - c.low;

  // Yutan formasyonlar
  if (isBull(c1) && !isBull(c2) && c1.close > c2.open && c1.open < c2.close && body(c1) > body(c2)) {
    patterns.push({
      id: "bullish-engulfing",
      name: "Boğa yutan formasyonu",
      bias: "AL",
      note: "Son mum, önceki kırmızı mumun gövdesini tamamen yuttu — alıcılar kontrolü aldı.",
    });
  }
  if (!isBull(c1) && isBull(c2) && c1.open > c2.close && c1.close < c2.open && body(c1) > body(c2)) {
    patterns.push({
      id: "bearish-engulfing",
      name: "Ayı yutan formasyonu",
      bias: "SAT",
      note: "Son mum, önceki yeşil mumun gövdesini tamamen yuttu — satıcılar kontrolü aldı.",
    });
  }

  // Çekiç / kayan yıldız
  if (lowerWick(c1) > body(c1) * 2 && upperWick(c1) < body(c1) && body(c1) / range(c1) < 0.4) {
    patterns.push({
      id: "hammer",
      name: "Çekiç",
      bias: "AL",
      note: "Uzun alt fitil: fiyat aşağı sarkıtıldı ama alıcılar geri aldı.",
    });
  }
  if (upperWick(c1) > body(c1) * 2 && lowerWick(c1) < body(c1) && body(c1) / range(c1) < 0.4) {
    patterns.push({
      id: "shooting-star",
      name: "Kayan yıldız",
      bias: "SAT",
      note: "Uzun üst fitil: yukarı denemeler satışla karşılandı.",
    });
  }

  // Doji
  if (body(c1) / range(c1) < 0.08) {
    patterns.push({
      id: "doji",
      name: "Doji",
      bias: "NÖTR",
      note: "Açılış ve kapanış neredeyse aynı — kararsızlık, trend değişimi öncesi görülebilir.",
    });
  }

  // Sabah / akşam yıldızı
  if (!isBull(c3) && body(c2) / range(c2) < 0.3 && isBull(c1) && c1.close > (c3.open + c3.close) / 2) {
    patterns.push({
      id: "morning-star",
      name: "Sabah yıldızı",
      bias: "AL",
      note: "Üç mumluk dip dönüş formasyonu tamamlandı.",
    });
  }
  if (isBull(c3) && body(c2) / range(c2) < 0.3 && !isBull(c1) && c1.close < (c3.open + c3.close) / 2) {
    patterns.push({
      id: "evening-star",
      name: "Akşam yıldızı",
      bias: "SAT",
      note: "Üç mumluk tepe dönüş formasyonu tamamlandı.",
    });
  }

  // Ortalama kesişimleri (son 5 mumda gerçekleşmişse)
  const cross = recentCross(context.ema50, context.ema200, 5);
  if (cross === "up") {
    patterns.push({
      id: "golden-cross",
      name: "Golden cross",
      bias: "AL",
      note: "EMA 50 yakın zamanda EMA 200'ü yukarı kesti — orta vadeli trend dönüşü.",
    });
  } else if (cross === "down") {
    patterns.push({
      id: "death-cross",
      name: "Death cross",
      bias: "SAT",
      note: "EMA 50 yakın zamanda EMA 200'ü aşağı kesti — orta vadeli trend dönüşü.",
    });
  }

  const macdCross = recentCross(context.macdResult.macd, context.macdResult.signal, 3);
  if (macdCross === "up") {
    patterns.push({
      id: "macd-cross-up",
      name: "MACD yukarı kesişim",
      bias: "AL",
      note: "MACD sinyal çizgisini son mumlarda yukarı kesti.",
    });
  } else if (macdCross === "down") {
    patterns.push({
      id: "macd-cross-down",
      name: "MACD aşağı kesişim",
      bias: "SAT",
      note: "MACD sinyal çizgisini son mumlarda aşağı kesti.",
    });
  }

  // RSI uyumsuzluğu
  const divergence = detectDivergence(candles, context.rsiSeries);
  if (divergence) patterns.push(divergence);

  // Bollinger sıkışması
  const bandwidths = context.bbBandwidth.filter((v): v is number => v !== null);
  if (bandwidths.length > 40) {
    const current = bandwidths[bandwidths.length - 1];
    const window = bandwidths.slice(-60);
    if (current <= Math.min(...window) * 1.15) {
      patterns.push({
        id: "bb-squeeze",
        name: "Bollinger sıkışması",
        bias: "NÖTR",
        note: "Bantlar son 60 mumun en dar seviyesinde — sert bir hareket öncesi enerji birikimi.",
      });
    }
  }

  return patterns;
}

/** İki serinin son `lookback` mumda kesişip kesişmediği. */
function recentCross(fast: Series, slow: Series, lookback: number): "up" | "down" | null {
  const points: { fast: number; slow: number }[] = [];
  for (let i = fast.length - 1; i >= 0 && points.length < lookback + 1; i--) {
    const f = fast[i];
    const s = slow[i];
    if (f === null || s === null) continue;
    points.unshift({ fast: f, slow: s });
  }
  if (points.length < 2) return null;
  for (let i = 1; i < points.length; i++) {
    const before = points[i - 1].fast - points[i - 1].slow;
    const after = points[i].fast - points[i].slow;
    if (before <= 0 && after > 0) return "up";
    if (before >= 0 && after < 0) return "down";
  }
  return null;
}

/** Fiyat ile RSI arasında pozitif/negatif uyumsuzluk arar. */
function detectDivergence(candles: Candle[], rsiSeries: Series): Pattern | null {
  const window = 40;
  if (candles.length < window + 5) return null;
  const slice = candles.slice(-window);
  const rsiSlice = rsiSeries.slice(-window);

  let lowIndex = 0;
  let highIndex = 0;
  for (let i = 1; i < slice.length - 3; i++) {
    if (slice[i].low < slice[lowIndex].low) lowIndex = i;
    if (slice[i].high > slice[highIndex].high) highIndex = i;
  }

  const lastIndex = slice.length - 1;
  const recentLow = Math.min(...slice.slice(-6).map((c) => c.low));
  const recentHigh = Math.max(...slice.slice(-6).map((c) => c.high));
  const rsiNow = rsiSlice[lastIndex];
  const rsiAtLow = rsiSlice[lowIndex];
  const rsiAtHigh = rsiSlice[highIndex];

  if (rsiNow === null) return null;

  if (
    rsiAtLow !== null &&
    lowIndex < slice.length - 6 &&
    recentLow <= slice[lowIndex].low * 1.005 &&
    rsiNow > rsiAtLow + 4
  ) {
    return {
      id: "bullish-divergence",
      name: "Pozitif uyumsuzluk",
      bias: "AL",
      note: "Fiyat yeni dip yaparken RSI daha yüksek dip yaptı — düşüş momentumu zayıflıyor.",
    };
  }
  if (
    rsiAtHigh !== null &&
    highIndex < slice.length - 6 &&
    recentHigh >= slice[highIndex].high * 0.995 &&
    rsiNow < rsiAtHigh - 4
  ) {
    return {
      id: "bearish-divergence",
      name: "Negatif uyumsuzluk",
      bias: "SAT",
      note: "Fiyat yeni zirve denerken RSI daha düşük zirve yaptı — yükseliş momentumu zayıflıyor.",
    };
  }
  return null;
}

/* ────────────────────────── Destek / direnç ────────────────────────── */

/**
 * Swing (pivot) noktalarından destek ve direnç seviyeleri çıkarır.
 * Yakın pivotlar tek bir seviyede kümelenir; kümedeki dokunuş sayısı gücü verir.
 */
export function findLevels(
  candles: Candle[],
  price: number,
): { supports: Level[]; resistances: Level[] } {
  const span = 3;
  const pivots: number[] = [];

  for (let i = span; i < candles.length - span; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - span; j <= i + span; j++) {
      if (j === i) continue;
      if (candles[j].high >= candles[i].high) isHigh = false;
      if (candles[j].low <= candles[i].low) isLow = false;
    }
    if (isHigh) pivots.push(candles[i].high);
    if (isLow) pivots.push(candles[i].low);
  }

  // Yakın pivotları kümele (%0,6 tolerans).
  const clusters: { price: number; touches: number }[] = [];
  for (const pivot of pivots.sort((a, b) => a - b)) {
    const existing = clusters.find((c) => Math.abs(c.price - pivot) / c.price < 0.006);
    if (existing) {
      existing.price = (existing.price * existing.touches + pivot) / (existing.touches + 1);
      existing.touches += 1;
    } else {
      clusters.push({ price: pivot, touches: 1 });
    }
  }

  const toLevel = (cluster: { price: number; touches: number }): Level => ({
    price: cluster.price,
    strength: Math.min(cluster.touches, 5),
    distancePercent: ((cluster.price - price) / price) * 100,
  });

  const supports = clusters
    .filter((c) => c.price < price)
    .sort((a, b) => b.price - a.price)
    .slice(0, 3)
    .map(toLevel);

  const resistances = clusters
    .filter((c) => c.price > price)
    .sort((a, b) => a.price - b.price)
    .slice(0, 3)
    .map(toLevel);

  return { supports, resistances };
}

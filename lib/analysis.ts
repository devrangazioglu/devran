/**
 * Sinyal motoru — piyasa ve dilden bağımsız.
 *
 * Girdi yalnızca mum dizisidir; kripto, hisse, endeks, emtia ve döviz için
 * aynı şekilde çalışır. Çıktıdaki metinler doğrudan cümle değil, çeviri
 * anahtarı + parametre olarak üretilir; böylece her dile çevrilebilir.
 *
 * Not: Üretilen çıktı yatırım tavsiyesi değildir; kural tabanlı bir teknik
 * analiz özetidir.
 */

import type { Candle, DataSource, Instrument, Interval } from "./markets/types";
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

export type Verdict = "BUY" | "SELL" | "NEUTRAL";
export type SignalLabel = "STRONG_BUY" | "BUY" | "WAIT" | "SELL" | "STRONG_SELL";
export type Category = "trend" | "momentum" | "volatility" | "volume";

/** Gösterge değerinin gösterime hazır parçaları (biçimlendirme arayüzde yapılır). */
export type ValuePart =
  | { kind: "price"; value: number }
  | { kind: "number"; value: number; digits?: number }
  | { kind: "percent"; value: number }
  | { kind: "text"; text: string };

export type IndicatorCheck = {
  id: string;
  category: Category;
  /** Gösterge adının çeviri anahtarı. */
  labelKey: string;
  value: ValuePart[];
  /** Yön: -1 (güçlü satış) ile +1 (güçlü alış) arası. */
  direction: number;
  verdict: Verdict;
  weight: number;
  /** Açıklamanın çeviri anahtarı ve parametreleri. */
  noteKey: string;
  noteParams?: Record<string, string | number>;
};

export type Pattern = {
  id: string;
  bias: Verdict;
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
  riskPercent: number;
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
  instrument: Instrument;
  interval: Interval;
  source: DataSource;
  updatedAt: number;
  price: number;
  /** Seçilen zaman diliminde son mumun değişimi. */
  changePercent: number;
  score: number;
  signal: SignalLabel;
  confidence: number;
  checks: IndicatorCheck[];
  tally: { buy: number; sell: number; neutral: number };
  indicators: IndicatorSnapshot;
  patterns: Pattern[];
  levels: { supports: Level[]; resistances: Level[] };
  trade: TradePlan;
  volatility: { atrPercent: number; regimeKey: string; squeeze: boolean };
  trendStrength: { adx: number | null; labelKey: string };
};

/* ────────────────────────── Yardımcılar ────────────────────────── */

function verdictOf(direction: number): Verdict {
  if (direction >= 0.15) return "BUY";
  if (direction <= -0.15) return "SELL";
  return "NEUTRAL";
}

function clamp(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

export function signalFromScore(score: number): SignalLabel {
  if (score >= 45) return "STRONG_BUY";
  if (score >= 18) return "BUY";
  if (score <= -45) return "STRONG_SELL";
  if (score <= -18) return "SELL";
  return "WAIT";
}

export function signalTone(signal: SignalLabel): "up" | "down" | "flat" {
  if (signal === "STRONG_BUY" || signal === "BUY") return "up";
  if (signal === "STRONG_SELL" || signal === "SELL") return "down";
  return "flat";
}

export function isBuySignal(signal: SignalLabel): boolean {
  return signal === "BUY" || signal === "STRONG_BUY";
}

export function isSellSignal(signal: SignalLabel): boolean {
  return signal === "SELL" || signal === "STRONG_SELL";
}

const price = (value: number): ValuePart => ({ kind: "price", value });
const num = (value: number, digits = 2): ValuePart => ({ kind: "number", value, digits });
const pct = (value: number): ValuePart => ({ kind: "percent", value });
const text = (value: string): ValuePart => ({ kind: "text", text: value });

/* ────────────────────────── Ana analiz ────────────────────────── */

export function analyze(
  instrument: Instrument,
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
  const lastPrice = closes[closes.length - 1];
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

  // ── Trend ────────────────────────────────────────────────────
  if (snapshot.ema9 !== null && snapshot.ema21 !== null) {
    const spread = ((snapshot.ema9 - snapshot.ema21) / snapshot.ema21) * 100;
    const direction = clamp(spread / 1.2);
    push({
      id: "ema-cross",
      category: "trend",
      labelKey: "ind.emaCross",
      value: [price(snapshot.ema9), text("/"), price(snapshot.ema21)],
      direction,
      verdict: verdictOf(direction),
      weight: 1.2,
      noteKey: spread > 0 ? "note.emaCross.up" : "note.emaCross.down",
      noteParams: { spread: Math.abs(spread).toFixed(2) },
    });
  }

  if (snapshot.ema50 !== null && snapshot.ema200 !== null) {
    const spread = ((snapshot.ema50 - snapshot.ema200) / snapshot.ema200) * 100;
    const direction = clamp(spread / 5);
    push({
      id: "ema-50-200",
      category: "trend",
      labelKey: "ind.ema50200",
      value: [price(snapshot.ema50), text("/"), price(snapshot.ema200)],
      direction,
      verdict: verdictOf(direction),
      weight: 1.5,
      noteKey: spread > 0 ? "note.ema50200.golden" : "note.ema50200.death",
    });
  }

  if (snapshot.ema200 !== null) {
    const distance = ((lastPrice - snapshot.ema200) / snapshot.ema200) * 100;
    const direction = clamp(distance / 8);
    push({
      id: "price-ema200",
      category: "trend",
      labelKey: "ind.priceEma200",
      value: [pct(distance)],
      direction,
      verdict: verdictOf(direction),
      weight: 1.1,
      noteKey: distance > 0 ? "note.priceEma200.above" : "note.priceEma200.below",
    });
  }

  if (snapshot.supertrendDirection !== null && snapshot.supertrend !== null) {
    const up = snapshot.supertrendDirection === 1;
    push({
      id: "supertrend",
      category: "trend",
      labelKey: "ind.supertrend",
      value: [price(snapshot.supertrend)],
      direction: up ? 0.8 : -0.8,
      verdict: up ? "BUY" : "SELL",
      weight: 1.4,
      noteKey: up ? "note.supertrend.up" : "note.supertrend.down",
      noteParams: { level: snapshot.supertrend.toPrecision(6) },
    });
  }

  if (snapshot.adx !== null && snapshot.plusDI !== null && snapshot.minusDI !== null) {
    const diSpread = snapshot.plusDI - snapshot.minusDI;
    const strength = Math.min(snapshot.adx / 40, 1);
    const direction = clamp((diSpread / 25) * strength * 1.6);
    push({
      id: "adx",
      category: "trend",
      labelKey: "ind.adx",
      value: [
        num(snapshot.adx, 1),
        text("+DI"),
        num(snapshot.plusDI, 1),
        text("-DI"),
        num(snapshot.minusDI, 1),
      ],
      direction,
      verdict: verdictOf(direction),
      weight: 1.3,
      noteKey:
        snapshot.adx < 20 ? "note.adx.weak" : diSpread > 0 ? "note.adx.up" : "note.adx.down",
      noteParams: { adx: snapshot.adx.toFixed(0) },
    });
  }

  if (snapshot.vwap !== null) {
    const distance = ((lastPrice - snapshot.vwap) / snapshot.vwap) * 100;
    const direction = clamp(distance / 3);
    push({
      id: "vwap",
      category: "trend",
      labelKey: "ind.vwap",
      value: [price(snapshot.vwap)],
      direction,
      verdict: verdictOf(direction),
      weight: 0.8,
      noteKey: distance > 0 ? "note.vwap.above" : "note.vwap.below",
    });
  }

  // ── Momentum ─────────────────────────────────────────────────
  if (snapshot.rsi !== null) {
    const value = snapshot.rsi;
    let direction: number;
    let noteKey: string;
    if (value <= 30) {
      direction = 0.85;
      noteKey = "note.rsi.oversold";
    } else if (value >= 70) {
      direction = -0.85;
      noteKey = "note.rsi.overbought";
    } else {
      direction = clamp((value - 50) / 25) * 0.6;
      noteKey = value > 50 ? "note.rsi.bull" : "note.rsi.bear";
    }
    push({
      id: "rsi",
      category: "momentum",
      labelKey: "ind.rsi",
      value: [num(value, 1)],
      direction,
      verdict: verdictOf(direction),
      weight: 1.5,
      noteKey,
      noteParams: { rsi: value.toFixed(1) },
    });
  }

  if (snapshot.macd !== null && snapshot.macdSignal !== null && snapshot.macdHistogram !== null) {
    const previousHistogram = prev(macdResult.histogram, 1) ?? 0;
    const rising = snapshot.macdHistogram > previousHistogram;
    const above = snapshot.macd > snapshot.macdSignal;
    const magnitude = Math.abs(snapshot.macdHistogram) / (lastPrice * 0.004 || 1);
    let direction = clamp((above ? 1 : -1) * Math.min(0.4 + magnitude * 0.5, 1));
    if (above !== rising) direction *= 0.6;
    push({
      id: "macd",
      category: "momentum",
      labelKey: "ind.macd",
      value: [num(snapshot.macd, 4), text("/"), num(snapshot.macdSignal, 4)],
      direction,
      verdict: verdictOf(direction),
      weight: 1.5,
      noteKey: above
        ? rising
          ? "note.macd.aboveRising"
          : "note.macd.aboveFalling"
        : rising
          ? "note.macd.belowRising"
          : "note.macd.belowFalling",
    });
  }

  if (snapshot.stochK !== null && snapshot.stochD !== null) {
    const k = snapshot.stochK;
    const direction = k <= 20 ? 0.7 : k >= 80 ? -0.7 : clamp((k - 50) / 30) * 0.5;
    push({
      id: "stochastic",
      category: "momentum",
      labelKey: "ind.stoch",
      value: [num(k, 1), text("/"), num(snapshot.stochD, 1)],
      direction,
      verdict: verdictOf(direction),
      weight: 1.0,
      noteKey: k <= 20 ? "note.stoch.low" : k >= 80 ? "note.stoch.high" : "note.stoch.mid",
      noteParams: { k: k.toFixed(0) },
    });
  }

  if (snapshot.cci !== null) {
    const value = snapshot.cci;
    const direction = clamp(value / 200) * (Math.abs(value) > 100 ? 1 : 0.6);
    push({
      id: "cci",
      category: "momentum",
      labelKey: "ind.cci",
      value: [num(value, 1)],
      direction,
      verdict: verdictOf(direction),
      weight: 0.8,
      noteKey: value > 100 ? "note.cci.high" : value < -100 ? "note.cci.low" : "note.cci.mid",
    });
  }

  if (snapshot.williamsR !== null) {
    const value = snapshot.williamsR;
    const direction = value <= -80 ? 0.6 : value >= -20 ? -0.6 : clamp((value + 50) / 30) * 0.4;
    push({
      id: "williams",
      category: "momentum",
      labelKey: "ind.williams",
      value: [num(value, 1)],
      direction,
      verdict: verdictOf(direction),
      weight: 0.6,
      noteKey:
        value <= -80
          ? "note.williams.oversold"
          : value >= -20
            ? "note.williams.overbought"
            : "note.williams.neutral",
    });
  }

  const rocValue = last(rocSeries);
  if (rocValue !== null) {
    const direction = clamp(rocValue / 8);
    push({
      id: "roc",
      category: "momentum",
      labelKey: "ind.roc",
      value: [pct(rocValue)],
      direction,
      verdict: verdictOf(direction),
      weight: 0.7,
      noteKey: "note.roc.value",
      noteParams: { roc: rocValue.toFixed(2) },
    });
  }

  // ── Volatilite ───────────────────────────────────────────────
  if (snapshot.bbPercentB !== null) {
    const b = snapshot.bbPercentB;
    const direction = b <= 0.05 ? 0.7 : b >= 0.95 ? -0.7 : clamp((b - 0.5) * 1.2) * 0.5;
    push({
      id: "bollinger",
      category: "volatility",
      labelKey: "ind.bollinger",
      value: [num(b * 100, 1)],
      direction,
      verdict: verdictOf(direction),
      weight: 1.0,
      noteKey: b <= 0.05 ? "note.bb.lower" : b >= 0.95 ? "note.bb.upper" : "note.bb.mid",
      noteParams: { percent: (b * 100).toFixed(0) },
    });
  }

  // ── Hacim ────────────────────────────────────────────────────
  const obvSlope = slopePercent(obvSeries, 14);
  if (obvSlope !== null) {
    const direction = clamp(obvSlope / 15);
    push({
      id: "obv",
      category: "volume",
      labelKey: "ind.obv",
      value: [pct(obvSlope)],
      direction,
      verdict: verdictOf(direction),
      weight: 1.0,
      noteKey: obvSlope > 0 ? "note.obv.up" : "note.obv.down",
    });
  }

  if (snapshot.mfi !== null) {
    const value = snapshot.mfi;
    const direction = value <= 20 ? 0.7 : value >= 80 ? -0.7 : clamp((value - 50) / 30) * 0.5;
    push({
      id: "mfi",
      category: "volume",
      labelKey: "ind.mfi",
      value: [num(value, 1)],
      direction,
      verdict: verdictOf(direction),
      weight: 0.9,
      noteKey: value <= 20 ? "note.mfi.low" : value >= 80 ? "note.mfi.high" : "note.mfi.mid",
      noteParams: { mfi: value.toFixed(0) },
    });
  }

  const volumeRatio = volumeSurge(volumes);
  if (volumeRatio !== null) {
    const priceUp = lastPrice >= previousClose;
    const surge = volumeRatio > 1.5;
    const direction = surge
      ? priceUp
        ? 0.6
        : -0.6
      : clamp((volumeRatio - 1) * (priceUp ? 0.4 : -0.4));
    push({
      id: "volume",
      category: "volume",
      labelKey: "ind.volume",
      value: [num(volumeRatio, 2), text("×")],
      direction,
      verdict: verdictOf(direction),
      weight: 0.6,
      noteKey: surge ? "note.volume.surge" : "note.volume.normal",
      noteParams: surge
        ? { ratio: volumeRatio.toFixed(1), directionKey: priceUp ? "up" : "down" }
        : undefined,
    });
  }

  // ── Skor ─────────────────────────────────────────────────────
  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const weighted = checks.reduce((sum, c) => sum + c.weight * c.direction, 0);
  const score = totalWeight === 0 ? 0 : (weighted / totalWeight) * 100;
  const signal = signalFromScore(score);

  const tally = {
    buy: checks.filter((c) => c.verdict === "BUY").length,
    sell: checks.filter((c) => c.verdict === "SELL").length,
    neutral: checks.filter((c) => c.verdict === "NEUTRAL").length,
  };

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
  const levels = findLevels(candles, lastPrice);

  // ── İşlem planı ──────────────────────────────────────────────
  const atrValue = snapshot.atr ?? lastPrice * 0.02;
  const atrPercent = (atrValue / lastPrice) * 100;
  const side: "LONG" | "SHORT" = score >= 0 ? "LONG" : "SHORT";
  const swingLow = Math.min(...lows.slice(-12));
  const swingHigh = Math.max(...highs.slice(-12));

  const stopLoss =
    side === "LONG"
      ? Math.min(lastPrice - atrValue * 1.5, swingLow * 0.999)
      : Math.max(lastPrice + atrValue * 1.5, swingHigh * 1.001);
  const risk = Math.abs(lastPrice - stopLoss);
  const structural =
    side === "LONG"
      ? levels.resistances.find((l) => l.price - lastPrice > risk * 0.6)?.price
      : levels.supports.find((l) => lastPrice - l.price > risk * 0.6)?.price;
  const firstTarget = structural ?? (side === "LONG" ? lastPrice + risk : lastPrice - risk);
  const targets =
    side === "LONG"
      ? [firstTarget, lastPrice + risk * 1.618, lastPrice + risk * 2.618].sort((a, b) => a - b)
      : [firstTarget, lastPrice - risk * 1.618, lastPrice - risk * 2.618].sort((a, b) => b - a);

  const trade: TradePlan = {
    side,
    entry: lastPrice,
    stopLoss,
    targets,
    riskPercent: (risk / lastPrice) * 100,
    riskReward: risk === 0 ? 0 : Math.abs(targets[0] - lastPrice) / risk,
    atr: atrValue,
    atrPercent,
    advisory: signal === "WAIT",
  };

  const bandwidth = snapshot.bbBandwidth ?? 0;
  const bandwidthHistory = bb.bandwidth.filter((v): v is number => v !== null).slice(-60);
  const bandwidthMin = bandwidthHistory.length ? Math.min(...bandwidthHistory) : bandwidth;
  const squeeze = bandwidth > 0 && bandwidth <= bandwidthMin * 1.2;

  return {
    instrument,
    interval,
    source,
    updatedAt: Date.now(),
    price: lastPrice,
    changePercent: ((lastPrice - previousClose) / previousClose) * 100,
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
      regimeKey: atrPercent < 1 ? "vol.low" : atrPercent > 3 ? "vol.high" : "vol.normal",
      squeeze,
    },
    trendStrength: {
      adx: snapshot.adx,
      labelKey:
        snapshot.adx === null
          ? "trend.unknown"
          : snapshot.adx >= 40
            ? "trend.veryStrong"
            : snapshot.adx >= 25
              ? "trend.strong"
              : snapshot.adx >= 20
                ? "trend.developing"
                : "trend.weak",
    },
  };
}

/** Grafikte çizilecek serileri hesaplar. */
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

  if (isBull(c1) && !isBull(c2) && c1.close > c2.open && c1.open < c2.close && body(c1) > body(c2)) {
    patterns.push({ id: "bullish-engulfing", bias: "BUY" });
  }
  if (!isBull(c1) && isBull(c2) && c1.open > c2.close && c1.close < c2.open && body(c1) > body(c2)) {
    patterns.push({ id: "bearish-engulfing", bias: "SELL" });
  }
  if (lowerWick(c1) > body(c1) * 2 && upperWick(c1) < body(c1) && body(c1) / range(c1) < 0.4) {
    patterns.push({ id: "hammer", bias: "BUY" });
  }
  if (upperWick(c1) > body(c1) * 2 && lowerWick(c1) < body(c1) && body(c1) / range(c1) < 0.4) {
    patterns.push({ id: "shooting-star", bias: "SELL" });
  }
  if (body(c1) / range(c1) < 0.08) {
    patterns.push({ id: "doji", bias: "NEUTRAL" });
  }
  if (!isBull(c3) && body(c2) / range(c2) < 0.3 && isBull(c1) && c1.close > (c3.open + c3.close) / 2) {
    patterns.push({ id: "morning-star", bias: "BUY" });
  }
  if (isBull(c3) && body(c2) / range(c2) < 0.3 && !isBull(c1) && c1.close < (c3.open + c3.close) / 2) {
    patterns.push({ id: "evening-star", bias: "SELL" });
  }

  const cross = recentCross(context.ema50, context.ema200, 5);
  if (cross === "up") patterns.push({ id: "golden-cross", bias: "BUY" });
  else if (cross === "down") patterns.push({ id: "death-cross", bias: "SELL" });

  const macdCross = recentCross(context.macdResult.macd, context.macdResult.signal, 3);
  if (macdCross === "up") patterns.push({ id: "macd-cross-up", bias: "BUY" });
  else if (macdCross === "down") patterns.push({ id: "macd-cross-down", bias: "SELL" });

  const divergence = detectDivergence(candles, context.rsiSeries);
  if (divergence) patterns.push(divergence);

  const bandwidths = context.bbBandwidth.filter((v): v is number => v !== null);
  if (bandwidths.length > 40) {
    const current = bandwidths[bandwidths.length - 1];
    const window = bandwidths.slice(-60);
    if (current <= Math.min(...window) * 1.15) {
      patterns.push({ id: "bb-squeeze", bias: "NEUTRAL" });
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
    return { id: "bullish-divergence", bias: "BUY" };
  }
  if (
    rsiAtHigh !== null &&
    highIndex < slice.length - 6 &&
    recentHigh >= slice[highIndex].high * 0.995 &&
    rsiNow < rsiAtHigh - 4
  ) {
    return { id: "bearish-divergence", bias: "SELL" };
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
  currentPrice: number,
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
    distancePercent: ((cluster.price - currentPrice) / currentPrice) * 100,
  });

  const supports = clusters
    .filter((c) => c.price < currentPrice)
    .sort((a, b) => b.price - a.price)
    .slice(0, 3)
    .map(toLevel);

  const resistances = clusters
    .filter((c) => c.price > currentPrice)
    .sort((a, b) => a.price - b.price)
    .slice(0, 3)
    .map(toLevel);

  return { supports, resistances };
}

/**
 * Teknik gösterge kütüphanesi.
 *
 * Tüm fonksiyonlar saf (pure) fonksiyonlardır ve girdiyle aynı uzunlukta dizi
 * döndürür. Hesaplanamayan (ısınma/warm-up) noktalar `null` olur, böylece
 * gösterge değerleri mum dizisiyle indeks indeks hizalı kalır.
 */

export type Series = (number | null)[];

/** Bir gösterge dizisinin son geçerli (null olmayan) değeri. */
export function last(series: Series): number | null {
  for (let i = series.length - 1; i >= 0; i--) {
    const v = series[i];
    if (v !== null && Number.isFinite(v)) return v;
  }
  return null;
}

/** Sondan `n` adım önceki geçerli değer (0 = son değer). */
export function prev(series: Series, n = 1): number | null {
  let seen = -1;
  for (let i = series.length - 1; i >= 0; i--) {
    const v = series[i];
    if (v !== null && Number.isFinite(v)) {
      seen++;
      if (seen === n) return v;
    }
  }
  return null;
}

function filled(length: number): Series {
  return new Array(length).fill(null);
}

/* ────────────────────────────── Ortalamalar ────────────────────────────── */

/** Basit hareketli ortalama. */
export function sma(values: number[], period: number): Series {
  const out = filled(values.length);
  if (period <= 0) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Üssel hareketli ortalama (ilk değer SMA ile tohumlanır). */
export function ema(values: number[], period: number): Series {
  const out = filled(values.length);
  if (period <= 0 || values.length < period) return out;
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let value = sum / period;
  out[period - 1] = value;
  for (let i = period; i < values.length; i++) {
    value = values[i] * k + value * (1 - k);
    out[i] = value;
  }
  return out;
}

/** Wilder yumuşatması (RSI/ATR/ADX'te kullanılır). */
function wilder(values: number[], period: number): Series {
  const out = filled(values.length);
  if (values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let value = sum / period;
  out[period - 1] = value;
  for (let i = period; i < values.length; i++) {
    value = (value * (period - 1) + values[i]) / period;
    out[i] = value;
  }
  return out;
}

/** Standart sapma (kayan pencere, popülasyon). */
export function stddev(values: number[], period: number): Series {
  const out = filled(values.length);
  if (values.length < period) return out;
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j];
    const mean = sum / period;
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) variance += (values[j] - mean) ** 2;
    out[i] = Math.sqrt(variance / period);
  }
  return out;
}

/* ────────────────────────────── Momentum ────────────────────────────── */

/** Göreceli Güç Endeksi — Wilder yöntemi. 0-100 arası. */
export function rsi(values: number[], period = 14): Series {
  const out = filled(values.length);
  if (values.length <= period) return out;

  const gains: number[] = [0];
  const losses: number[] = [0];
  for (let i = 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    gains.push(Math.max(change, 0));
    losses.push(Math.max(-change, 0));
  }

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }
  avgGain /= period;
  avgLoss /= period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export type MacdResult = { macd: Series; signal: Series; histogram: Series };

/** MACD — hızlı/yavaş EMA farkı ve sinyal çizgisi. */
export function macd(values: number[], fast = 12, slow = 26, signalPeriod = 9): MacdResult {
  const fastEma = ema(values, fast);
  const slowEma = ema(values, slow);
  const macdLine = filled(values.length);
  const compact: number[] = [];
  const compactIndex: number[] = [];

  for (let i = 0; i < values.length; i++) {
    const f = fastEma[i];
    const s = slowEma[i];
    if (f === null || s === null) continue;
    macdLine[i] = f - s;
    compact.push(f - s);
    compactIndex.push(i);
  }

  const signalCompact = ema(compact, signalPeriod);
  const signal = filled(values.length);
  const histogram = filled(values.length);
  for (let i = 0; i < compactIndex.length; i++) {
    const value = signalCompact[i];
    if (value === null) continue;
    const target = compactIndex[i];
    signal[target] = value;
    histogram[target] = compact[i] - value;
  }
  return { macd: macdLine, signal, histogram };
}

export type StochasticResult = { k: Series; d: Series };

/** Stokastik osilatör (%K / %D). */
export function stochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14,
  smoothK = 3,
  smoothD = 3,
): StochasticResult {
  const raw = filled(closes.length);
  for (let i = period - 1; i < closes.length; i++) {
    let highest = -Infinity;
    let lowest = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (highs[j] > highest) highest = highs[j];
      if (lows[j] < lowest) lowest = lows[j];
    }
    const range = highest - lowest;
    raw[i] = range === 0 ? 50 : ((closes[i] - lowest) / range) * 100;
  }
  const k = smoothSeries(raw, smoothK);
  const d = smoothSeries(k, smoothD);
  return { k, d };
}

/** null'ları atlayarak bir gösterge dizisine SMA uygular. */
function smoothSeries(series: Series, period: number): Series {
  if (period <= 1) return series.slice();
  const out = filled(series.length);
  const compact: number[] = [];
  const compactIndex: number[] = [];
  for (let i = 0; i < series.length; i++) {
    const v = series[i];
    if (v === null) continue;
    compact.push(v);
    compactIndex.push(i);
  }
  const smoothed = sma(compact, period);
  for (let i = 0; i < compactIndex.length; i++) out[compactIndex[i]] = smoothed[i];
  return out;
}

/** Commodity Channel Index. */
export function cci(highs: number[], lows: number[], closes: number[], period = 20): Series {
  const typical = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  const typicalSma = sma(typical, period);
  const out = filled(closes.length);
  for (let i = period - 1; i < closes.length; i++) {
    const mean = typicalSma[i];
    if (mean === null) continue;
    let deviation = 0;
    for (let j = i - period + 1; j <= i; j++) deviation += Math.abs(typical[j] - mean);
    deviation /= period;
    out[i] = deviation === 0 ? 0 : (typical[i] - mean) / (0.015 * deviation);
  }
  return out;
}

/** Williams %R — 0 ile -100 arası. */
export function williamsR(highs: number[], lows: number[], closes: number[], period = 14): Series {
  const out = filled(closes.length);
  for (let i = period - 1; i < closes.length; i++) {
    let highest = -Infinity;
    let lowest = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (highs[j] > highest) highest = highs[j];
      if (lows[j] < lowest) lowest = lows[j];
    }
    const range = highest - lowest;
    out[i] = range === 0 ? -50 : ((highest - closes[i]) / range) * -100;
  }
  return out;
}

/** Momentum / değişim oranı (yüzde). */
export function roc(values: number[], period = 10): Series {
  const out = filled(values.length);
  for (let i = period; i < values.length; i++) {
    const base = values[i - period];
    if (base === 0) continue;
    out[i] = ((values[i] - base) / base) * 100;
  }
  return out;
}

/* ────────────────────────────── Volatilite ────────────────────────────── */

export type BollingerResult = {
  upper: Series;
  middle: Series;
  lower: Series;
  /** Bant genişliği, orta bandın yüzdesi olarak. */
  bandwidth: Series;
  /** Fiyatın bantlar içindeki konumu: 0 = alt bant, 1 = üst bant. */
  percentB: Series;
};

/** Bollinger bantları. */
export function bollinger(values: number[], period = 20, multiplier = 2): BollingerResult {
  const middle = sma(values, period);
  const deviation = stddev(values, period);
  const upper = filled(values.length);
  const lower = filled(values.length);
  const bandwidth = filled(values.length);
  const percentB = filled(values.length);

  for (let i = 0; i < values.length; i++) {
    const m = middle[i];
    const s = deviation[i];
    if (m === null || s === null) continue;
    const u = m + multiplier * s;
    const l = m - multiplier * s;
    upper[i] = u;
    lower[i] = l;
    bandwidth[i] = m === 0 ? 0 : ((u - l) / m) * 100;
    percentB[i] = u - l === 0 ? 0.5 : (values[i] - l) / (u - l);
  }
  return { upper, middle, lower, bandwidth, percentB };
}

/** Gerçek aralık (true range) dizisi. */
function trueRange(highs: number[], lows: number[], closes: number[]): number[] {
  const out: number[] = [highs[0] - lows[0]];
  for (let i = 1; i < closes.length; i++) {
    out.push(
      Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1]),
      ),
    );
  }
  return out;
}

/** Ortalama Gerçek Aralık (ATR) — Wilder. */
export function atr(highs: number[], lows: number[], closes: number[], period = 14): Series {
  return wilder(trueRange(highs, lows, closes), period);
}

export type AdxResult = { adx: Series; plusDI: Series; minusDI: Series };

/** Ortalama Yön Endeksi (ADX) ve yön göstergeleri (+DI / -DI). */
export function adx(highs: number[], lows: number[], closes: number[], period = 14): AdxResult {
  const length = closes.length;
  const plusDM: number[] = [0];
  const minusDM: number[] = [0];
  for (let i = 1; i < length; i++) {
    const up = highs[i] - highs[i - 1];
    const down = lows[i - 1] - lows[i];
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
  }

  const tr = wilder(trueRange(highs, lows, closes), period);
  const smoothPlus = wilder(plusDM, period);
  const smoothMinus = wilder(minusDM, period);

  const plusDI = filled(length);
  const minusDI = filled(length);
  const dx: number[] = [];
  const dxIndex: number[] = [];

  for (let i = 0; i < length; i++) {
    const t = tr[i];
    const p = smoothPlus[i];
    const m = smoothMinus[i];
    if (t === null || p === null || m === null || t === 0) continue;
    const pdi = (p / t) * 100;
    const mdi = (m / t) * 100;
    plusDI[i] = pdi;
    minusDI[i] = mdi;
    const sum = pdi + mdi;
    dx.push(sum === 0 ? 0 : (Math.abs(pdi - mdi) / sum) * 100);
    dxIndex.push(i);
  }

  const adxCompact = wilder(dx, period);
  const adxSeries = filled(length);
  for (let i = 0; i < dxIndex.length; i++) {
    const value = adxCompact[i];
    if (value !== null) adxSeries[dxIndex[i]] = value;
  }
  return { adx: adxSeries, plusDI, minusDI };
}

export type SupertrendResult = { value: Series; direction: (1 | -1 | null)[] };

/** Supertrend — ATR tabanlı trend takip göstergesi. */
export function supertrend(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 10,
  multiplier = 3,
): SupertrendResult {
  const atrSeries = atr(highs, lows, closes, period);
  const value = filled(closes.length);
  const direction: (1 | -1 | null)[] = new Array(closes.length).fill(null);

  let upperBand = 0;
  let lowerBand = 0;
  let trend: 1 | -1 = 1;
  let started = false;

  for (let i = 0; i < closes.length; i++) {
    const a = atrSeries[i];
    if (a === null) continue;
    const mid = (highs[i] + lows[i]) / 2;
    let up = mid + multiplier * a;
    let low = mid - multiplier * a;

    if (started) {
      up = closes[i - 1] > upperBand ? Math.max(up, upperBand) : up;
      low = closes[i - 1] < lowerBand ? Math.min(low, lowerBand) : low;
      if (trend === 1 && closes[i] < lowerBand) trend = -1;
      else if (trend === -1 && closes[i] > upperBand) trend = 1;
    } else {
      trend = closes[i] >= mid ? 1 : -1;
      started = true;
    }

    upperBand = up;
    lowerBand = low;
    direction[i] = trend;
    value[i] = trend === 1 ? lowerBand : upperBand;
  }
  return { value, direction };
}

/* ────────────────────────────── Hacim ────────────────────────────── */

/** On Balance Volume. */
export function obv(closes: number[], volumes: number[]): Series {
  const out = filled(closes.length);
  let total = 0;
  out[0] = 0;
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) total += volumes[i];
    else if (closes[i] < closes[i - 1]) total -= volumes[i];
    out[i] = total;
  }
  return out;
}

/** Money Flow Index — hacim ağırlıklı RSI benzeri. */
export function mfi(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  period = 14,
): Series {
  const out = filled(closes.length);
  const typical = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  for (let i = period; i < closes.length; i++) {
    let positive = 0;
    let negative = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const flow = typical[j] * volumes[j];
      if (typical[j] > typical[j - 1]) positive += flow;
      else if (typical[j] < typical[j - 1]) negative += flow;
    }
    out[i] = negative === 0 ? 100 : 100 - 100 / (1 + positive / negative);
  }
  return out;
}

/** Kayan pencereli VWAP (hacim ağırlıklı ortalama fiyat). */
export function vwap(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  period = 20,
): Series {
  const out = filled(closes.length);
  const typical = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  for (let i = period - 1; i < closes.length; i++) {
    let pv = 0;
    let v = 0;
    for (let j = i - period + 1; j <= i; j++) {
      pv += typical[j] * volumes[j];
      v += volumes[j];
    }
    out[i] = v === 0 ? closes[i] : pv / v;
  }
  return out;
}

/**
 * Olasılık ve risk matematiği — saf fonksiyonlar, ağdan ve dilden bağımsız.
 *
 * Skor motoru (`analysis.ts`) "hangi yön" sorusuna bakar. Bu modül skoru
 * değiştirmez; yanına şu soruların sayısal cevabını koyar:
 *
 *   • Fiyat bu ufukta ne kadar oynayabilir?   → log getiri oynaklığı, σ√t bantları
 *   • Seri trend mi sürdürüyor, ortalamaya mı dönüyor? → Hurst üssü (R/S)
 *   • Fiyat ortalamasından ne kadar uzakta?   → z-skor
 *   • Hisse endeksle ne kadar birlikte hareket ediyor? → beta, korelasyon, alfa
 *   • Bu skor geçmişte hangi olasılığa denk geldi? → lojistik kalibrasyon
 *   • Sinyalin matematiksel beklentisi pozitif mi? → beklenti, kâr faktörü, Kelly
 *   • Ne büyüklükte pozisyon? → sabit risk (%1) ile pozisyon oranı
 *
 * Neden skora karışmıyor: motorun ağırlıkları iki ayrı dönemde ölçülerek
 * ayarlandı (`scripts/motor-karsilastir.ts`). Burada üretilen büyüklükler aynı
 * sınamadan geçmeden skoru etkilerse o ölçüm geçersiz kalır. Bu yüzden hepsi
 * bilgi olarak sunulur; olasılık ve beklenti ise zaten motorun kendi
 * geçmişinden sayılır.
 *
 * Bilinen sınırlar — gizlenmemeli:
 *   • σ√t bantları getirilerin bağımsız ve normal dağıldığını varsayar.
 *     Gerçek piyasada kuyruklar daha kalındır; %95 bandının dışına çıkış
 *     normal dağılımın söylediğinden sık olur.
 *   • Kalibrasyon örnekleri örtüşür (10 mumluk ufuk, her mumda yeni örnek);
 *     etkin örnek sayısı görünenden azdır. Eğim bu yüzden sıfıra doğru
 *     çekilir (ridge).
 *   • Kelly kesri geçmiş isabet ve kazanç/kayıp oranından hesaplanır;
 *     tahmin hatasına çok duyarlıdır. Yalnızca yarısı gösterilir ve üst
 *     sınırı vardır.
 */

import type { AssetKind, Interval } from "./markets/types";
import { intervalMinutes } from "./markets/types";

/* ────────────────────────── Tipler ────────────────────────── */

export type HurstKey = "quant.hurst.trending" | "quant.hurst.meanReverting" | "quant.hurst.random";

export type ExpectedMove = {
  /** Ufuk boyunca 1σ hareket, yüzde. */
  sigmaPercent: number;
  /** ±1σ (≈ %68) bandı. */
  low1: number;
  high1: number;
  /** ±2σ (≈ %95) bandı. */
  low2: number;
  high2: number;
};

export type MarketRelation = {
  ticker: string;
  /** Endeks %1 oynadığında varlığın beklenen oynaması. */
  beta: number;
  /** −1 … +1. */
  correlation: number;
  /** Endeksle açıklanamayan yıllık getiri, yüzde (risksiz faiz düşülmeden). */
  alphaAnnual: number;
  samples: number;
};

export type Probability = {
  /** Ufuk sonunda fiyatın bugünden yüksek olma olasılığı (0–1). */
  up: number;
  /** Sinyal olmasa da yükselme sıklığı (0–1). */
  baseRate: number;
  /** Skorun olasılığa etkisi: pozitifse yüksek skor geçmişte daha sık yükselişe denk geldi. */
  slope: number;
  samples: number;
};

export type EdgeStats = {
  /** Ölçülen yön: güncel skorun işaretindeki sinyaller. */
  side: "BUY" | "SELL";
  signals: number;
  /** Sinyal yönünde kapanan sinyallerin oranı (ham). */
  winRate: number;
  /** Ortalama kazanç ve kayıp, yüzde (ikisi de pozitif sayı). */
  avgWin: number;
  avgLoss: number;
  /** Ortalama kazanç / ortalama kayıp. */
  payoff: number;
  /** Sinyal başına beklenen getiri, yüzde. */
  expectancy: number;
  /** Toplam kazanç / toplam kayıp. Kayıp yoksa null. */
  profitFactor: number | null;
  /** Tam Kelly kesri (küçük örnek için büzülmüş isabetle). Negatifse avantaj yok. */
  kelly: number;
  /** Önerilen üst sınır: Kelly'nin yarısı, 0 … 0,25 arası. */
  halfKelly: number;
  reliable: boolean;
};

export type QuantStats = {
  /** Olasılık ve bantların ölçüldüğü ufuk, mum sayısı. */
  horizon: number;
  barsPerYear: number;
  /** Mum başına log getiri standart sapması. */
  volPerBar: number;
  /** Yıllıklandırılmış oynaklık, yüzde. */
  volAnnual: number;
  expectedMove: ExpectedMove;
  hurst: number | null;
  hurstKey: HurstKey | null;
  /** (kapanış − SMA20) / σ20. */
  zScore: number | null;
  /** Yıllıklandırılmış Sharpe (risksiz faiz düşülmeden). */
  sharpe: number | null;
  /** Penceredeki en büyük tepeden dibe düşüş, yüzde (negatif). */
  maxDrawdown: number;
  market: MarketRelation | null;
  probability: Probability | null;
  edge: EdgeStats | null;
  /** Sermayenin %1'ini riske etmek için pozisyonun sermayeye oranı, yüzde. */
  positionPercent: number | null;
};

/* ────────────────────────── Temel istatistik ────────────────────────── */

export function logReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > 0 && closes[i - 1] > 0) out.push(Math.log(closes[i] / closes[i - 1]));
  }
  return out;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/** Örneklem standart sapması (n − 1). */
export function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  let sum = 0;
  for (const v of values) sum += (v - m) ** 2;
  return Math.sqrt(sum / (values.length - 1));
}

/**
 * Bir yıldaki mum sayısı.
 *
 * Kripto 7/24 işlem görür (365 gün); hisse, endeks, emtia ve döviz yaklaşık
 * 252 işlem günüdür. Gün içi periyotlarda borsa seansı ~6,5 saat sayılır —
 * bu piyasalarda gün içi periyot şu an sunulmuyor, değer yalnızca tutarlılık
 * için tanımlı.
 */
export function barsPerYear(kind: AssetKind, interval: Interval): number {
  const minutes = intervalMinutes(interval);
  if (kind === "kripto") return (365 * 24 * 60) / minutes;
  if (interval === "1w") return 52;
  if (interval === "1d") return 252;
  return (252 * 6.5 * 60) / minutes;
}

/**
 * Lognormal varsayımla ufuk boyunca beklenen fiyat bantları.
 * P · e^(±z·σ·√h); sürüklenme (drift) yok sayılır — kısa ufukta ihmal edilir
 * ve tahmini en gürültülü büyüklüktür.
 */
export function expectedMove(price: number, volPerBar: number, horizon: number): ExpectedMove {
  const s = volPerBar * Math.sqrt(horizon);
  return {
    sigmaPercent: (Math.exp(s) - 1) * 100,
    low1: price * Math.exp(-s),
    high1: price * Math.exp(s),
    low2: price * Math.exp(-2 * s),
    high2: price * Math.exp(2 * s),
  };
}

/** Kapanışların penceredeki en büyük tepeden dibe düşüşü, yüzde (≤ 0). */
export function maxDrawdown(closes: number[]): number {
  let peak = -Infinity;
  let worst = 0;
  for (const c of closes) {
    if (c > peak) peak = c;
    if (peak > 0) worst = Math.min(worst, (c / peak - 1) * 100);
  }
  return worst;
}

/** Son kapanışın `period` mumluk ortalamaya uzaklığı, standart sapma cinsinden. */
export function zScore(closes: number[], period = 20): number | null {
  if (closes.length < period) return null;
  const window = closes.slice(-period);
  const sd = stdev(window);
  if (sd === 0) return 0;
  return (closes[closes.length - 1] - mean(window)) / sd;
}

/* ────────────────────────── Hurst üssü ────────────────────────── */

/** ln Γ(x), Lanczos yaklaşımı (x > 0). */
function lnGamma(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/**
 * Rastgele yürüyüşte beklenen R/S değeri (Anis–Lloyd, Peters düzeltmesiyle).
 * Ham R/S kısa serilerde H'yi sistematik olarak 0,5'in üstünde gösterir;
 * gözlenen eğimden bu beklenen eğim çıkarılarak yanlılık giderilir.
 */
function expectedRS(n: number): number {
  let sum = 0;
  for (let i = 1; i < n; i++) sum += Math.sqrt((n - i) / i);
  const front =
    n <= 340
      ? Math.exp(lnGamma((n - 1) / 2) - lnGamma(n / 2)) / Math.sqrt(Math.PI)
      : 1 / Math.sqrt((n * Math.PI) / 2);
  return ((n - 0.5) / n) * front * sum;
}

function rescaledRange(chunk: number[]): number | null {
  const m = mean(chunk);
  let cum = 0;
  let max = -Infinity;
  let min = Infinity;
  for (const v of chunk) {
    cum += v - m;
    if (cum > max) max = cum;
    if (cum < min) min = cum;
  }
  const sd = Math.sqrt(chunk.reduce((s, v) => s + (v - m) ** 2, 0) / chunk.length);
  return sd > 0 ? (max - min) / sd : null;
}

function slope(xs: number[], ys: number[]): number {
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

/**
 * Hurst üssü, düzeltilmiş R/S analiziyle.
 *   H > 0,5 → hareketler birbirini izleme eğiliminde (trend sürer)
 *   H < 0,5 → hareketler birbirini tersine çevirme eğiliminde (ortalamaya dönüş)
 *   H ≈ 0,5 → rastgele yürüyüş
 * En az 100 getiri gerekir; daha kısa seride tahmin anlamsız derecede gürültülüdür.
 */
export function hurstExponent(returns: number[]): number | null {
  const data = returns.slice(-512);
  if (data.length < 100) return null;
  const sizes: number[] = [];
  for (let n = 8; n <= data.length / 2; n *= 2) sizes.push(n);
  if (sizes.length < 3) return null;

  const xs: number[] = [];
  const ys: number[] = [];
  const ye: number[] = [];
  for (const n of sizes) {
    const chunks = Math.floor(data.length / n);
    const values: number[] = [];
    for (let c = 0; c < chunks; c++) {
      // Son mumlar her zaman dahil olsun diye parçalar sondan kesilir.
      const end = data.length - c * n;
      const rs = rescaledRange(data.slice(end - n, end));
      if (rs !== null) values.push(rs);
    }
    if (values.length === 0) continue;
    xs.push(Math.log(n));
    ys.push(Math.log(mean(values)));
    ye.push(Math.log(expectedRS(n)));
  }
  if (xs.length < 3) return null;
  const h = 0.5 + slope(xs, ys) - slope(xs, ye);
  return Math.min(1, Math.max(0, h));
}

/**
 * Etiket eşikleri gürültüye göre seçildi: ~300 mumluk rastgele yürüyüşte bu
 * tahminci ortalama 0,47 verir ve 200 denemenin %90'ı 0,38–0,56 arasında
 * kalır. Bu bandın içi "rastgele yürüyüşe yakın" sayılır; 0,45/0,55 gibi dar
 * eşikler rastgele serilerin üçte birine yanlış etiket yapıştırıyordu.
 */
export function hurstKeyOf(h: number | null): HurstKey | null {
  if (h === null) return null;
  if (h >= 0.58) return "quant.hurst.trending";
  if (h <= 0.38) return "quant.hurst.meanReverting";
  return "quant.hurst.random";
}

/* ────────────────────────── Endeksle ilişki ────────────────────────── */

/**
 * Beta, korelasyon ve alfa — hisselerin klasik piyasa modeli:
 *   r_varlık = α + β · r_endeks + ε
 * Endeks serisi varlığın mumlarına hizalanmış olmalıdır (eksik değer null).
 */
export function marketRelation(
  closes: number[],
  benchmark: (number | null)[],
  ticker: string,
  perYear: number,
  window = 250,
): MarketRelation | null {
  const ra: number[] = [];
  const rm: number[] = [];
  const start = Math.max(1, closes.length - window);
  for (let i = start; i < closes.length; i++) {
    const b0 = benchmark[i - 1];
    const b1 = benchmark[i];
    if (b0 === null || b1 === null || b0 <= 0 || b1 <= 0) continue;
    if (closes[i - 1] <= 0 || closes[i] <= 0) continue;
    // Endeks o mumda hiç oynamadıysa (tatil, bayat değer) örnek alınmaz.
    if (b0 === b1) continue;
    ra.push(Math.log(closes[i] / closes[i - 1]));
    rm.push(Math.log(b1 / b0));
  }
  if (ra.length < 30) return null;

  const ma = mean(ra);
  const mm = mean(rm);
  let cov = 0;
  let varM = 0;
  let varA = 0;
  for (let k = 0; k < ra.length; k++) {
    cov += (ra[k] - ma) * (rm[k] - mm);
    varM += (rm[k] - mm) ** 2;
    varA += (ra[k] - ma) ** 2;
  }
  if (varM === 0 || varA === 0) return null;
  const beta = cov / varM;
  return {
    ticker,
    beta,
    correlation: cov / Math.sqrt(varM * varA),
    alphaAnnual: (ma - beta * mm) * perYear * 100,
    samples: ra.length,
  };
}

/* ────────────────────────── Kalibrasyon ────────────────────────── */

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/**
 * Tek değişkenli lojistik regresyon: P(yükseliş | skor) = σ(a + b·x), x = skor/50.
 *
 * Newton–Raphson ile çözülür; eğime ridge cezası (λ) uygulanır. Örnekler
 * örtüştüğü için (ardışık mumların 10 mumluk geleceği büyük ölçüde aynıdır)
 * etkin örnek sayısı görünenden azdır; ceza, az bilgiyle aşırı keskin bir
 * eğri çizilmesini engeller ve sonucu taban orana doğru çeker.
 */
export function calibrate(
  scores: number[],
  forwards: number[],
  current: number,
  lambda = 4,
): Probability | null {
  const n = Math.min(scores.length, forwards.length);
  if (n < 40) return null;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let k = 0; k < n; k++) {
    if (forwards[k] === 0) continue;
    xs.push(scores[k] / 50);
    ys.push(forwards[k] > 0 ? 1 : 0);
  }
  if (xs.length < 40) return null;
  const baseRate = mean(ys);
  if (baseRate === 0 || baseRate === 1) {
    return { up: baseRate, baseRate, slope: 0, samples: xs.length };
  }

  let a = Math.log(baseRate / (1 - baseRate));
  let b = 0;
  for (let iter = 0; iter < 50; iter++) {
    let ga = 0;
    let gb = -lambda * b;
    let haa = 0;
    let hab = 0;
    let hbb = lambda;
    for (let k = 0; k < xs.length; k++) {
      const p = sigmoid(a + b * xs[k]);
      const w = p * (1 - p);
      ga += ys[k] - p;
      gb += (ys[k] - p) * xs[k];
      haa += w;
      hab += w * xs[k];
      hbb += w * xs[k] * xs[k];
    }
    const det = haa * hbb - hab * hab;
    if (det <= 1e-12) break;
    const da = (hbb * ga - hab * gb) / det;
    const db = (haa * gb - hab * ga) / det;
    a += da;
    b += db;
    if (Math.abs(da) < 1e-9 && Math.abs(db) < 1e-9) break;
  }

  return { up: sigmoid(a + (b * current) / 50), baseRate, slope: b, samples: xs.length };
}

/* ────────────────────────── Beklenti ve Kelly ────────────────────────── */

/** Küçük örnek büzmesi: bu kadar "hayali" taban gözlem eklenir (backtest ile aynı). */
const EDGE_SHRINK = 10;
const EDGE_MIN_SIGNALS = 12;
const KELLY_CAP = 0.25;

/**
 * Sinyal yönündeki geçmiş sonuçların beklentisi.
 *
 * `forwards`, sinyal anından ufuk sonuna yüzde getiridir. SELL için işaret
 * çevrilir: düşüş kazanç sayılır.
 *
 * Kelly: f* = p − (1 − p) / R,  R = ortalama kazanç / ortalama kayıp.
 * p küçük örnek için taban orana doğru büzülür; sonuç yarıya indirilip
 * %25'le sınırlanır. Negatif Kelly "bu sinyalin geçmişte avantajı yok" demektir.
 */
export function edgeStats(
  side: "BUY" | "SELL",
  forwards: number[],
  baseRate: number,
): EdgeStats | null {
  const results = forwards.map((f) => (side === "BUY" ? f : -f));
  if (results.length === 0) return null;
  const wins = results.filter((r) => r > 0);
  const losses = results.filter((r) => r < 0).map((r) => -r);
  const winRate = wins.length / results.length;
  const avgWin = mean(wins);
  const avgLoss = mean(losses);
  const sumWin = wins.reduce((s, v) => s + v, 0);
  const sumLoss = losses.reduce((s, v) => s + v, 0);
  const payoff = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;

  const p = (wins.length + EDGE_SHRINK * baseRate) / (results.length + EDGE_SHRINK);
  const kelly = !Number.isFinite(payoff) ? p : payoff > 0 ? p - (1 - p) / payoff : -1;

  return {
    side,
    signals: results.length,
    winRate,
    avgWin,
    avgLoss,
    payoff: Number.isFinite(payoff) ? payoff : 0,
    expectancy: winRate * avgWin - (1 - winRate) * avgLoss,
    profitFactor: sumLoss > 0 ? sumWin / sumLoss : null,
    kelly,
    halfKelly: Math.min(KELLY_CAP, Math.max(0, kelly / 2)),
    reliable: results.length >= EDGE_MIN_SIGNALS,
  };
}

/** Sermayenin `risk` yüzdesini riske eden pozisyonun sermayeye oranı, yüzde (≤ 100). */
export function positionPercent(stopDistancePercent: number, risk = 1): number | null {
  if (!(stopDistancePercent > 0)) return null;
  return Math.min(100, (risk / stopDistancePercent) * 100);
}

/* ────────────────────────── Birleştirme ────────────────────────── */

export type QuantInput = {
  kind: AssetKind;
  interval: Interval;
  closes: number[];
  horizon: number;
  /** Güncel skor (−100 … +100). */
  score: number;
  /** İşlem planındaki zarar durdur uzaklığı, yüzde. */
  stopDistancePercent: number;
  benchmark?: { ticker: string; closes: (number | null)[] } | null;
  /** Geçmiş sınamasının ham örnekleri; yoksa olasılık ve beklenti hesaplanmaz. */
  history?: { scores: number[]; forwards: number[]; threshold: number } | null;
};

export function quantStats(input: QuantInput): QuantStats {
  const { closes, horizon, score } = input;
  const perYear = barsPerYear(input.kind, input.interval);
  const returns = logReturns(closes);
  const recent = returns.slice(-250);
  const volPerBar = stdev(recent);
  const price = closes[closes.length - 1];
  const hurst = hurstExponent(returns);
  const sd = volPerBar;

  let probability: Probability | null = null;
  let edge: EdgeStats | null = null;
  const history = input.history;
  if (history) {
    probability = calibrate(history.scores, history.forwards, score);
    const side: "BUY" | "SELL" = score >= 0 ? "BUY" : "SELL";
    const picked: number[] = [];
    let ups = 0;
    let downs = 0;
    for (let k = 0; k < history.scores.length; k++) {
      const f = history.forwards[k];
      if (f > 0) ups++;
      else if (f < 0) downs++;
      const s = history.scores[k];
      if (side === "BUY" ? s >= history.threshold : s <= -history.threshold) picked.push(f);
    }
    const total = history.scores.length || 1;
    edge = edgeStats(side, picked, side === "BUY" ? ups / total : downs / total);
  }

  return {
    horizon,
    barsPerYear: perYear,
    volPerBar,
    volAnnual: volPerBar * Math.sqrt(perYear) * 100,
    expectedMove: expectedMove(price, volPerBar, horizon),
    hurst,
    hurstKey: hurstKeyOf(hurst),
    zScore: zScore(closes),
    sharpe: sd > 0 && recent.length >= 30 ? (mean(recent) / sd) * Math.sqrt(perYear) : null,
    maxDrawdown: maxDrawdown(closes),
    market: input.benchmark
      ? marketRelation(closes, input.benchmark.closes, input.benchmark.ticker, perYear)
      : null,
    probability,
    edge,
    positionPercent: positionPercent(input.stopDistancePercent),
  };
}

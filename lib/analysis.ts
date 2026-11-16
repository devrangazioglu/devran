/**
 * Sinyal motoru — piyasa ve dilden bağımsız.
 *
 * Girdi yalnızca mum dizisidir; kripto, hisse, endeks, emtia ve döviz için
 * aynı şekilde çalışır. Çıktıdaki metinler doğrudan cümle değil, çeviri
 * anahtarı + parametre olarak üretilir; böylece her dile çevrilebilir.
 *
 * ── Neden "ikinci nesil" ─────────────────────────────────────────────
 *
 * İlk motor on altı göstergenin düz ağırlıklı ortalamasını alıyordu ve iki
 * yapısal kusuru vardı:
 *
 *   1. Trend takipçileri (EMA, Supertrend, ADX) ile osilatörler (RSI,
 *      Stokastik, Williams, Bollinger) **piyasa durumuna bakılmadan** birlikte
 *      oylanıyordu. Güçlü bir düşüş trendinde osilatörler "aşırı satım" deyip
 *      AL oyu verdiği için skor sıfıra sönüyor ve tam trendin en net olduğu
 *      anda BEKLE çıkıyordu (ölçülen örnek: ADX 35, on gösterge SAT, skor
 *      −12,8). Tersi de oluyordu: güçlü yükselişte "aşırı alım" SAT oyu.
 *   2. Eşikler sabit yüzdeydi (ör. EMA farkı %1,2). Aynı fark dövizde dev,
 *      kriptoda önemsizdir; sinyalin anlamı varlıktan varlığa değişiyordu.
 *      Ayrıca RSI 69,9 → +0,48, RSI 70,0 → −0,85 gibi sıçramalar vardı: tek
 *      kuruşluk fiyat hareketi sinyali ters çevirebiliyordu.
 *
 * Bu sürümde:
 *   • Önce **rejim** ölçülür (trend mi, yatay mı; yönü ne). Osilatörler buna
 *     göre okunur: yatay piyasada uç değer dönüş sinyalidir; trendde ise trend
 *     yönündeki uç değer güç işaretidir, karşı yöndeki uç değer (yükselişte
 *     aşırı satım) trende katılma fırsatıdır.
 *   • Bütün uzaklıklar **ATR ile** ölçülür; sinyal oynaklıktan bağımsızdır.
 *   • Eşik sıçramaları kaldırıldı; her yön fonksiyonu süreklidir.
 *   • Gösterge olmayan yöntemler eklendi: fiyat yapısı (tepe/dip dizilimi),
 *     kanal kırılımı, üst periyot uyumu, endekse göre göreli güç.
 *   • Sinyal **kendi geçmişinde sınanır**: aynı motor geçmiş mumlarda
 *     çalıştırılır ve "bu varlıkta bu sinyal kaç kez tuttu" ölçülür. Güven
 *     yüzdesi bu ölçümü de içerir; tahmin değil sayımdır.
 *
 * Not: Üretilen çıktı yatırım tavsiyesi değildir; kural tabanlı bir teknik
 * analiz özetidir. Hiçbir yöntem kesin sonuç vermez — geçmiş sınaması bunun
 * ne kadar belirsiz olduğunu gizlemek yerine gösterir.
 */

import type { Candle, DataSource, Instrument, Interval } from "./markets/types";
import {
  adx,
  atr,
  bollinger,
  cci,
  ema,
  macd,
  mfi,
  obv,
  roc,
  rsi,
  sma,
  stochastic,
  supertrend,
  vwap,
  williamsR,
  type AdxResult,
  type BollingerResult,
  type MacdResult,
  type Series,
  type StochasticResult,
  type SupertrendResult,
} from "./indicators";

export type Verdict = "BUY" | "SELL" | "NEUTRAL";
export type SignalLabel = "STRONG_BUY" | "BUY" | "WAIT" | "SELL" | "STRONG_SELL";
export type Category = "trend" | "structure" | "momentum" | "volatility" | "volume";

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
  /**
   * Sayılar ham verilir; biçimlendirme (ondalık ayırıcı, basamak) gösterilen
   * dile göre arayüzde yapılır. Önceden biçimlenmiş metin vermek, Türkçe
   * arayüzde "27.5" gibi noktalı sayılar çıkarıyordu.
   */
  noteParams?: Record<string, string | number | ValuePart>;
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

/** Piyasanın o anki durumu: göstergelerin nasıl okunacağını bu belirler. */
export type Regime = {
  /** 0 = tümüyle yatay, 1 = güçlü trend. */
  trendiness: number;
  /** −1 (aşağı) … +1 (yukarı). */
  direction: number;
  key: "regime.up" | "regime.down" | "regime.range" | "regime.transition";
};

/** Geçmiş sınamasında bir yönün (alış ya da satış) sonucu. */
export type BacktestSide = {
  /** Bu yönde sinyal verilen mum sayısı. */
  signals: number;
  /** Sinyalden `horizon` mum sonra fiyatın sinyal yönünde olduğu oran (0–1). */
  hitRate: number;
  /**
   * Sinyalden bağımsız taban oran: rastgele bir mumdan sonra fiyatın aynı
   * yöne gitme sıklığı. Yükselen bir piyasada her alış "tutar"; isabetin
   * anlamı ancak bu oranla kıyaslanınca ortaya çıkar.
   */
  baseRate: number;
  /** Taban orana göre üstünlük (0–1 ölçeğinde fark), küçük örnek için büzülmüş. */
  edge: number;
  /** Sinyal yönünde ortalama getiri, yüzde. */
  avgReturn: number;
  /** Örnek sayısı sonuç çıkarmaya yetiyor mu? */
  reliable: boolean;
};

export type Backtest = {
  /** Sonucun ölçüldüğü ufuk, mum sayısı. */
  horizon: number;
  /** Sınanan toplam mum sayısı. */
  samples: number;
  buy: BacktestSide | null;
  sell: BacktestSide | null;
};

export type ProfileKey = "profile.trend" | "profile.crypto" | "profile.equity" | "profile.equityWeekly";

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
  regime: Regime;
  /** Göstergelerin hangi varsayımla okunduğu (varlık sınıfına göre). */
  profileKey: ProfileKey;
  /** Veri yetmediğinde null. */
  backtest: Backtest | null;
};

/** Analize dışarıdan verilen bağlam; hepsi isteğe bağlı. */
export type AnalysisContext = {
  /** Karşılaştırma endeksinin aynı periyottaki mumları (göreli güç için). */
  benchmark?: { ticker: string; candles: Candle[] } | null;
  /**
   * Bir üst zaman dilimindeki rejim. Verilmezse eldeki mumlar birleştirilerek
   * hesaplanır (olağan yol); `null` verilirse üst periyot hiç kullanılmaz.
   */
  higher?: { interval: Interval; direction: number; trendiness: number } | null;
  /** Geçmiş sınaması yapılsın mı (varsayılan: evet). */
  backtest?: boolean;
};

/* ────────────────────────── Yardımcılar ────────────────────────── */

/** Bu eşiklerin altında/üstünde sinyal AL ya da SAT sayılır. */
const SIGNAL_THRESHOLD = 18;
const STRONG_THRESHOLD = 45;

function verdictOf(direction: number): Verdict {
  if (direction >= 0.15) return "BUY";
  if (direction <= -0.15) return "SELL";
  return "NEUTRAL";
}

function clamp(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Dizinin `i` konumundaki geçerli değeri (yoksa null). */
function at(series: Series, i: number): number | null {
  const v = series[i];
  return v === null || v === undefined || !Number.isFinite(v) ? null : v;
}

export function signalFromScore(score: number): SignalLabel {
  if (score >= STRONG_THRESHOLD) return "STRONG_BUY";
  if (score >= SIGNAL_THRESHOLD) return "BUY";
  if (score <= -STRONG_THRESHOLD) return "STRONG_SELL";
  if (score <= -SIGNAL_THRESHOLD) return "SELL";
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

/* ────────────────────────── Varlık sınıfı profili ────────────────────────── */

/**
 * Göstergelerin ağırlığı ve okunuşu varlık sınıfına göre değişir.
 *
 * Bu bir tercih değil ölçüm sonucu (`scripts/motor-karsilastir.ts`, 36 varlık,
 * 26.860 günlük mum, 2023–2026). Her göstergenin oyundan sonraki 10 mumluk
 * getiri oynaklık birimiyle (σ) ölçüldü ve dönem ikiye bölünerek (`BOLME=ilk`,
 * `BOLME=son`) etkinin iki yarıda da aynı yönde çıkıp çıkmadığına bakıldı.
 * Yalnızca iki yarıda da görünen etkilere göre ayar yapıldı:
 *
 *                              ilk yarı    ikinci yarı
 *   emtia/döviz  trend yönü     +0,25σ       +0,64σ     tutarlı → trend takibi
 *                fiyat yapısı   +0,19σ       +0,51σ
 *   kripto       EMA 9/21       +0,14σ       +0,27σ     tutarlı → kısa trend
 *                EMA 50/200     −0,11σ       −0,43σ     tutarlı ters
 *   hisse        RSI            +0,03σ       +0,15σ     aynı yön, zayıf
 *                ortalamadan    +0,01σ       +0,20σ
 *                uzaklaşma
 *                trend yönü     +0,05σ       −0,19σ     TUTARSIZ
 *                EMA 50/200     −0,01σ       −0,21σ
 *
 * Okuması: emtia, döviz ve kriptoda başlamış hareket sürüyor (vadeli ve
 * dövizde bilinen "zaman serisi momentumu", Moskowitz–Ooi–Pedersen 2012).
 * Hisselerde ise trend göstergeleri bir dönemde işe yarayıp diğerinde ters
 * çalıştı; iki dönemde de aynı yönde kalan tek grup, fiyatın ortalamasına
 * döneceğini varsayan göstergeler oldu (hisselerde bilinen "kısa vadeli geri
 * dönüş", Jegadeesh 1990). Hisse profili bu yüzden trend göstergelerine az,
 * uç değer göstergelerine çok ağırlık verir.
 *
 * Aynı sınama bir adayı da eledi: altı aylık momentum göstergesi bütün örnekte
 * olumlu görünüyordu, ama kriptoda iki yarıda da ters, emtiada yarı yarıya
 * çıktı. Motora eklenmedi.
 *
 * Ölçümün sınırları — bilinerek kullanılmalı:
 *   • Bu ayarla bile hisselerde yön tahmini yazı turadan belirgin iyi değil
 *     (10 mumda taban orana göre −0,7 … +1,4 puan). Kazanım, yanlış yönde
 *     ısrar etmemek: önceki ağırlıklarla ikinci yarıda −3 … −5 puandı.
 *   • Örnek iki borsanın da yükseldiği bir dönem; satış sinyallerinin ayı
 *     piyasasındaki davranışı ölçülemedi.
 *   • Hisseler bugünün büyük şirketleri: batanlar örnekte yok (hayatta kalma
 *     yanlılığı). "Düşen hisse toparlanır" sonucu bu yüzden olduğundan iyimser.
 *   • Ardışık mumlar bağımsız değil; farkların çoğu bir-iki standart hata.
 */
type Profile = {
  /** Trend takip göstergelerinin ağırlık çarpanı. */
  trend: number;
  /** Osilatörlerin ağırlık çarpanı. */
  oscillator: number;
  /**
   * Trendin osilatör okumasını ne kadar bastırdığı (0–1). 1: güçlü trendde
   * uç değer dönüş sinyali sayılmaz; 0: her zaman dönüş sinyalidir.
   */
  trendOverride: number;
  /** Kanal kırılımının ağırlık çarpanı. */
  breakout: number;
  /** "Ortalamadan aşırı uzaklaşma" göstergesinin ağırlığı (ters işlem). */
  extension: number;
  /**
   * Uzun vadeli trend ölçülerinin (EMA 50/200, fiyat–EMA 200, üst periyot)
   * ek çarpanı; `trend` çarpanının üstüne gelir.
   */
  longTrend: number;
};

/** Emtia, döviz, kripto: hareket sürer. */
const TREND_PROFILE: Profile = {
  trend: 1,
  oscillator: 1,
  trendOverride: 1,
  breakout: 1,
  extension: 0,
  longTrend: 1,
};

/**
 * Kripto: kısa vadeli trend sürüyor, uzun vadeli trend ölçüleri ise iki
 * dönemde de ters çalıştı (EMA 50/200 −0,11σ ve −0,43σ; üst periyot −0,15σ
 * ve −0,39σ). Örnek küçük — dört varlık ve hepsi birlikte hareket ediyor —
 * bu yüzden bu ölçüler kapatılmaz, yalnızca ağırlıkları azaltılır.
 */
const CRYPTO_PROFILE: Profile = { ...TREND_PROFILE, longTrend: 0.4 };

/** Hisse ve hisse endeksleri: kısa vadede ortalamaya döner. */
const EQUITY_PROFILE: Profile = {
  trend: 0.35,
  oscillator: 1.4,
  trendOverride: 0.25,
  breakout: 0.25,
  extension: 1.3,
  longTrend: 1,
};

function blend(a: Profile, b: Profile, t: number): Profile {
  const mix = (x: number, y: number) => x + (y - x) * t;
  return {
    trend: mix(a.trend, b.trend),
    oscillator: mix(a.oscillator, b.oscillator),
    trendOverride: mix(a.trendOverride, b.trendOverride),
    breakout: mix(a.breakout, b.breakout),
    extension: mix(a.extension, b.extension),
    longTrend: mix(a.longTrend, b.longTrend),
  };
}

/**
 * Enstrüman ve periyoda göre profil.
 *
 * Hisselerdeki geri dönüş etkisi bir aya kadar olan vadelerde ölçülmüş bir
 * etkidir; haftalık mumlarda on mumluk ufuk iki buçuk aya denk gelir ve orada
 * ne geri dönüş ne momentum baskındır. Haftalıkta bu yüzden iki profilin
 * ortası kullanılır — ölçülmemiş bir vadede taraf tutmamak için.
 */
function profileKeyFor(instrument: Instrument, interval: Interval): ProfileKey {
  const equity = instrument.kind === "hisse" || instrument.kind === "endeks";
  if (!equity) return instrument.kind === "kripto" ? "profile.crypto" : "profile.trend";
  return interval === "1w" ? "profile.equityWeekly" : "profile.equity";
}

const PROFILES: Record<ProfileKey, Profile> = {
  "profile.trend": TREND_PROFILE,
  "profile.crypto": CRYPTO_PROFILE,
  "profile.equity": EQUITY_PROFILE,
  "profile.equityWeekly": blend(TREND_PROFILE, EQUITY_PROFILE, 0.5),
};

function profileFor(instrument: Instrument, interval: Interval): Profile {
  return PROFILES[profileKeyFor(instrument, interval)];
}

/* ────────────────────────── Hazırlık ────────────────────────── */

type Pivot = { index: number; price: number };

/**
 * Bütün seriler bir kez hesaplanır.
 *
 * Göstergelerin hepsi nedenseldir (i. değer yalnızca ≤ i mumlara bakar), bu
 * yüzden geçmiş sınaması aynı serileri eski bir konumda okuyarak yapılabilir:
 * her mum için baştan hesaplamak gerekmez ve geleceğe bakma hatası oluşmaz.
 */
type Prepared = {
  candles: Candle[];
  closes: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
  ema9: Series;
  ema21: Series;
  ema50: Series;
  ema200: Series;
  sma20: Series;
  rsi: Series;
  macd: MacdResult;
  bb: BollingerResult;
  stoch: StochasticResult;
  atr: Series;
  adx: AdxResult;
  cci: Series;
  willr: Series;
  mfi: Series;
  obv: Series;
  vwap: Series;
  st: SupertrendResult;
  roc: Series;
  pivotHighs: Pivot[];
  pivotLows: Pivot[];
  /** Karşılaştırma endeksinin, her muma hizalanmış kapanışı. */
  benchmark: (number | null)[] | null;
  benchmarkTicker: string | null;
  /** Hacim verisi var mı? (Döviz kurlarında yoktur.) */
  hasVolume: boolean;
  profile: Profile;
  /** Üst zaman dilimi tanımı; en üst periyotta null. */
  higher: HigherSpec | null;
  /** Dışarıdan verilmiş üst periyot rejimi (yalnızca son mum için geçerli). */
  higherOverride: AnalysisContext["higher"];
};

/** Bir tepe/dip, iki yanındaki bu kadar mumdan uçtaysa pivot sayılır. */
const PIVOT_SPAN = 3;

function findPivots(highs: number[], lows: number[]): { pivotHighs: Pivot[]; pivotLows: Pivot[] } {
  const pivotHighs: Pivot[] = [];
  const pivotLows: Pivot[] = [];
  for (let i = PIVOT_SPAN; i < highs.length - PIVOT_SPAN; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - PIVOT_SPAN; j <= i + PIVOT_SPAN; j++) {
      if (j === i) continue;
      if (highs[j] >= highs[i]) isHigh = false;
      if (lows[j] <= lows[i]) isLow = false;
    }
    if (isHigh) pivotHighs.push({ index: i, price: highs[i] });
    if (isLow) pivotLows.push({ index: i, price: lows[i] });
  }
  return { pivotHighs, pivotLows };
}

function prepare(
  candles: Candle[],
  context: AnalysisContext,
  profile: Profile,
  interval: Interval,
): Prepared {
  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const volumes = candles.map((c) => c.volume);

  const { pivotHighs, pivotLows } = findPivots(highs, lows);

  return {
    candles,
    closes,
    highs,
    lows,
    volumes,
    ema9: ema(closes, 9),
    ema21: ema(closes, 21),
    ema50: ema(closes, 50),
    ema200: ema(closes, 200),
    sma20: sma(closes, 20),
    rsi: rsi(closes, 14),
    macd: macd(closes),
    bb: bollinger(closes, 20, 2),
    stoch: stochastic(highs, lows, closes),
    atr: atr(highs, lows, closes, 14),
    adx: adx(highs, lows, closes, 14),
    cci: cci(highs, lows, closes, 20),
    willr: williamsR(highs, lows, closes, 14),
    mfi: mfi(highs, lows, closes, volumes, 14),
    obv: obv(closes, volumes),
    vwap: vwap(highs, lows, closes, volumes, 20),
    st: supertrend(highs, lows, closes, 10, 3),
    roc: roc(closes, 10),
    pivotHighs,
    pivotLows,
    benchmark: context.benchmark ? alignBenchmark(candles, context.benchmark.candles) : null,
    benchmarkTicker: context.benchmark?.ticker ?? null,
    hasVolume: volumes.slice(-40).some((v) => v > 0),
    profile,
    higher: HIGHER_TIMEFRAME[interval] ?? null,
    higherOverride: context.higher,
  };
}

/**
 * Endeks kapanışlarını varlığın mumlarına hizalar.
 *
 * İki serinin takvimi birebir aynı olmayabilir (tatil, eksik gün); her mum
 * için o ana kadarki son endeks kapanışı alınır. Aradaki boşluk bir haftayı
 * aşıyorsa değer kullanılmaz: bayat bir endeksle kıyas, kıyas değildir.
 */
function alignBenchmark(candles: Candle[], benchmark: Candle[]): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  if (benchmark.length === 0) return out;
  const maxGap = 7 * 86_400_000;
  let j = 0;
  for (let i = 0; i < candles.length; i++) {
    const time = candles[i].openTime;
    while (j + 1 < benchmark.length && benchmark[j + 1].openTime <= time) j++;
    const candidate = benchmark[j];
    if (candidate.openTime <= time && time - candidate.openTime <= maxGap) {
      out[i] = candidate.close;
    }
  }
  return out;
}

/* ────────────────────────── Fiyat yapısı ve rejim ────────────────────────── */

type Structure = {
  /** −1 (alçalan tepe/dip) … +1 (yükselen tepe/dip). */
  direction: number;
  higherHigh: boolean;
  higherLow: boolean;
};

/** `i` anında kesinleşmiş son iki pivotu döndürür (eskiden yeniye). */
function lastTwoPivots(pivots: Pivot[], i: number): [Pivot, Pivot] | null {
  // Bir pivot ancak sağındaki PIVOT_SPAN mum kapandıktan sonra bilinir.
  const known = i - PIVOT_SPAN;
  let newer: Pivot | null = null;
  for (let k = pivots.length - 1; k >= 0; k--) {
    if (pivots[k].index > known) continue;
    if (!newer) newer = pivots[k];
    else return [pivots[k], newer];
  }
  return null;
}

/**
 * Tepe ve diplerin dizilimi (Dow kuramının özü): yükselen tepe + yükselen dip
 * yükseliş, alçalan tepe + alçalan dip düşüş yapısıdır. Hiçbir ortalamaya ya
 * da osilatöre dayanmaz; doğrudan fiyatın kendisini okur.
 */
function structureAt(
  p: Pick<Prepared, "pivotHighs" | "pivotLows" | "closes">,
  i: number,
  atrValue: number,
): Structure | null {
  const highs = lastTwoPivots(p.pivotHighs, i);
  const lows = lastTwoPivots(p.pivotLows, i);
  if (!highs || !lows || atrValue <= 0) return null;

  const dHigh = (highs[1].price - highs[0].price) / atrValue;
  const dLow = (lows[1].price - lows[0].price) / atrValue;
  let direction = 0.5 * clamp(dHigh / 1.5) + 0.5 * clamp(dLow / 1.5);

  // Fiyat son tepeyi/dibi şimdiden aştıysa yapı o yönde güçleniyor demektir.
  const close = p.closes[i];
  if (close > highs[1].price) direction += 0.2;
  else if (close < lows[1].price) direction -= 0.2;

  return { direction: clamp(direction), higherHigh: dHigh > 0, higherLow: dLow > 0 };
}

/** Kaufman verimlilik oranı: net yol / kat edilen yol (0 = testere, 1 = düz çizgi). */
function efficiencyRatio(closes: number[], i: number, period: number): number | null {
  if (i < period) return null;
  let path = 0;
  for (let k = i - period + 1; k <= i; k++) path += Math.abs(closes[k] - closes[k - 1]);
  if (path === 0) return 0;
  return Math.abs(closes[i] - closes[i - period]) / path;
}

function regimeAt(
  p: Pick<Prepared, "closes" | "adx" | "ema21" | "ema50">,
  i: number,
  atrValue: number,
  structure: Structure | null,
): Regime {
  const close = p.closes[i];

  // ── Trend var mı? ADX ile verimlilik oranı birbirini tamamlar: ADX geç
  // tepki verir ama kararlıdır, verimlilik oranı hızlıdır ama gürültülüdür.
  const adxValue = at(p.adx.adx, i);
  const er = efficiencyRatio(p.closes, i, 20);
  const fromAdx = adxValue === null ? null : clamp01((adxValue - 15) / 20);
  const fromEr = er === null ? null : clamp01((er - 0.12) / 0.33);
  const trendiness =
    fromAdx !== null && fromEr !== null
      ? 0.6 * fromAdx + 0.4 * fromEr
      : (fromAdx ?? fromEr ?? 0.5);

  // ── Hangi yöne? Dört bağımsız okumanın ağırlıklı ortalaması.
  const parts: [number, number][] = [];
  const e21 = at(p.ema21, i);
  const e50 = at(p.ema50, i);
  if (e21 !== null && e50 !== null) {
    parts.push([clamp((e21 - e50) / (1.5 * atrValue)), 0.3]);
    parts.push([clamp((close - e50) / (2.5 * atrValue)), 0.25]);
  }
  const plus = at(p.adx.plusDI, i);
  const minus = at(p.adx.minusDI, i);
  if (plus !== null && minus !== null) parts.push([clamp((plus - minus) / 20), 0.2]);
  if (structure) parts.push([structure.direction, 0.25]);

  const weight = parts.reduce((sum, [, w]) => sum + w, 0);
  const direction = weight === 0 ? 0 : parts.reduce((sum, [v, w]) => sum + v * w, 0) / weight;

  let key: Regime["key"];
  if (trendiness >= 0.5 && Math.abs(direction) >= 0.25) {
    key = direction > 0 ? "regime.up" : "regime.down";
  } else if (trendiness <= 0.3) {
    key = "regime.range";
  } else {
    key = "regime.transition";
  }

  return { trendiness, direction, key };
}

/* ────────────────────────── Üst zaman dilimi ────────────────────────── */

type HigherSpec = { interval: Interval; factor: number };

/**
 * Her periyodun bir üstü ve onu elde etmek için birleştirilecek mum sayısı.
 *
 * Üst periyot ayrı bir veri isteğiyle değil, eldeki mumlar birleştirilerek
 * hesaplanır. Üç nedeni var:
 *   • Tutarlılık: tarayıcı, detay sayfası ve periyot özetleri aynı mumlardan
 *     aynı skoru üretir. Ayrı istekle yapıldığında tarayıcı (istek sayısını
 *     ikiye katlamamak için) üst periyodu atlıyor ve iki ekranda farklı skor
 *     çıkıyordu.
 *   • Geçmiş sınaması: üst periyot her geçmiş mum için o güne kadarki veriyle
 *     yeniden kurulabilir; sınanan motor canlıdakiyle aynı olur.
 *   • Kota: ücretsiz veri kaynağı dakikada ~20 isteğe izin veriyor.
 * Bedeli: birleştirilen mumlar takvime değil son muma hizalıdır (beş günlük
 * mum her zaman pazartesi–cuma haftası değildir). Trend yönü ve gücü gibi
 * yavaş değişen büyüklükler için fark önemsizdir.
 */
const HIGHER_TIMEFRAME: Partial<Record<Interval, HigherSpec>> = {
  "1m": { interval: "5m", factor: 5 },
  "5m": { interval: "30m", factor: 6 },
  "15m": { interval: "1h", factor: 4 },
  "30m": { interval: "4h", factor: 8 },
  "1h": { interval: "4h", factor: 4 },
  "4h": { interval: "1d", factor: 6 },
  "1d": { interval: "1w", factor: 5 },
};

/** Rejim okumak için gereken en az birleştirilmiş mum (ADX 14 için 2×14 + pay). */
const HIGHER_MIN_BARS = 36;

/** `i` anında, yalnızca ≤ i mumlardan kurulan üst periyot rejimi. */
function higherAt(p: Prepared, i: number): NonNullable<AnalysisContext["higher"]> | null {
  const spec = p.higher;
  if (!spec) return null;
  const count = Math.floor((i + 1) / spec.factor);
  if (count < HIGHER_MIN_BARS) return null;

  const highs: number[] = new Array(count);
  const lows: number[] = new Array(count);
  const closes: number[] = new Array(count);
  // Gruplar sondan başa kurulur: son grup her zaman `i` mumunda biter.
  for (let g = count - 1, end = i; g >= 0; g--, end -= spec.factor) {
    let high = -Infinity;
    let low = Infinity;
    for (let k = end - spec.factor + 1; k <= end; k++) {
      if (p.highs[k] > high) high = p.highs[k];
      if (p.lows[k] < low) low = p.lows[k];
    }
    highs[g] = high;
    lows[g] = low;
    closes[g] = p.closes[end];
  }

  const last = count - 1;
  const atrValue = at(atr(highs, lows, closes, 14), last) ?? closes[last] * 0.02;
  const mini = {
    closes,
    adx: adx(highs, lows, closes, 14),
    ema21: ema(closes, 21),
    ema50: ema(closes, 50),
    ...findPivots(highs, lows),
  };
  const regime = regimeAt(mini, last, atrValue, structureAt(mini, last, atrValue));
  return { interval: spec.interval, direction: regime.direction, trendiness: regime.trendiness };
}

/* ────────────────────────── Osilatör okuması ────────────────────────── */

/**
 * Bir osilatörü rejime göre yöne çevirir.
 *
 * `lo`/`hi` aşırı satım/alım eşikleridir. İki okuma hesaplanır:
 *   • dönüş okuması — uçlara yaklaştıkça karşı yöne oy (yatay piyasanın mantığı)
 *   • momentum okuması — orta çizginin üstü alıcı, altı satıcı
 *
 * Dönüş okuması trendle aynı yöndeyse (yükselişte aşırı satım = geri çekilme)
 * olduğu gibi kullanılır: trende katılmak için en iyi andır. Trende karşıysa
 * (yükselişte aşırı alım) trendin gücü ölçüsünde momentum okumasına kayar;
 * güçlü bir trendde aşırı alım satış sinyali değil, güç işaretidir.
 *
 * Fonksiyon süreklidir: eşiklerde sıçrama yoktur.
 */
function readOscillator(
  value: number,
  lo: number,
  hi: number,
  regime: Regime,
  conviction: number,
): { direction: number; noteKey: string } {
  const mid = (lo + hi) / 2;
  const half = (hi - lo) / 2;
  const position = (value - mid) / half; // −1 = alt eşik, +1 = üst eşik

  const raw = clamp(-position);
  const reversion = Math.sign(raw) * Math.pow(Math.abs(raw), 1.6) * 0.9;
  const momentum = clamp(position) * 0.6;

  const aligned = reversion * regime.direction >= 0;
  const direction = aligned
    ? reversion
    : (1 - conviction) * reversion + 0.5 * conviction * momentum;

  const verdict = verdictOf(direction);
  const up = regime.direction > 0;
  let noteKey: string;
  if (position <= -1) {
    noteKey =
      up && conviction >= 0.35
        ? "note.osc.pullbackUp"
        : !up && conviction >= 0.5
          ? "note.osc.weakDown"
          : "note.osc.oversoldRange";
  } else if (position >= 1) {
    noteKey =
      !up && conviction >= 0.35
        ? "note.osc.rallyDown"
        : up && conviction >= 0.5
          ? "note.osc.strongUp"
          : "note.osc.overboughtRange";
  } else if (verdict === "BUY") {
    noteKey = position > 0 ? "note.osc.bull" : "note.osc.dipBuy";
  } else if (verdict === "SELL") {
    noteKey = position < 0 ? "note.osc.bear" : "note.osc.topSell";
  } else {
    noteKey = "note.osc.neutral";
  }

  return { direction: clamp(direction), noteKey };
}

/* ────────────────────────── Değerlendirme ────────────────────────── */

type Evaluation = {
  checks: IndicatorCheck[];
  score: number;
  regime: Regime;
  /** Skorla aynı yönde oy veren göstergelerin ağırlık payı (0–1). */
  agreement: number;
  /** Kullanılan üst periyot rejimi; yoksa null. */
  higher: AnalysisContext["higher"];
};

/** Son 20 mumun (bu mum hariç) ortalama hacmine oran. */
function volumeRatioAt(volumes: number[], i: number): number | null {
  if (i < 20) return null;
  let sum = 0;
  for (let k = i - 20; k < i; k++) sum += volumes[k];
  const average = sum / 20;
  if (average === 0) return null;
  return volumes[i] / average;
}

/**
 * Motorun çekirdeği: `i` mumunun kapanışında, yalnızca o ana kadarki veriyle
 * göstergeleri okur ve skoru üretir. Hem canlı analiz hem geçmiş sınaması bu
 * fonksiyonu çağırır; ikisinin farklı mantık kullanması, sınamayı anlamsız
 * kılardı.
 */
function evaluate(p: Prepared, i: number): Evaluation {
  const close = p.closes[i];
  const previousClose = p.closes[i - 1] ?? close;
  const atrValue = at(p.atr, i) ?? close * 0.02;
  const atrPercent = (atrValue / close) * 100;

  const structure = structureAt(p, i, atrValue);
  const regime = regimeAt(p, i, atrValue, structure);
  const t = regime.trendiness;
  const profile = p.profile;
  // Dışarıdan verilen üst periyot yalnızca son mum için geçerlidir; geçmiş
  // mumlarda (sınama) her zaman o güne kadarki veriden kurulur.
  const higher =
    i === p.closes.length - 1 && p.higherOverride !== undefined
      ? p.higherOverride
      : higherAt(p, i);
  // Trendin hem varlığına hem yönünün netliğine bağlı tek sayı; profil, trendin
  // osilatör okumasını ne kadar bastıracağını belirler.
  const conviction = t * clamp01(Math.abs(regime.direction) / 0.4) * profile.trendOverride;

  // Rejime göre ağırlık: trendde trend takipçileri, yatayda osilatörler öne
  // alınır; varlık sınıfı profili bunun üstüne çarpan olarak gelir.
  const trendWeight = (base: number) => base * (0.55 + 0.9 * t) * profile.trend;
  const oscWeight = (base: number) => base * (1.3 - 0.6 * t) * profile.oscillator;
  const momentumWeight = (base: number) => base * (0.8 + 0.4 * t) * profile.trend;
  // Fiyat yapısı, üst periyot ve göreli güç de "hareket sürer" varsayımına
  // dayanır; trend göstergeleriyle aynı çarpanı alırlar.
  const structureWeight = (base: number) => base * profile.trend;

  const checks: IndicatorCheck[] = [];
  const push = (check: Omit<IndicatorCheck, "verdict">) =>
    checks.push({ ...check, verdict: verdictOf(check.direction) });

  // ── Trend ────────────────────────────────────────────────────
  const ema9 = at(p.ema9, i);
  const ema21 = at(p.ema21, i);
  const ema50 = at(p.ema50, i);
  const ema200 = at(p.ema200, i);

  if (ema9 !== null && ema21 !== null) {
    const spread = ((ema9 - ema21) / ema21) * 100;
    push({
      id: "ema-cross",
      category: "trend",
      labelKey: "ind.emaCross",
      value: [price(ema9), text("/"), price(ema21)],
      direction: clamp((ema9 - ema21) / (0.6 * atrValue)),
      weight: trendWeight(1.0),
      noteKey: spread > 0 ? "note.emaCross.up" : "note.emaCross.down",
      noteParams: { spread: num(Math.abs(spread)) },
    });
  }

  if (ema50 !== null && ema200 !== null) {
    push({
      id: "ema-50-200",
      category: "trend",
      labelKey: "ind.ema50200",
      value: [price(ema50), text("/"), price(ema200)],
      direction: clamp((ema50 - ema200) / (3 * atrValue)),
      weight: trendWeight(1.3) * profile.longTrend,
      noteKey: ema50 > ema200 ? "note.ema50200.golden" : "note.ema50200.death",
    });
  }

  if (ema200 !== null) {
    const distance = ((close - ema200) / ema200) * 100;
    push({
      id: "price-ema200",
      category: "trend",
      labelKey: "ind.priceEma200",
      value: [pct(distance)],
      direction: clamp((close - ema200) / (4 * atrValue)),
      weight: trendWeight(1.0) * profile.longTrend,
      noteKey: distance > 0 ? "note.priceEma200.above" : "note.priceEma200.below",
    });
  }

  const stValue = at(p.st.value, i);
  const stDirection = p.st.direction[i] ?? null;
  if (stValue !== null && stDirection !== null) {
    const up = stDirection === 1;
    push({
      id: "supertrend",
      category: "trend",
      labelKey: "ind.supertrend",
      value: [price(stValue)],
      direction: up ? 0.8 : -0.8,
      weight: trendWeight(1.3),
      noteKey: up ? "note.supertrend.up" : "note.supertrend.down",
      noteParams: { level: price(stValue) },
    });
  }

  const adxValue = at(p.adx.adx, i);
  const plusDI = at(p.adx.plusDI, i);
  const minusDI = at(p.adx.minusDI, i);
  if (adxValue !== null && plusDI !== null && minusDI !== null) {
    const diSpread = plusDI - minusDI;
    const strength = Math.min(adxValue / 40, 1);
    push({
      id: "adx",
      category: "trend",
      labelKey: "ind.adx",
      value: [num(adxValue, 1), text("+DI"), num(plusDI, 1), text("-DI"), num(minusDI, 1)],
      direction: clamp((diSpread / 25) * strength * 1.6),
      weight: trendWeight(1.2),
      noteKey: adxValue < 20 ? "note.adx.weak" : diSpread > 0 ? "note.adx.up" : "note.adx.down",
      noteParams: { adx: num(adxValue, 0) },
    });
  }

  const vwapValue = at(p.vwap, i);
  if (p.hasVolume && vwapValue !== null) {
    push({
      id: "vwap",
      category: "trend",
      labelKey: "ind.vwap",
      value: [price(vwapValue)],
      direction: clamp((close - vwapValue) / (1.2 * atrValue)),
      weight: trendWeight(0.7),
      noteKey: close > vwapValue ? "note.vwap.above" : "note.vwap.below",
    });
  }

  // ── Fiyat yapısı (gösterge dışı yöntemler) ───────────────────
  if (structure) {
    push({
      id: "structure",
      category: "structure",
      labelKey: "ind.structure",
      value: [text(structure.higherHigh ? "HH" : "LH"), text("/"), text(structure.higherLow ? "HL" : "LL")],
      direction: structure.direction,
      weight: structureWeight(1.4),
      noteKey:
        structure.direction >= 0.3
          ? "note.structure.up"
          : structure.direction <= -0.3
            ? "note.structure.down"
            : "note.structure.mixed",
    });
  }

  const volumeRatio = p.hasVolume ? volumeRatioAt(p.volumes, i) : null;

  if (i >= 20) {
    let channelHigh = -Infinity;
    let channelLow = Infinity;
    for (let k = i - 20; k < i; k++) {
      if (p.highs[k] > channelHigh) channelHigh = p.highs[k];
      if (p.lows[k] < channelLow) channelLow = p.lows[k];
    }
    const range = channelHigh - channelLow;
    if (range > 0) {
      const withVolume = volumeRatio !== null && volumeRatio >= 1.3;
      const position = (close - channelLow) / range; // 0 = dip, 1 = tepe
      let direction: number;
      let noteKey: string;
      if (close > channelHigh) {
        direction = withVolume ? 1 : 0.7;
        noteKey = withVolume ? "note.breakout.upVolume" : "note.breakout.up";
      } else if (close < channelLow) {
        direction = withVolume ? -1 : -0.7;
        noteKey = withVolume ? "note.breakout.downVolume" : "note.breakout.down";
      } else {
        // Kanalın içinde: yalnızca trend varken hafif bir yön anlamı taşır.
        direction = clamp((position - 0.5) * 2) * 0.35 * t;
        noteKey = "note.breakout.inside";
      }
      push({
        id: "breakout",
        category: "structure",
        labelKey: "ind.breakout",
        value: [price(channelLow), text("–"), price(channelHigh)],
        direction,
        weight: 1.1 * profile.breakout,
        noteKey,
        noteParams: { percent: num(clamp01(position) * 100, 0) },
      });
    }
  }

  if (higher) {
    // Üst periyodun yönü; orada trend zayıfsa etkisi de zayıf olur.
    const direction = clamp(higher.direction * (0.5 + 0.5 * higher.trendiness) * 1.3);
    push({
      id: "higher-tf",
      category: "structure",
      labelKey: "ind.higherTf",
      value: [text(higher.interval)],
      direction,
      weight: structureWeight(1.5) * profile.longTrend,
      noteKey:
        direction >= 0.15
          ? "note.higherTf.up"
          : direction <= -0.15
            ? "note.higherTf.down"
            : "note.higherTf.flat",
      noteParams: { interval: higher.interval },
    });
  }

  if (p.benchmark && p.benchmarkTicker && i >= 60) {
    const now = p.benchmark[i];
    const b20 = p.benchmark[i - 20];
    const b60 = p.benchmark[i - 60];
    if (now !== null && b20 !== null && b60 !== null && b20 > 0 && b60 > 0) {
      const rs20 = (close / p.closes[i - 20] - now / b20) * 100;
      const rs60 = (close / p.closes[i - 60] - now / b60) * 100;
      const combined = 0.5 * rs20 + 0.5 * rs60;
      // Ölçek oynaklığa bağlı: sakin bir hissede 4 puanlık fark büyüktür.
      const scale = Math.max(4, 5 * atrPercent);
      const direction = clamp(combined / scale);
      push({
        id: "rel-strength",
        category: "structure",
        labelKey: "ind.relStrength",
        value: [pct(combined)],
        direction,
        weight: structureWeight(1.0),
        noteKey:
          direction >= 0.15
            ? "note.relStrength.out"
            : direction <= -0.15
              ? "note.relStrength.under"
              : "note.relStrength.inline",
        noteParams: { benchmark: p.benchmarkTicker, diff: num(Math.abs(combined), 1) },
      });
    }
  }

  const patternBias = patternBiasAt(p, i, regime, conviction);
  if (patternBias) {
    push({
      id: "patterns",
      category: "structure",
      labelKey: "ind.patterns",
      value: [num(patternBias.count, 0)],
      direction: patternBias.direction,
      weight: 0.7,
      noteKey: patternBias.direction > 0 ? "note.patterns.bull" : "note.patterns.bear",
      noteParams: { count: patternBias.count },
    });
  }

  // ── Momentum ─────────────────────────────────────────────────
  const rsiValue = at(p.rsi, i);
  if (rsiValue !== null) {
    const read = readOscillator(rsiValue, 30, 70, regime, conviction);
    push({
      id: "rsi",
      category: "momentum",
      labelKey: "ind.rsi",
      value: [num(rsiValue, 1)],
      direction: read.direction,
      weight: oscWeight(1.3),
      noteKey: read.noteKey,
      noteParams: { value: num(rsiValue, 1) },
    });
  }

  const macdValue = at(p.macd.macd, i);
  const macdSignal = at(p.macd.signal, i);
  const histogram = at(p.macd.histogram, i);
  if (macdValue !== null && macdSignal !== null && histogram !== null) {
    const previousHistogram = at(p.macd.histogram, i - 1) ?? 0;
    const rising = histogram > previousHistogram;
    const above = macdValue > macdSignal;
    const magnitude = Math.abs(histogram) / (0.3 * atrValue);
    let direction = (above ? 1 : -1) * Math.min(0.4 + magnitude * 0.5, 1);
    // Çizginin üstünde ama zayıflıyorsa (ya da tersi) oy azaltılır.
    if (above !== rising) direction *= 0.6;
    push({
      id: "macd",
      category: "momentum",
      labelKey: "ind.macd",
      value: [num(macdValue, 4), text("/"), num(macdSignal, 4)],
      direction: clamp(direction),
      weight: momentumWeight(1.3),
      noteKey: above
        ? rising
          ? "note.macd.aboveRising"
          : "note.macd.aboveFalling"
        : rising
          ? "note.macd.belowRising"
          : "note.macd.belowFalling",
    });
  }

  const stochK = at(p.stoch.k, i);
  const stochD = at(p.stoch.d, i);
  if (stochK !== null && stochD !== null) {
    const read = readOscillator(stochK, 20, 80, regime, conviction);
    push({
      id: "stochastic",
      category: "momentum",
      labelKey: "ind.stoch",
      value: [num(stochK, 1), text("/"), num(stochD, 1)],
      direction: read.direction,
      weight: oscWeight(0.8),
      noteKey: read.noteKey,
      noteParams: { value: num(stochK, 0) },
    });
  }

  const cciValue = at(p.cci, i);
  if (cciValue !== null) {
    const read = readOscillator(cciValue, -100, 100, regime, conviction);
    push({
      id: "cci",
      category: "momentum",
      labelKey: "ind.cci",
      value: [num(cciValue, 1)],
      direction: read.direction,
      weight: oscWeight(0.6),
      noteKey: read.noteKey,
      noteParams: { value: num(cciValue, 0) },
    });
  }

  const williams = at(p.willr, i);
  if (williams !== null) {
    const read = readOscillator(williams, -80, -20, regime, conviction);
    push({
      id: "williams",
      category: "momentum",
      labelKey: "ind.williams",
      value: [num(williams, 1)],
      direction: read.direction,
      weight: oscWeight(0.5),
      noteKey: read.noteKey,
      noteParams: { value: num(williams, 0) },
    });
  }

  const rocValue = at(p.roc, i);
  if (rocValue !== null) {
    push({
      id: "roc",
      category: "momentum",
      labelKey: "ind.roc",
      value: [pct(rocValue)],
      direction: clamp(rocValue / (3 * atrPercent)),
      weight: momentumWeight(0.7),
      noteKey: rocValue >= 0 ? "note.roc.up" : "note.roc.down",
      noteParams: { roc: num(Math.abs(rocValue)) },
    });
  }

  // ── Volatilite ───────────────────────────────────────────────
  const percentB = at(p.bb.percentB, i);
  if (percentB !== null) {
    const read = readOscillator(percentB * 100, 5, 95, regime, conviction);
    push({
      id: "bollinger",
      category: "volatility",
      labelKey: "ind.bollinger",
      value: [num(percentB * 100, 1)],
      direction: read.direction,
      weight: oscWeight(0.8),
      noteKey: read.noteKey,
      noteParams: { value: num(percentB * 100, 0) },
    });
  }

  if (profile.extension > 0 && ema21 !== null) {
    // Fiyatın kısa vadeli ortalamasından ATR cinsinden uzaklığı. Hisselerde
    // ortalamadan fazla açılan fiyat geri çekilme eğilimindedir; bu gösterge
    // "koşmuş fiyatı kovalama" ve "aşırı satılmışı satma" hatasını frenler.
    // Bir ATR'ye kadar olan uzaklık olağan sayılır ve oy vermez.
    const stretch = (close - ema21) / atrValue;
    const magnitude = clamp01((Math.abs(stretch) - 1) / 2.5);
    push({
      id: "extension",
      category: "volatility",
      labelKey: "ind.extension",
      value: [num(stretch, 1), text("ATR")],
      direction: -Math.sign(stretch) * magnitude,
      weight: 1.0 * profile.extension,
      noteKey:
        magnitude < 0.15
          ? "note.extension.normal"
          : stretch > 0
            ? "note.extension.up"
            : "note.extension.down",
      noteParams: { atr: num(Math.abs(stretch), 1) },
    });
  }

  // ── Hacim ────────────────────────────────────────────────────
  // Hacim verisi olmayan varlıklarda (döviz kurları) bu bölüm atlanır. Sıfır
  // hacimle hesaplanan MFI sabit 100 çıkıyor ve her zaman "aşırı alım" oyu
  // veriyordu: var olmayan bir veriden sinyal üretmekti.
  if (p.hasVolume && i >= 14) {
    const obvNow = at(p.obv, i);
    const obvPast = at(p.obv, i - 14);
    let traded = 0;
    for (let k = i - 13; k <= i; k++) traded += p.volumes[k];
    if (obvNow !== null && obvPast !== null && traded > 0) {
      // Son 14 mumda işlem gören hacmin net olarak ne kadarı alıcı tarafta?
      const flow = (obvNow - obvPast) / traded;
      push({
        id: "obv",
        category: "volume",
        labelKey: "ind.obv",
        value: [pct(flow * 100)],
        direction: clamp(flow * 2.5),
        weight: 1.0,
        noteKey: flow > 0 ? "note.obv.up" : "note.obv.down",
      });
    }

    const mfiValue = at(p.mfi, i);
    if (mfiValue !== null) {
      const read = readOscillator(mfiValue, 20, 80, regime, conviction);
      push({
        id: "mfi",
        category: "volume",
        labelKey: "ind.mfi",
        value: [num(mfiValue, 1)],
        direction: read.direction,
        weight: oscWeight(0.7),
        noteKey: read.noteKey,
        noteParams: { value: num(mfiValue, 0) },
      });
    }

    if (volumeRatio !== null) {
      const priceUp = close >= previousClose;
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
        weight: 0.6,
        noteKey: surge ? "note.volume.surge" : "note.volume.normal",
        noteParams: surge
          ? { ratio: num(volumeRatio, 1), directionKey: priceUp ? "up" : "down" }
          : undefined,
      });
    }
  }

  // ── Skor ─────────────────────────────────────────────────────
  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const weighted = checks.reduce((sum, c) => sum + c.weight * c.direction, 0);
  const score = totalWeight === 0 ? 0 : (weighted / totalWeight) * 100;

  const agreement =
    totalWeight === 0
      ? 0
      : checks
          .filter((c) => c.direction !== 0 && Math.sign(c.direction) === Math.sign(score))
          .reduce((sum, c) => sum + c.weight, 0) / totalWeight;

  return { checks, score, regime, agreement, higher: higher ?? null };
}

/* ────────────────────────── Geçmiş sınaması ────────────────────────── */

/** Sinyalin sonucu kaç mum sonra ölçülür. */
const BACKTEST_HORIZON = 10;
/** Göstergelerin ısınması için atlanan baş mumlar. */
const BACKTEST_WARMUP = 80;
/** Bu sayının altındaki sinyalle sonuç çıkarılmaz. */
const BACKTEST_MIN_SIGNALS = 12;
/** Büzme katsayısı: bu kadar "hayali" taban gözlem eklenir. */
const BACKTEST_SHRINK = 10;

/**
 * Motoru bu varlığın kendi geçmişinde çalıştırır.
 *
 * Her geçmiş mum için "o gün ne derdi" hesaplanır ve `BACKTEST_HORIZON` mum
 * sonraki fiyatla karşılaştırılır. Üç dürüstlük kuralı:
 *
 *   1. Geleceğe bakılmaz: `evaluate` yalnızca ≤ i mumları okur; pivotlar
 *      ancak kesinleştikten sonra kullanılır.
 *   2. İsabet tek başına verilmez, **taban oranla** birlikte verilir.
 *      Yükselen bir piyasada her alış sinyali "tutar"; anlamlı olan, sinyalin
 *      rastgele bir mumdan ne kadar iyi olduğudur.
 *   3. Küçük örnek büzülür: 5 sinyalin 5'i tuttu diye %100 denmez; sonuç
 *      taban orana doğru çekilir ve `reliable` bayrağı kapalı kalır.
 *
 * Sınırı da bilinmeli: ardışık mumların sinyalleri birbirinden bağımsız
 * değildir ve tek bir varlığın birkaç yüz mumu küçük bir örnektir. Bu ölçüm
 * bir garanti değil, motorun bu varlıkta nasıl davrandığının özetidir.
 */
function runBacktest(p: Prepared): Backtest | null {
  const end = p.closes.length - 1 - BACKTEST_HORIZON;
  if (end - BACKTEST_WARMUP < 40) return null;

  let samples = 0;
  let ups = 0;
  let downs = 0;
  const buy = { signals: 0, hits: 0, sum: 0 };
  const sell = { signals: 0, hits: 0, sum: 0 };

  for (let i = BACKTEST_WARMUP; i <= end; i++) {
    const { score } = evaluate(p, i);
    const forward = (p.closes[i + BACKTEST_HORIZON] / p.closes[i] - 1) * 100;

    samples++;
    if (forward > 0) ups++;
    else if (forward < 0) downs++;

    if (score >= SIGNAL_THRESHOLD) {
      buy.signals++;
      buy.sum += forward;
      if (forward > 0) buy.hits++;
    } else if (score <= -SIGNAL_THRESHOLD) {
      sell.signals++;
      sell.sum -= forward;
      if (forward < 0) sell.hits++;
    }
  }

  const side = (
    raw: { signals: number; hits: number; sum: number },
    baseRate: number,
  ): BacktestSide | null => {
    if (raw.signals === 0) return null;
    const shrunk = (raw.hits + BACKTEST_SHRINK * baseRate) / (raw.signals + BACKTEST_SHRINK);
    return {
      signals: raw.signals,
      hitRate: raw.hits / raw.signals,
      baseRate,
      edge: shrunk - baseRate,
      avgReturn: raw.sum / raw.signals,
      reliable: raw.signals >= BACKTEST_MIN_SIGNALS,
    };
  };

  return {
    horizon: BACKTEST_HORIZON,
    samples,
    buy: side(buy, ups / samples),
    sell: side(sell, downs / samples),
  };
}

/* ────────────────────────── Ana analiz ────────────────────────── */

export function analyze(
  instrument: Instrument,
  interval: Interval,
  candles: Candle[],
  source: DataSource,
  context: AnalysisContext = {},
): Analysis {
  if (candles.length < 60) {
    throw new Error("Analiz için yeterli mum verisi yok (en az 60 mum gerekir).");
  }

  const p = prepare(candles, context, profileFor(instrument, interval), interval);
  const i = candles.length - 1;
  const lastPrice = p.closes[i];
  const previousClose = p.closes[i - 1];

  const { checks, score, regime, agreement, higher } = evaluate(p, i);
  const signal = signalFromScore(score);
  const backtest = context.backtest === false ? null : runBacktest(p);

  const snapshot: IndicatorSnapshot = {
    rsi: at(p.rsi, i),
    macd: at(p.macd.macd, i),
    macdSignal: at(p.macd.signal, i),
    macdHistogram: at(p.macd.histogram, i),
    ema9: at(p.ema9, i),
    ema21: at(p.ema21, i),
    ema50: at(p.ema50, i),
    ema200: at(p.ema200, i),
    sma20: at(p.sma20, i),
    bbUpper: at(p.bb.upper, i),
    bbMiddle: at(p.bb.middle, i),
    bbLower: at(p.bb.lower, i),
    bbPercentB: at(p.bb.percentB, i),
    bbBandwidth: at(p.bb.bandwidth, i),
    stochK: at(p.stoch.k, i),
    stochD: at(p.stoch.d, i),
    atr: at(p.atr, i),
    adx: at(p.adx.adx, i),
    plusDI: at(p.adx.plusDI, i),
    minusDI: at(p.adx.minusDI, i),
    cci: at(p.cci, i),
    williamsR: at(p.willr, i),
    mfi: p.hasVolume ? at(p.mfi, i) : null,
    obv: p.hasVolume ? at(p.obv, i) : null,
    vwap: p.hasVolume ? at(p.vwap, i) : null,
    supertrend: at(p.st.value, i),
    supertrendDirection: p.st.direction[i] ?? null,
  };

  const tally = {
    buy: checks.filter((c) => c.verdict === "BUY").length,
    sell: checks.filter((c) => c.verdict === "SELL").length,
    neutral: checks.filter((c) => c.verdict === "NEUTRAL").length,
  };

  const confidence = confidenceOf({
    score,
    agreement,
    regime,
    higher,
    backtest,
  });

  // ── Formasyonlar ve seviyeler ────────────────────────────────
  const patterns = patternsAt(p, i);
  const levels = findLevels(candles, lastPrice);

  // ── İşlem planı ──────────────────────────────────────────────
  const atrValue = snapshot.atr ?? lastPrice * 0.02;
  const atrPercent = (atrValue / lastPrice) * 100;
  const side: "LONG" | "SHORT" = score >= 0 ? "LONG" : "SHORT";
  const swingLow = Math.min(...p.lows.slice(-12));
  const swingHigh = Math.max(...p.highs.slice(-12));

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
  const bandwidthHistory = p.bb.bandwidth.filter((v): v is number => v !== null).slice(-60);
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
    regime: {
      trendiness: Number(regime.trendiness.toFixed(3)),
      direction: Number(regime.direction.toFixed(3)),
      key: regime.key,
    },
    profileKey: profileKeyFor(instrument, interval),
    backtest,
  };
}

/**
 * Güven yüzdesi: sinyalin ne kadar sağlam temele oturduğunun bileşik ölçüsü.
 *
 * Beş bileşen, olanların ağırlıklı ortalaması alınır:
 *   • skorun büyüklüğü          — sinyal ne kadar net
 *   • göstergelerin uyumu       — kaçı aynı şeyi söylüyor
 *   • rejimin netliği           — belirgin trend ya da belirgin yatay; geçiş
 *                                 dönemlerinde her yöntem daha sık yanılır
 *   • üst periyot uyumu         — büyük resim aynı yönde mi (verildiyse)
 *   • geçmiş sınaması           — bu sinyal bu varlıkta geçmişte taban
 *                                 orandan iyi miydi (örnek yetiyorsa)
 *
 * Son iki bileşen her zaman bulunmaz; bulunmadığında yokmuş gibi davranılır,
 * sıfır sayılmaz — eksik veri kötü veri değildir.
 */
function confidenceOf(input: {
  score: number;
  agreement: number;
  regime: Regime;
  higher: AnalysisContext["higher"];
  backtest: Backtest | null;
}): number {
  const { score, agreement, regime, higher, backtest } = input;
  const parts: [number, number][] = [
    [Math.min(1, Math.abs(score) / 55), 0.3],
    [agreement, 0.25],
    [Math.abs(2 * regime.trendiness - 1), 0.1],
  ];

  if (higher) {
    const higherDirection = higher.direction * (0.5 + 0.5 * higher.trendiness);
    const sameSide = Math.sign(higherDirection) === Math.sign(score);
    parts.push([
      Math.abs(higherDirection) < 0.15 ? 0.5 : sameSide ? 1 : 0,
      0.15,
    ]);
  }

  const side = score >= 0 ? backtest?.buy : backtest?.sell;
  if (side && side.reliable) {
    // +0,20 üstünlük tam puan, −0,20 sıfır puan.
    parts.push([clamp01(0.5 + side.edge * 2.5), 0.2]);
  }

  const weight = parts.reduce((sum, [, w]) => sum + w, 0);
  const value = parts.reduce((sum, [v, w]) => sum + v * w, 0) / weight;
  return Math.round(clamp01(value) * 100);
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

/* ────────────────────────── Formasyonlar ────────────────────────── */

/**
 * `i` mumunun kapanışında görülen formasyonlar.
 *
 * Konuma bağlı yazıldı (dizinin sonuna değil `i`'ye bakar) çünkü geçmiş
 * sınaması aynı fonksiyonu eski mumlar için çağırıyor.
 */
function patternsAt(p: Prepared, i: number): Pattern[] {
  const patterns: Pattern[] = [];
  if (i < 2) return patterns;
  const c1 = p.candles[i];
  const c2 = p.candles[i - 1];
  const c3 = p.candles[i - 2];

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

  const cross = recentCross(p.ema50, p.ema200, 5, i);
  if (cross === "up") patterns.push({ id: "golden-cross", bias: "BUY" });
  else if (cross === "down") patterns.push({ id: "death-cross", bias: "SELL" });

  const macdCross = recentCross(p.macd.macd, p.macd.signal, 3, i);
  if (macdCross === "up") patterns.push({ id: "macd-cross-up", bias: "BUY" });
  else if (macdCross === "down") patterns.push({ id: "macd-cross-down", bias: "SELL" });

  const divergence = divergenceAt(p, i);
  if (divergence) patterns.push(divergence);

  const bandwidths: number[] = [];
  for (let k = Math.max(0, i - 59); k <= i; k++) {
    const v = at(p.bb.bandwidth, k);
    if (v !== null) bandwidths.push(v);
  }
  if (bandwidths.length > 40) {
    const current = bandwidths[bandwidths.length - 1];
    if (current <= Math.min(...bandwidths) * 1.15) {
      patterns.push({ id: "bb-squeeze", bias: "NEUTRAL" });
    }
  }

  return patterns;
}

/**
 * Formasyonların skora katkısı.
 *
 * Kesişimler burada sayılmaz: EMA ve MACD kesişimleri zaten kendi
 * göstergelerinde oylanıyor, ikinci kez saymak aynı bilgiye çift oy vermek
 * olurdu. Güçlü bir trende karşı oluşan tek mumluk formasyonların oyu
 * azaltılır; trendi tek mum döndürmez.
 */
const PATTERN_STRENGTH: Record<string, number> = {
  "bullish-engulfing": 0.5,
  "bearish-engulfing": 0.5,
  hammer: 0.4,
  "shooting-star": 0.4,
  "morning-star": 0.6,
  "evening-star": 0.6,
  "bullish-divergence": 0.7,
  "bearish-divergence": 0.7,
};

function patternBiasAt(
  p: Prepared,
  i: number,
  regime: Regime,
  conviction: number,
): { direction: number; count: number } | null {
  let total = 0;
  let count = 0;
  for (const pattern of patternsAt(p, i)) {
    const strength = PATTERN_STRENGTH[pattern.id];
    if (!strength || pattern.bias === "NEUTRAL") continue;
    const sign = pattern.bias === "BUY" ? 1 : -1;
    const againstTrend = sign * regime.direction < 0;
    total += sign * strength * (againstTrend ? 1 - 0.5 * conviction : 1);
    count++;
  }
  if (count === 0 || Math.abs(total) < 0.05) return null;
  return { direction: clamp(total), count };
}

/** İki serinin `i`'den geriye `lookback` mum içinde kesişip kesişmediği. */
function recentCross(
  fast: Series,
  slow: Series,
  lookback: number,
  i: number,
): "up" | "down" | null {
  const points: { fast: number; slow: number }[] = [];
  for (let k = i; k >= 0 && points.length < lookback + 1; k--) {
    const f = at(fast, k);
    const s = at(slow, k);
    if (f === null || s === null) continue;
    points.unshift({ fast: f, slow: s });
  }
  if (points.length < 2) return null;
  for (let k = 1; k < points.length; k++) {
    const before = points[k - 1].fast - points[k - 1].slow;
    const after = points[k].fast - points[k].slow;
    if (before <= 0 && after > 0) return "up";
    if (before >= 0 && after < 0) return "down";
  }
  return null;
}

/** Fiyat ile RSI arasında pozitif/negatif uyumsuzluk arar. */
function divergenceAt(p: Prepared, i: number): Pattern | null {
  const window = 40;
  if (i < window + 4) return null;
  const start = i - window + 1;

  let lowIndex = start;
  let highIndex = start;
  // Son üç mum karşılaştırmanın "şimdi" tarafıdır; uç nokta aramasına girmez.
  for (let k = start + 1; k <= i - 3; k++) {
    if (p.lows[k] < p.lows[lowIndex]) lowIndex = k;
    if (p.highs[k] > p.highs[highIndex]) highIndex = k;
  }

  let recentLow = Infinity;
  let recentHigh = -Infinity;
  for (let k = i - 5; k <= i; k++) {
    if (p.lows[k] < recentLow) recentLow = p.lows[k];
    if (p.highs[k] > recentHigh) recentHigh = p.highs[k];
  }

  const rsiNow = at(p.rsi, i);
  const rsiAtLow = at(p.rsi, lowIndex);
  const rsiAtHigh = at(p.rsi, highIndex);
  if (rsiNow === null) return null;

  if (
    rsiAtLow !== null &&
    lowIndex < i - 5 &&
    recentLow <= p.lows[lowIndex] * 1.005 &&
    rsiNow > rsiAtLow + 4
  ) {
    return { id: "bullish-divergence", bias: "BUY" };
  }
  if (
    rsiAtHigh !== null &&
    highIndex < i - 5 &&
    recentHigh >= p.highs[highIndex] * 0.995 &&
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

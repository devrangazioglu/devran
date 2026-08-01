/**
 * Analiz sonucunu insan diline çevirir.
 *
 * Şablon tabanlı ve deterministik: aynı veriden her zaman aynı yorum çıkar,
 * harici bir servise ihtiyaç duyulmaz. Metinler sözlükten geldiği için her
 * dilde çalışır (analiz metinleri hazır olmayan dillerde İngilizceye düşer).
 *
 * Yorum, göstergelerin tablodaki değerlerini tekrar etmez; onları **birbirine
 * bağlar**: hangi gösterge neyi söylüyor, hangileri çelişiyor, hangi seviye
 * kırılırsa sinyal geçersiz olur. Her paragraf tek bir soruyu yanıtlar —
 * ana eğilim, momentum, para akışı, oynaklık, formasyonlar, seviyeler, üst
 * zaman dilimleri, plan ve “bunu ne bozar”.
 */

import { isBuySignal, isSellSignal, type Analysis, type SignalLabel } from "./analysis";
import { intervalLabel, patternName, renderNote } from "./analysis-text";
import { formatNumber, formatPercent, formatPrice } from "./format";
import { intlTag, makeT, type Locale } from "./i18n";
import type { Interval } from "./markets/types";

export type Commentary = {
  headline: string;
  /**
   * Sırasıyla: genel görünüm, trend, momentum, para akışı, oynaklık,
   * formasyonlar, seviyeler, üst zaman dilimleri, plan, karşı senaryo.
   * Veri yetersizse ilgili paragraf atlanır.
   */
  paragraphs: string[];
  highlights: string[];
  risks: string[];
};

/** Yorumu zenginleştiren, analizin kendisinde bulunmayan bağlam. */
export type CommentaryContext = {
  /** Üst/alt zaman dilimlerinin sinyalleri (detay sayfasındaki karşılaştırma). */
  timeframes?: { interval: Interval; signal: SignalLabel; score: number }[];
};

export function buildCommentary(
  analysis: Analysis,
  locale: Locale,
  context: CommentaryContext = {},
): Commentary {
  const t = makeT(locale);
  const intl = intlTag(locale);
  const { instrument, signal, score, confidence, indicators, trade, interval } = analysis;

  const asset = instrument.ticker;
  const period = intervalLabel(t, interval);
  const price = (value: number | null) => formatPrice(value, intl);
  const number = (value: number | null, digits = 2) => formatNumber(value, intl, digits);
  /** İki fiyat arasındaki farkın yüzdesi (yön işareti olmadan). */
  const uzaklik = (hedef: number, taban = analysis.price) =>
    number(Math.abs(((hedef - taban) / taban) * 100));

  const headline = t("commentary.headline", {
    asset,
    interval: period,
    signal: t(`signal.${signal}` as "signal.BUY"),
    score: number(score, 0),
    confidence,
  });

  const paragraphs: string[] = [];
  /** Boş parçaları eleyip tek paragraf yapar. */
  const paragraf = (...parcalar: (string | null | false)[]) => {
    const metin = parcalar.filter(Boolean).join(" ").trim();
    if (metin) paragraphs.push(metin);
  };

  /* ── 1) Genel görünüm ────────────────────────────────── */

  const ema200Konum =
    indicators.ema200 !== null
      ? t(
          analysis.price >= indicators.ema200
            ? "commentary.overview.aboveEma200"
            : "commentary.overview.belowEma200",
          { distance: uzaklik(indicators.ema200), ema200: price(indicators.ema200) },
        )
      : null;

  paragraf(
    t("commentary.overview", {
      asset,
      price: price(analysis.price),
      currency: instrument.currency,
      change: number(analysis.changePercent),
      interval: period,
      summary: t(`commentary.summary.${signal}` as "commentary.summary.BUY"),
      buy: analysis.tally.buy,
      sell: analysis.tally.sell,
      neutral: analysis.tally.neutral,
      score: number(score, 1),
      confidence,
    }),
    ema200Konum,
    t("commentary.overview.scoreNote"),
  );

  /* ── 2) Trend ────────────────────────────────────────── */

  const trendParts: string[] = [];
  if (indicators.ema9 !== null && indicators.ema21 !== null) {
    trendParts.push(
      t(
        indicators.ema9 > indicators.ema21
          ? "commentary.trend.shortUp"
          : "commentary.trend.shortDown",
        { ema9: price(indicators.ema9), ema21: price(indicators.ema21) },
      ),
    );
  }
  if (indicators.ema50 !== null && indicators.ema200 !== null) {
    trendParts.push(
      t(
        indicators.ema50 > indicators.ema200
          ? "commentary.trend.emaUp"
          : "commentary.trend.emaDown",
        { ema50: price(indicators.ema50), ema200: price(indicators.ema200) },
      ),
    );
  }
  if (indicators.supertrendDirection !== null) {
    trendParts.push(
      t(
        indicators.supertrendDirection === 1
          ? "commentary.trend.stUp"
          : "commentary.trend.stDown",
        { level: price(indicators.supertrend) },
      ),
    );
  }
  trendParts.push(
    t("commentary.trend.adx", {
      adx: indicators.adx === null ? "—" : number(indicators.adx, 1),
      label: t(analysis.trendStrength.labelKey as "trend.strong"),
    }),
  );
  if (indicators.plusDI !== null && indicators.minusDI !== null) {
    trendParts.push(
      t(indicators.plusDI >= indicators.minusDI ? "commentary.trend.diUp" : "commentary.trend.diDown", {
        plus: number(indicators.plusDI, 1),
        minus: number(indicators.minusDI, 1),
      }),
    );
  }
  if (indicators.vwap !== null) {
    trendParts.push(
      t(analysis.price >= indicators.vwap ? "commentary.trend.vwapAbove" : "commentary.trend.vwapBelow", {
        vwap: price(indicators.vwap),
      }),
    );
  }

  paragraf(t("commentary.trend", { parts: trendParts.join(". ") }), t("commentary.trend.explain"));

  /* ── 3) Momentum ─────────────────────────────────────── */

  const momentumParts: string[] = [];
  if (indicators.rsi !== null) {
    const key =
      indicators.rsi >= 70
        ? "commentary.momentum.rsiOverbought"
        : indicators.rsi <= 30
          ? "commentary.momentum.rsiOversold"
          : indicators.rsi > 50
            ? "commentary.momentum.rsiBull"
            : "commentary.momentum.rsiBear";
    momentumParts.push(t(key, { rsi: number(indicators.rsi, 1) }));
  }
  if (indicators.macd !== null && indicators.macdSignal !== null) {
    momentumParts.push(
      t(
        indicators.macd > indicators.macdSignal
          ? "commentary.momentum.macdUp"
          : "commentary.momentum.macdDown",
      ),
    );
  }
  if (indicators.macdHistogram !== null) {
    momentumParts.push(
      t(
        indicators.macdHistogram >= 0
          ? "commentary.momentum.histPositive"
          : "commentary.momentum.histNegative",
        { hist: number(Math.abs(indicators.macdHistogram), 4) },
      ),
    );
  }
  if (indicators.stochK !== null && indicators.stochD !== null) {
    momentumParts.push(
      t(
        indicators.stochK >= indicators.stochD
          ? "commentary.momentum.stochAbove"
          : "commentary.momentum.stochBelow",
        { k: number(indicators.stochK, 0), d: number(indicators.stochD, 0) },
      ),
    );
  } else if (indicators.stochK !== null) {
    momentumParts.push(t("commentary.momentum.stoch", { k: number(indicators.stochK, 0) }));
  }
  if (indicators.cci !== null) {
    const key =
      indicators.cci > 100
        ? "commentary.momentum.cciHigh"
        : indicators.cci < -100
          ? "commentary.momentum.cciLow"
          : "commentary.momentum.cciMid";
    momentumParts.push(t(key, { cci: number(indicators.cci, 0) }));
  }
  if (indicators.williamsR !== null) {
    momentumParts.push(t("commentary.momentum.williams", { wr: number(indicators.williamsR, 0) }));
  }

  paragraf(
    t("commentary.momentum", { parts: momentumParts.join(", ") }),
    t("commentary.momentum.explain"),
  );

  /* ── 4) Para akışı ve hacim ──────────────────────────── */

  const obvCheck = analysis.checks.find((c) => c.id === "obv");
  const volumeCheck = analysis.checks.find((c) => c.id === "volume");
  const mfiCumle =
    indicators.mfi !== null
      ? t(
          indicators.mfi >= 80
            ? "commentary.flow.mfiHigh"
            : indicators.mfi <= 20
              ? "commentary.flow.mfiLow"
              : "commentary.flow.mfiMid",
          { mfi: number(indicators.mfi, 0) },
        )
      : null;

  paragraf(
    t("commentary.flow.intro"),
    obvCheck ? renderNote(t, obvCheck) : null,
    volumeCheck ? renderNote(t, volumeCheck) : null,
    mfiCumle,
    t("commentary.flow.explain"),
  );

  /* ── 5) Oynaklık ─────────────────────────────────────── */

  const bandKonum =
    indicators.bbPercentB !== null
      ? t(
          indicators.bbPercentB > 1
            ? "commentary.vol.aboveBand"
            : indicators.bbPercentB < 0
              ? "commentary.vol.belowBand"
              : indicators.bbPercentB >= 0.5
                ? "commentary.vol.upperHalf"
                : "commentary.vol.lowerHalf",
          {
            percentB: number(indicators.bbPercentB * 100, 0),
            upper: price(indicators.bbUpper),
            lower: price(indicators.bbLower),
          },
        )
      : null;

  paragraf(
    t("commentary.volatility", {
      regime: t(analysis.volatility.regimeKey as "vol.normal"),
      atrPercent: number(analysis.volatility.atrPercent),
      interval: period,
      atr: price(trade.atr),
      currency: instrument.currency,
    }),
    bandKonum,
    // `bbBandwidth` zaten yüzde olarak hesaplanıyor (bkz. lib/indicators.ts);
    // burada yeniden 100 ile çarpmak rakamı yüz katına çıkarır.
    indicators.bbBandwidth !== null
      ? t("commentary.vol.bandwidth", { bandwidth: number(indicators.bbBandwidth) })
      : null,
    analysis.volatility.squeeze ? t("commentary.volatility.squeeze") : null,
  );

  /* ── 6) Formasyonlar ─────────────────────────────────── */

  if (analysis.patterns.length > 0) {
    const cumleler = analysis.patterns
      .slice(0, 4)
      .map(
        (pattern) =>
          `${patternName(t, pattern.id)} (${t(
            pattern.bias === "BUY"
              ? "commentary.pattern.bull"
              : pattern.bias === "SELL"
                ? "commentary.pattern.bear"
                : "commentary.pattern.neutral",
          )}): ${t(`pattern.${pattern.id}.note` as "pattern.doji.note")}`,
      );
    paragraf(t("commentary.pattern.intro", { count: analysis.patterns.length }), cumleler.join(" "));
  } else {
    paragraf(t("commentary.pattern.none"));
  }

  /* ── 7) Seviyeler ────────────────────────────────────── */

  const resistance = analysis.levels.resistances[0];
  const support = analysis.levels.supports[0];
  const ikinciDirenc = analysis.levels.resistances[1];
  const ikinciDestek = analysis.levels.supports[1];

  if (support && resistance) {
    // Fiyatın destek–direnç bandındaki yeri, "nereye yakınız" sorusunu
    // tek bir sayıyla yanıtlar.
    const bant = resistance.price - support.price;
    const konum = bant > 0 ? ((analysis.price - support.price) / bant) * 100 : 50;
    paragraf(
      t("commentary.levels", {
        support: price(support.price),
        supportDistance: number(Math.abs(support.distancePercent)),
        supportTouches: support.strength,
        resistance: price(resistance.price),
        resistanceDistance: number(Math.abs(resistance.distancePercent)),
        resistanceTouches: resistance.strength,
      }),
      t("commentary.levels.position", { position: number(Math.max(0, Math.min(100, konum)), 0) }),
      ikinciDestek || ikinciDirenc
        ? t("commentary.levels.second", {
            support: ikinciDestek ? price(ikinciDestek.price) : "—",
            resistance: ikinciDirenc ? price(ikinciDirenc.price) : "—",
          })
        : null,
    );
  } else if (support) {
    paragraf(
      t("commentary.levels.supportOnly", {
        support: price(support.price),
        supportDistance: number(Math.abs(support.distancePercent)),
        supportTouches: support.strength,
      }),
    );
  } else if (resistance) {
    paragraf(
      t("commentary.levels.resistanceOnly", {
        resistance: price(resistance.price),
        resistanceDistance: number(Math.abs(resistance.distancePercent)),
        resistanceTouches: resistance.strength,
      }),
    );
  }

  /* ── 8) Üst zaman dilimleri ──────────────────────────── */

  const digerPeriyotlar = context.timeframes?.filter((tf) => tf.interval !== interval) ?? [];
  if (digerPeriyotlar.length > 0) {
    const liste = digerPeriyotlar
      .map(
        (tf) =>
          `${intervalLabel(t, tf.interval)}: ${t(`signal.${tf.signal}` as "signal.BUY")} (${number(
            tf.score,
            0,
          )})`,
      )
      .join(" · ");

    const ayniYon = digerPeriyotlar.filter((tf) => Math.sign(tf.score) === Math.sign(score)).length;
    const uyumKey =
      score === 0
        ? "commentary.timeframes.mixed"
        : ayniYon === digerPeriyotlar.length
          ? "commentary.timeframes.aligned"
          : ayniYon === 0
            ? "commentary.timeframes.against"
            : "commentary.timeframes.mixed";

    paragraf(t("commentary.timeframes", { list: liste }), t(uyumKey));
  }

  /* ── 9) Plan ─────────────────────────────────────────── */

  const hedefler = trade.targets.map((hedef, index) =>
    t("commentary.plan.target", {
      index: index + 1,
      price: price(hedef),
      distance: uzaklik(hedef, trade.entry),
    }),
  );

  paragraf(
    trade.advisory ? t("commentary.plan.advisory") : null,
    t("commentary.plan", {
      side: t(trade.side === "LONG" ? "commentary.plan.long" : "commentary.plan.short"),
      entry: price(trade.entry),
      stop: price(trade.stopLoss),
      riskPercent: number(trade.riskPercent),
      target: price(trade.targets[0]),
      rr: number(trade.riskReward, 2),
    }),
    hedefler.length > 0 ? t("commentary.plan.targets", { list: hedefler.join(", ") }) : null,
    t("commentary.plan.sizing", { riskPercent: number(trade.riskPercent) }),
  );

  /* ── 10) Karşı senaryo ───────────────────────────────── */

  const yukariTetik = resistance ? price(resistance.price) : price(trade.targets[0]);
  const asagiTetik = support ? price(support.price) : price(trade.stopLoss);

  // Karşı senaryo skora değil **sinyale** bakar: skor −6 iken sinyal BEKLE
  // olduğu hâlde "düşüş senaryosu" yazmak, kartın tepesindeki rozetle
  // çelişen bir yorum üretiyordu.
  const yon = isBuySignal(signal) ? 1 : isSellSignal(signal) ? -1 : 0;

  if (yon > 0) {
    paragraf(
      t("commentary.counter.bull", { invalid: asagiTetik, confirm: yukariTetik }),
      indicators.rsi !== null && indicators.rsi > 50
        ? t("commentary.counter.rsiWatchBull")
        : null,
    );
  } else if (yon < 0) {
    paragraf(
      t("commentary.counter.bear", { invalid: yukariTetik, confirm: asagiTetik }),
      indicators.rsi !== null && indicators.rsi < 50
        ? t("commentary.counter.rsiWatchBear")
        : null,
    );
  } else {
    paragraf(t("commentary.counter.wait", { up: yukariTetik, down: asagiTetik }));
  }

  /* ── Öne çıkanlar ────────────────────────────────────── */

  const highlights: string[] = [];
  const strongest = [...analysis.checks]
    .sort((a, b) => Math.abs(b.direction * b.weight) - Math.abs(a.direction * a.weight))
    .slice(0, 4);
  for (const check of strongest) {
    highlights.push(`${t(check.labelKey as "ind.rsi")}: ${renderNote(t, check)}`);
  }
  for (const pattern of analysis.patterns.slice(0, 3)) {
    highlights.push(
      `${patternName(t, pattern.id)} — ${t(`pattern.${pattern.id}.note` as "pattern.doji.note")}`,
    );
  }

  /* ── Riskler ─────────────────────────────────────────── */

  const risks: string[] = [];
  if (analysis.trendStrength.adx !== null && analysis.trendStrength.adx < 20) {
    risks.push(t("risk.weakTrend"));
  }
  if (confidence < 45) risks.push(t("risk.lowConfidence"));
  if (indicators.rsi !== null && indicators.rsi >= 70 && score > 0) risks.push(t("risk.overboughtBuy"));
  if (indicators.rsi !== null && indicators.rsi <= 30 && score < 0) risks.push(t("risk.oversoldSell"));
  if (analysis.volatility.regimeKey === "vol.high") {
    risks.push(
      t("risk.highVolatility", { atrPercent: number(analysis.volatility.atrPercent) }),
    );
  }
  if (trade.riskReward < 1.5) {
    risks.push(t("risk.lowRiskReward", { rr: number(trade.riskReward, 2) }));
  }
  // Üst zaman dilimleri ters yöndeyse bu, tek başına en pahalı hatalardan biri.
  if (digerPeriyotlar.length > 0 && score !== 0) {
    const tersler = digerPeriyotlar.filter(
      (tf) => tf.score !== 0 && Math.sign(tf.score) !== Math.sign(score),
    );
    if (tersler.length > 0) {
      risks.push(
        t("risk.timeframeConflict", {
          list: tersler.map((tf) => intervalLabel(t, tf.interval)).join(", "),
        }),
      );
    }
  }
  for (const pattern of analysis.patterns) {
    const conflicting =
      (score > 0 && pattern.bias === "SELL") || (score < 0 && pattern.bias === "BUY");
    if (conflicting) {
      risks.push(t("risk.conflictingPattern", { pattern: patternName(t, pattern.id) }));
    }
  }
  if (instrument.market !== "kripto") risks.push(t("risk.closedMarket"));
  if (analysis.source === "demo") risks.push(t("risk.demoData"));
  if (risks.length === 0) risks.push(t("risk.none"));

  return { headline, paragraphs, highlights, risks };
}

/** Yüzdelik değişimi işaretiyle biçimlendirir (kartlarda kullanılır). */
export function changeText(value: number, locale: Locale): string {
  return formatPercent(value, intlTag(locale));
}

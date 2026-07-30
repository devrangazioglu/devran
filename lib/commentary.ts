/**
 * Analiz sonucunu insan diline çevirir.
 *
 * Şablon tabanlı ve deterministik: aynı veriden her zaman aynı yorum çıkar,
 * harici bir servise ihtiyaç duyulmaz. Metinler sözlükten geldiği için her
 * dilde çalışır (analiz metinleri hazır olmayan dillerde İngilizceye düşer).
 */

import type { Analysis } from "./analysis";
import { intervalLabel, patternName, renderNote } from "./analysis-text";
import { formatNumber, formatPercent, formatPrice } from "./format";
import { intlTag, makeT, type Locale } from "./i18n";

export type Commentary = {
  headline: string;
  /** Sırasıyla: genel görünüm, trend, momentum, hacim/volatilite, seviyeler, plan. */
  paragraphs: string[];
  highlights: string[];
  risks: string[];
};

export function buildCommentary(analysis: Analysis, locale: Locale): Commentary {
  const t = makeT(locale);
  const intl = intlTag(locale);
  const { instrument, signal, score, confidence, indicators, trade, interval } = analysis;

  const asset = instrument.ticker;
  const period = intervalLabel(t, interval);
  const price = (value: number | null) => formatPrice(value, intl);
  const number = (value: number | null, digits = 2) => formatNumber(value, intl, digits);

  const headline = t("commentary.headline", {
    asset,
    interval: period,
    signal: t(`signal.${signal}` as "signal.BUY"),
    score: number(score, 0),
    confidence,
  });

  const paragraphs: string[] = [];

  // 1) Genel görünüm
  paragraphs.push(
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
  );

  // 2) Trend
  const trendParts: string[] = [];
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
  paragraphs.push(t("commentary.trend", { parts: trendParts.join(". ") }));

  // 3) Momentum
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
  if (indicators.stochK !== null) {
    momentumParts.push(t("commentary.momentum.stoch", { k: number(indicators.stochK, 0) }));
  }
  paragraphs.push(t("commentary.momentum", { parts: momentumParts.join(", ") }));

  // 4) Hacim ve volatilite
  const volumeCheck = analysis.checks.find((c) => c.id === "volume");
  const obvCheck = analysis.checks.find((c) => c.id === "obv");
  const volatility =
    t("commentary.volatility", {
      regime: t(analysis.volatility.regimeKey as "vol.normal"),
      atrPercent: number(analysis.volatility.atrPercent),
      interval: period,
      atr: price(trade.atr),
      currency: instrument.currency,
    }) + (analysis.volatility.squeeze ? t("commentary.volatility.squeeze") : "");

  paragraphs.push(
    [obvCheck ? renderNote(t, obvCheck) : null, volumeCheck ? renderNote(t, volumeCheck) : null, volatility]
      .filter(Boolean)
      .join(" "),
  );

  // 5) Seviyeler
  const resistance = analysis.levels.resistances[0];
  const support = analysis.levels.supports[0];
  if (support && resistance) {
    paragraphs.push(
      t("commentary.levels", {
        support: price(support.price),
        supportDistance: number(Math.abs(support.distancePercent)),
        supportTouches: support.strength,
        resistance: price(resistance.price),
        resistanceDistance: number(Math.abs(resistance.distancePercent)),
        resistanceTouches: resistance.strength,
      }),
    );
  } else if (support) {
    paragraphs.push(
      t("commentary.levels.supportOnly", {
        support: price(support.price),
        supportDistance: number(Math.abs(support.distancePercent)),
        supportTouches: support.strength,
      }),
    );
  } else if (resistance) {
    paragraphs.push(
      t("commentary.levels.resistanceOnly", {
        resistance: price(resistance.price),
        resistanceDistance: number(Math.abs(resistance.distancePercent)),
        resistanceTouches: resistance.strength,
      }),
    );
  }

  // 6) Plan
  paragraphs.push(
    (trade.advisory ? t("commentary.plan.advisory") : "") +
      t("commentary.plan", {
        side: t(trade.side === "LONG" ? "commentary.plan.long" : "commentary.plan.short"),
        entry: price(trade.entry),
        stop: price(trade.stopLoss),
        riskPercent: number(trade.riskPercent),
        target: price(trade.targets[0]),
        rr: number(trade.riskReward, 2),
      }),
  );

  // Öne çıkanlar
  const highlights: string[] = [];
  const strongest = [...analysis.checks]
    .sort((a, b) => Math.abs(b.direction * b.weight) - Math.abs(a.direction * a.weight))
    .slice(0, 3);
  for (const check of strongest) {
    highlights.push(`${t(check.labelKey as "ind.rsi")}: ${renderNote(t, check)}`);
  }
  for (const pattern of analysis.patterns.slice(0, 3)) {
    highlights.push(`${patternName(t, pattern.id)} — ${t(`pattern.${pattern.id}.note` as "pattern.doji.note")}`);
  }

  // Riskler
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

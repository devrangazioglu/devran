/**
 * Sade özet: teknik analiz bilmeyen birinin okuyabileceği kısa yorum.
 *
 * Ayrıntılı yorum (`lib/commentary.ts`) göstergeleri tek tek anlatır ve
 * terim bilgisi ister. Bu özet aynı analizden yalnızca üç sorunun cevabını
 * çıkarır: şu an durum ne, buna ne kadar güvenebilirim, neye dikkat etmeliyim.
 * Gösterge adı (RSI, MACD…) geçmez; her cümle günlük dille yazılır.
 */

import { isBuySignal, isSellSignal, type Analysis } from "./analysis";
import { formatNumber, formatPrice } from "./format";
import type { Fundamentals } from "./fundamentals";
import { intlTag, makeT, type Locale } from "./i18n";
import type { Interval } from "./markets/types";

/** Maddenin tonu: arayüzde renkli bir nokta olarak gösterilir. */
export type SadeTon = "up" | "down" | "flat" | "warn" | "info";

export type SadeOzet = {
  ton: SadeTon;
  /** İlk cümle: sinyalin günlük dildeki karşılığı. */
  baslik: string;
  maddeler: { ton: SadeTon; metin: string }[];
  uyari: string;
};

/** Sinyalin geçerli olduğu yaklaşık süre: geçmiş sınamasındaki 10 mumluk ufuk. */
function ufukAnahtari(interval: Interval): string {
  if (interval === "1m" || interval === "5m" || interval === "15m") return "plain.horizon.short";
  if (interval === "30m" || interval === "1h") return "plain.horizon.hours";
  if (interval === "4h") return "plain.horizon.days";
  if (interval === "1d") return "plain.horizon.weeks";
  return "plain.horizon.months";
}

export function sadeOzet(
  analysis: Analysis,
  locale: Locale,
  context: { fundamentals?: Fundamentals | null } = {},
): SadeOzet {
  const t = makeT(locale);
  const intl = intlTag(locale);
  const { signal, confidence, indicators, regime, levels, trade, backtest, instrument } = analysis;
  const sayi = (v: number, basamak = 1) => formatNumber(v, intl, basamak);
  const fiyat = (v: number) => formatPrice(v, intl);

  const yon = isBuySignal(signal) ? 1 : isSellSignal(signal) ? -1 : 0;
  const maddeler: SadeOzet["maddeler"] = [];

  // Güven
  const guvenAnahtari =
    confidence < 45 ? "plain.confidence.low" : confidence < 65 ? "plain.confidence.mid" : "plain.confidence.high";
  maddeler.push({
    ton: confidence < 45 ? "warn" : "info",
    metin: t(guvenAnahtari as "plain.confidence.low", { value: confidence }),
  });

  // Gidişat
  const trendAnahtari = regime.key.replace("regime.", "plain.trend.");
  maddeler.push({
    ton: regime.key === "regime.up" ? "up" : regime.key === "regime.down" ? "down" : "flat",
    metin: t(trendAnahtari as "plain.trend.up"),
  });

  // Aşırılık: yalnızca belirgin olduğunda söylenir.
  if (indicators.rsi !== null && indicators.rsi >= 70) maddeler.push({ ton: "warn", metin: t("plain.hot") });
  else if (indicators.rsi !== null && indicators.rsi <= 30) maddeler.push({ ton: "warn", metin: t("plain.cold") });

  // Takip edilecek fiyatlar
  const destek = levels.supports[0];
  const direnc = levels.resistances[0];
  const uzaklik = (p: number) => sayi(Math.abs(((p - analysis.price) / analysis.price) * 100));
  if (destek && direnc) {
    maddeler.push({
      ton: "info",
      metin: t("plain.levels", {
        support: fiyat(destek.price),
        supportDistance: uzaklik(destek.price),
        resistance: fiyat(direnc.price),
        resistanceDistance: uzaklik(direnc.price),
      }),
    });
  } else if (destek) {
    maddeler.push({
      ton: "info",
      metin: t("plain.support", { support: fiyat(destek.price), supportDistance: uzaklik(destek.price) }),
    });
  } else if (direnc) {
    maddeler.push({
      ton: "info",
      metin: t("plain.resistance", { resistance: fiyat(direnc.price), resistanceDistance: uzaklik(direnc.price) }),
    });
  }

  // Sinyal varsa: nerede geçersiz olur
  if (yon !== 0) {
    maddeler.push({
      ton: "info",
      metin: t(yon > 0 ? "plain.stop.long" : "plain.stop.short", {
        stop: fiyat(trade.stopLoss),
        risk: sayi(trade.riskPercent),
      }),
    });
  }

  // Sinyal yoksa: ne yapmalı
  if (yon === 0) maddeler.push({ ton: "info", metin: t("plain.waitTip") });

  // Geçmişte işe yaradı mı? Az örnekte söylenmez.
  const taraf = yon > 0 ? backtest?.buy : yon < 0 ? backtest?.sell : null;
  if (taraf && taraf.reliable) {
    const anahtar =
      taraf.edge >= 0.05 ? "plain.history.good" : taraf.edge <= -0.05 ? "plain.history.bad" : "plain.history.flat";
    maddeler.push({
      ton: taraf.edge >= 0.05 ? "up" : taraf.edge <= -0.05 ? "warn" : "flat",
      metin: t(anahtar as "plain.history.good", {
        hit: sayi(taraf.hitRate * 100, 0),
        base: sayi(taraf.baseRate * 100, 0),
      }),
    });
  }

  // Şirketin mali durumu
  const temel = context.fundamentals;
  if (temel) {
    const derece = temel.gradeKey.replace("fund.grade.", "plain.fund.");
    maddeler.push({
      ton: temel.score >= 57 ? "up" : temel.score < 43 ? "down" : "flat",
      metin: t("plain.fund", { grade: t(derece as "plain.fund.good"), score: temel.score }),
    });
    if (temel.flags.includes("fund.flag.loss")) maddeler.push({ ton: "warn", metin: t("plain.fund.loss") });
  }

  return {
    ton: yon > 0 ? "up" : yon < 0 ? "down" : "flat",
    baslik: t(`plain.signal.${signal}` as "plain.signal.BUY", {
      asset: instrument.ticker,
      horizon: t(ufukAnahtari(analysis.interval) as "plain.horizon.days"),
    }),
    maddeler,
    uyari: t("plain.disclaimer"),
  };
}

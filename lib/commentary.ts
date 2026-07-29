/**
 * Analiz sonucunu insan diline çevirir.
 *
 * Şablon tabanlı, deterministik bir üretici: aynı veriden her zaman aynı yorum
 * çıkar, harici bir servise ihtiyaç duymaz.
 */

import type { Analysis, IndicatorCheck } from "./analysis";
import { formatNumber, formatPercent, formatPrice } from "./format";

export type Commentary = {
  /** Tek cümlelik özet. */
  headline: string;
  /** Sırasıyla: genel görünüm, trend, momentum, hacim/volatilite, seviyeler, plan. */
  paragraphs: string[];
  /** Madde madde öne çıkanlar. */
  highlights: string[];
  /** Dikkat edilmesi gereken riskler. */
  risks: string[];
};

const SIGNAL_SENTENCE: Record<Analysis["signal"], string> = {
  "GÜÇLÜ AL": "göstergelerin büyük çoğunluğu alış yönünde birleşiyor",
  AL: "göstergeler alış tarafına eğilimli",
  BEKLE: "göstergeler net bir yön vermiyor",
  SAT: "göstergeler satış tarafına eğilimli",
  "GÜÇLÜ SAT": "göstergelerin büyük çoğunluğu satış yönünde birleşiyor",
};

export function buildCommentary(analysis: Analysis): Commentary {
  const { base, quote, intervalLabel, signal, score, confidence, indicators, trade } = analysis;
  const pair = `${base}/${quote}`;

  const headline = `${pair} ${intervalLabel}lik grafikte ${signal} sinyali veriyor (skor ${formatNumber(score, 0)}, güven %${confidence}).`;

  const paragraphs: string[] = [];

  // 1) Genel görünüm
  paragraphs.push(
    `${pair} şu anda ${formatPrice(analysis.price)} ${quote} seviyesinde ve son mumda ${formatPercent(
      analysis.changePercent,
    )} değişim gösterdi. ${intervalLabel}lik zaman diliminde ${SIGNAL_SENTENCE[signal]}: ` +
      `${analysis.tally.al} gösterge alış, ${analysis.tally.sat} gösterge satış, ${analysis.tally.notr} gösterge nötr yönde oy kullandı. ` +
      `Ağırlıklı skor ${formatNumber(score, 1)} (−100 ile +100 arasında) ve modelin bu sinyale güveni %${confidence}.`,
  );

  // 2) Trend
  const trendParts: string[] = [];
  if (indicators.ema50 !== null && indicators.ema200 !== null) {
    trendParts.push(
      indicators.ema50 > indicators.ema200
        ? `EMA 50 (${formatPrice(indicators.ema50)}) EMA 200'ün (${formatPrice(indicators.ema200)}) üzerinde, yani ana trend yukarı yönlü`
        : `EMA 50 (${formatPrice(indicators.ema50)}) EMA 200'ün (${formatPrice(indicators.ema200)}) altında, yani ana trend aşağı yönlü`,
    );
  }
  if (indicators.supertrendDirection !== null) {
    trendParts.push(
      indicators.supertrendDirection === 1
        ? `Supertrend alış tarafında ve ${formatPrice(indicators.supertrend)} seviyesini takip eden destek olarak kullanıyor`
        : `Supertrend satış tarafında ve ${formatPrice(indicators.supertrend)} seviyesi takip eden direnç görevi görüyor`,
    );
  }
  trendParts.push(
    `ADX ${indicators.adx === null ? "hesaplanamadı" : formatNumber(indicators.adx, 1)} ile trendin gücü "${analysis.trendStrength.label}"`,
  );
  paragraphs.push(`Trend tarafında: ${trendParts.join(". ")}.`);

  // 3) Momentum
  const momentumParts: string[] = [];
  if (indicators.rsi !== null) {
    const rsiState =
      indicators.rsi >= 70
        ? "aşırı alım bölgesinde — yükseliş sürse bile geri çekilme riski artıyor"
        : indicators.rsi <= 30
          ? "aşırı satım bölgesinde — tepki alımları için zemin oluşuyor"
          : indicators.rsi > 50
            ? "orta bandın üzerinde, alıcılar hafif önde"
            : "orta bandın altında, satıcılar hafif önde";
    momentumParts.push(`RSI ${formatNumber(indicators.rsi, 1)} ile ${rsiState}`);
  }
  if (indicators.macd !== null && indicators.macdSignal !== null) {
    momentumParts.push(
      indicators.macd > indicators.macdSignal
        ? "MACD sinyal çizgisinin üzerinde seyrediyor (pozitif momentum)"
        : "MACD sinyal çizgisinin altında seyrediyor (negatif momentum)",
    );
  }
  if (indicators.stochK !== null) {
    momentumParts.push(
      `Stokastik %K ${formatNumber(indicators.stochK, 0)} seviyesinde`,
    );
  }
  paragraphs.push(`Momentum tarafında: ${momentumParts.join(", ")}.`);

  // 4) Hacim ve volatilite
  const volumeCheck = analysis.checks.find((c) => c.id === "volume");
  const obvCheck = analysis.checks.find((c) => c.id === "obv");
  const volatilityText =
    `Volatilite ${analysis.volatility.regime} seviyede: ATR, fiyatın %${formatNumber(analysis.volatility.atrPercent)} kadarı; ` +
    `yani ${analysis.intervalLabel}lik bir mumda ortalama ${formatPrice(trade.atr)} ${quote} hareket bekleniyor.` +
    (analysis.volatility.squeeze
      ? " Bollinger bantları son 60 mumun en dar aralığında; sıkışma sonrası sert bir yön hareketi görülebilir."
      : "");
  paragraphs.push(
    [
      obvCheck ? obvCheck.note : null,
      volumeCheck ? volumeCheck.note : null,
      volatilityText,
    ]
      .filter(Boolean)
      .join(" "),
  );

  // 5) Seviyeler
  const resistance = analysis.levels.resistances[0];
  const support = analysis.levels.supports[0];
  const levelSentences: string[] = [];
  if (support) {
    levelSentences.push(
      `En yakın destek ${formatPrice(support.price)} (%${formatNumber(Math.abs(support.distancePercent))} aşağıda, ${support.strength} dokunuşla test edilmiş)`,
    );
  }
  if (resistance) {
    levelSentences.push(
      `en yakın direnç ${formatPrice(resistance.price)} (%${formatNumber(Math.abs(resistance.distancePercent))} yukarıda, ${resistance.strength} dokunuş)`,
    );
  }
  if (levelSentences.length) {
    paragraphs.push(
      `${levelSentences.join(", ")}. Bu seviyelerin kapanış bazında kırılması, mevcut sinyali doğrulayan ya da geçersiz kılan ilk teknik referans olur.`,
    );
  }

  // 6) Plan
  const direction = trade.side === "LONG" ? "uzun (alış)" : "kısa (satış)";
  paragraphs.push(
    (trade.advisory
      ? `Sinyal "BEKLE" olduğu için aşağıdaki plan yalnızca senaryo niteliğindedir; net bir tetikleyici oluşana kadar pozisyon almamak da bir tercihtir. `
      : "") +
      `Skorun yönüne göre ${direction} senaryosunda giriş ${formatPrice(trade.entry)}, zarar durdur ${formatPrice(
        trade.stopLoss,
      )} (%${formatNumber(trade.riskPercent)} risk) ve ilk hedef ${formatPrice(trade.targets[0])} olarak hesaplanıyor; ` +
      `bu, yaklaşık ${formatNumber(trade.riskReward, 2)}:1 risk/ödül oranına karşılık geliyor. Zarar durdur seviyesi son 12 mumun swing noktası ile 1,5×ATR'den daha uzak olanına göre belirlendi.`,
  );

  // Öne çıkanlar
  const highlights: string[] = [];
  const strongest = [...analysis.checks]
    .sort((a, b) => Math.abs(b.direction * b.weight) - Math.abs(a.direction * a.weight))
    .slice(0, 3);
  for (const check of strongest) highlights.push(`${check.name}: ${check.note}`);
  for (const pattern of analysis.patterns.slice(0, 3)) {
    highlights.push(`${pattern.name} — ${pattern.note}`);
  }

  // Riskler
  const risks: string[] = [];
  if (analysis.trendStrength.adx !== null && analysis.trendStrength.adx < 20) {
    risks.push(
      "ADX 20'nin altında: trend zayıf, yatay piyasada kesişim sinyalleri sık yanıltır (whipsaw riski).",
    );
  }
  if (confidence < 45) {
    risks.push("Göstergeler arasında uyum düşük; sinyalin kalıcılığı sınırlı olabilir.");
  }
  if (indicators.rsi !== null && indicators.rsi >= 70 && analysis.score > 0) {
    risks.push("Alış sinyali aşırı alım bölgesinde üretildi; geç giriş riski var.");
  }
  if (indicators.rsi !== null && indicators.rsi <= 30 && analysis.score < 0) {
    risks.push("Satış sinyali aşırı satım bölgesinde üretildi; sert tepki yükselişi gelebilir.");
  }
  if (analysis.volatility.regime === "yüksek") {
    risks.push(
      `Volatilite yüksek (ATR %${formatNumber(analysis.volatility.atrPercent)}); pozisyon boyutu küçültülmeli ve stop mesafesi buna göre ayarlanmalı.`,
    );
  }
  const conflicting = analysis.patterns.filter(
    (p) => p.bias !== "NÖTR" && ((analysis.score > 0 && p.bias === "SAT") || (analysis.score < 0 && p.bias === "AL")),
  );
  for (const pattern of conflicting) {
    risks.push(`${pattern.name} formasyonu genel sinyalin tersi yönde uyarı veriyor.`);
  }
  if (analysis.source === "demo") {
    risks.push(
      "Bu analiz DEMO veriyle üretildi (Binance API'sine ulaşılamadı); rakamlar gerçek piyasayı yansıtmaz.",
    );
  }
  if (risks.length === 0) {
    risks.push("Belirgin bir teknik çelişki tespit edilmedi; yine de risk yönetimi olmadan işlem açmayın.");
  }

  return { headline, paragraphs, highlights, risks };
}

/** Gösterge listesini kategoriye göre gruplar (arayüzde tablo için). */
export function groupChecks(checks: IndicatorCheck[]): { category: string; items: IndicatorCheck[] }[] {
  const order = ["Trend", "Momentum", "Volatilite", "Hacim"];
  return order
    .map((category) => ({ category, items: checks.filter((c) => c.category === category) }))
    .filter((group) => group.items.length > 0);
}

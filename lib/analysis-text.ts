/**
 * Analiz çıktısını (anahtar + parametre) okunabilir metne çevirir.
 * Hem sunucu (yorum motoru) hem tarayıcı (tablolar) bu yardımcıları kullanır.
 */

import type { IndicatorCheck, ValuePart } from "./analysis";
import { formatNumber, formatPercent, formatPrice } from "./format";
import type { DictionaryKey, Params, Translator } from "./i18n";

/** Gösterge açıklamasını çevirir; iç anahtarları (ör. yön) da çözer. */
export function renderNote(t: Translator, check: IndicatorCheck): string {
  const params: Params = { ...(check.noteParams ?? {}) };
  if (typeof params.directionKey === "string") {
    params.direction = t(`note.volume.${params.directionKey}` as DictionaryKey);
    delete params.directionKey;
  }
  return t(check.noteKey as DictionaryKey, params);
}

/** Gösterge değerini aktif dile göre biçimlendirir. */
export function renderValue(parts: ValuePart[], intl: string): string {
  return parts
    .map((part) => {
      switch (part.kind) {
        case "price":
          return formatPrice(part.value, intl);
        case "percent":
          return formatPercent(part.value, intl);
        case "number":
          return formatNumber(part.value, intl, part.digits ?? 2);
        case "text":
          return part.text;
      }
    })
    .join(" ");
}

export function patternName(t: Translator, id: string): string {
  return t(`pattern.${id}.name` as DictionaryKey);
}

export function patternNote(t: Translator, id: string): string {
  return t(`pattern.${id}.note` as DictionaryKey);
}

export function signalLabel(t: Translator, signal: string): string {
  return t(`signal.${signal}` as DictionaryKey);
}

export function verdictLabel(t: Translator, verdict: string): string {
  return t(`verdict.${verdict}` as DictionaryKey);
}

export function intervalLabel(t: Translator, interval: string): string {
  return t(`interval.${interval}` as DictionaryKey);
}

export function categoryLabel(t: Translator, category: string): string {
  return t(`category.${category}` as DictionaryKey);
}

/** Gösterge listesini kategoriye göre gruplar. */
export function groupChecks(
  checks: IndicatorCheck[],
): { category: string; items: IndicatorCheck[] }[] {
  const order = ["trend", "momentum", "volatility", "volume"];
  return order
    .map((category) => ({ category, items: checks.filter((c) => c.category === category) }))
    .filter((group) => group.items.length > 0);
}

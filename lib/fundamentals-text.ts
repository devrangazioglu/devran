/**
 * Temel analiz verisinin metne çevrilmesi — arayüz ve yorum motoru ortak
 * kullanır, böylece aynı oran iki yerde farklı biçimde yazılmaz.
 */

import { formatNumber } from "./format";
import type { Fundamentals, TemelOlcut } from "./fundamentals";
import type { Translator } from "./i18n";

/** Yüzde olarak gelen ölçütler; diğerleri kat sayıdır (F/K 12,4 gibi). */
const YUZDE_OLCUTLER = new Set<string>([
  "roe",
  "netMargin",
  "operatingMargin",
  "revenueGrowth",
  "epsGrowth",
]);

/** Kaynağın İngilizce sektör adını çevirir; çevirisi yoksa olduğu gibi döner. */
export function sectorName(t: Translator, sector: string | null): string {
  if (!sector) return "—";
  const anahtar = `fund.sector.${sector.toLowerCase().replace(/[^a-z]/g, "")}`;
  const metin = t(anahtar as "fund.sector.finance");
  return metin === anahtar ? sector : metin;
}

/** Bir ölçütün değerini birimiyle yazar ("12,40", "%18,3"). */
export function metricValue(id: string, value: number | null, intl: string): string {
  if (value === null) return "—";
  if (YUZDE_OLCUTLER.has(id)) return `%${formatNumber(value, intl, 1)}`;
  return formatNumber(value, intl, 2);
}

/** Zarardaki şirketin F/K'sı sayı değil "zarar" olarak gösterilir. */
export function metricDisplay(t: Translator, metric: TemelOlcut, intl: string): string {
  if (metric.id === "pe" && metric.percentile === 0 && metric.value <= 0) return t("fund.loss");
  return metricValue(metric.id, metric.value, intl);
}

/** Analist ortalamasını (1 = güçlü al … 5 = güçlü sat) etikete çevirir. */
export function analystLabel(t: Translator, rating: number | null): string | null {
  if (rating === null) return null;
  const kademe = rating <= 1.5 ? 1 : rating <= 2.5 ? 2 : rating <= 3.5 ? 3 : rating <= 4.5 ? 4 : 5;
  return t(`fund.analyst.${kademe}` as "fund.analyst.1");
}

/** En yüksek ve en düşük puanlı sütun; ikiden az sütun varsa null. */
export function pillarExtremes(
  fundamentals: Fundamentals,
): { best: Fundamentals["pillars"][number]; worst: Fundamentals["pillars"][number] } | null {
  const dolu = fundamentals.pillars.filter((p) => p.score !== null);
  if (dolu.length < 2) return null;
  const sirali = [...dolu].sort((a, b) => (b.score as number) - (a.score as number));
  return { best: sirali[0], worst: sirali[sirali.length - 1] };
}

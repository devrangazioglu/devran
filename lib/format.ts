/**
 * Sayı, fiyat ve tarih biçimlendirme.
 *
 * Tüm fonksiyonlar bir Intl etiketi (ör. "tr-TR", "en-US") alır; böylece aynı
 * veri her dilde o dilin ondalık ve binlik ayırıcılarıyla gösterilir.
 */

const FALLBACK = "tr-TR";

/** Fiyatı büyüklüğüne göre uygun ondalık basamakla biçimlendirir. */
export function formatPrice(
  value: number | null | undefined,
  locale: string = FALLBACK,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : abs >= 0.01 ? 5 : 8;
  return value.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  });
}

/** Yüzde değeri, işaretiyle birlikte. */
export function formatPercent(
  value: number | null | undefined,
  locale: string = FALLBACK,
  digits = 2,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

/** Sayıyı verilen ondalık basamakla biçimlendirir. */
export function formatNumber(
  value: number | null | undefined,
  locale: string = FALLBACK,
  digits = 2,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Büyük hacimleri kısaltır: 2.4B, 720M. */
export function formatCompact(
  value: number | null | undefined,
  locale: string = FALLBACK,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

/** Zaman damgasını kısa tarih + saat olarak gösterir. */
export function formatTime(ms: number, locale: string = FALLBACK): string {
  return new Date(ms).toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(ms: number, locale: string = FALLBACK): string {
  return new Date(ms).toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** "3 dk önce" tarzı göreli zaman (Intl.RelativeTimeFormat ile yerelleştirilir). */
export function formatRelative(ms: number, locale: string = FALLBACK): string {
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const diffSeconds = Math.round((ms - Date.now()) / 1000);
  const absolute = Math.abs(diffSeconds);

  if (absolute < 60) return formatter.format(Math.round(diffSeconds), "second");
  if (absolute < 3600) return formatter.format(Math.round(diffSeconds / 60), "minute");
  if (absolute < 86_400) return formatter.format(Math.round(diffSeconds / 3600), "hour");
  return formatter.format(Math.round(diffSeconds / 86_400), "day");
}

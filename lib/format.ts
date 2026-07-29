/** Sayı ve fiyat biçimlendirme yardımcıları (Türkçe yerel ayar). */

/** Fiyatı büyüklüğüne göre uygun ondalık basamakla biçimlendirir. */
export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : abs >= 0.01 ? 5 : 8;
  return value.toLocaleString("tr-TR", {
    minimumFractionDigits: abs >= 1000 ? 2 : 2,
    maximumFractionDigits: digits,
  });
}

/** Yüzde değeri, işaretiyle birlikte. */
export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("tr-TR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

/** Sayıyı 2 ondalıkla biçimlendirir. */
export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("tr-TR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Büyük hacimleri kısaltır: 2.4 Mr $, 720 Mn $. */
export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)} Tn`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)} Mr`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)} Mn`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)} B`;
  return value.toFixed(2);
}

/** Zaman damgasını "28 Tem 14:30" biçiminde gösterir. */
export function formatTime(ms: number): string {
  return new Date(ms).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "3 dk önce" tarzı göreli zaman. */
export function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "az önce";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  return `${Math.round(hours / 24)} gün önce`;
}

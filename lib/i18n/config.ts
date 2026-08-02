/** Desteklenen diller ve dil çerezi ayarları. */

export type Locale = "tr" | "en" | "es" | "de" | "fr" | "ru" | "ar" | "zh";

export type LocaleMeta = {
  code: Locale;
  /** Dilin kendi adı. */
  name: string;
  /** Kısa gösterim (dil seçicide). */
  short: string;
  /** Yazım yönü. */
  dir: "ltr" | "rtl";
  /** Sayı/tarih biçimlendirmede kullanılacak BCP-47 etiketi. */
  intl: string;
  /** Analiz metinleri (gösterge yorumları) bu dilde hazır mı? */
  analysis: boolean;
};

export const LOCALES: LocaleMeta[] = [
  { code: "tr", name: "Türkçe", short: "TR", dir: "ltr", intl: "tr-TR", analysis: true },
  { code: "en", name: "English", short: "EN", dir: "ltr", intl: "en-US", analysis: true },
  { code: "es", name: "Español", short: "ES", dir: "ltr", intl: "es-ES", analysis: false },
  { code: "de", name: "Deutsch", short: "DE", dir: "ltr", intl: "de-DE", analysis: false },
  { code: "fr", name: "Français", short: "FR", dir: "ltr", intl: "fr-FR", analysis: false },
  { code: "ru", name: "Русский", short: "RU", dir: "ltr", intl: "ru-RU", analysis: false },
  { code: "ar", name: "العربية", short: "AR", dir: "rtl", intl: "ar", analysis: false },
  { code: "zh", name: "中文", short: "ZH", dir: "ltr", intl: "zh-CN", analysis: false },
];

export const DEFAULT_LOCALE: Locale = "tr";

/** Analiz metinleri henüz çevrilmemiş diller için yedek dil. */
export const ANALYSIS_FALLBACK: Locale = "en";

export const LOCALE_COOKIE = "dil";

export function isLocale(value: string | undefined | null): value is Locale {
  return Boolean(value) && LOCALES.some((l) => l.code === value);
}

export function localeMeta(locale: Locale): LocaleMeta {
  return LOCALES.find((l) => l.code === locale) ?? LOCALES[0];
}

export function intlTag(locale: Locale): string {
  return localeMeta(locale).intl;
}

/**
 * Dilin URL'de taşınması.
 *
 * Dil önce yalnızca çerezle seçiliyordu: sekiz dilin hepsi aynı adreste
 * görünüyordu. Arama motorları çerez göndermediği için bu, Türkçe dışındaki
 * yedi dilin arama sonuçlarında hiç var olmaması demekti — aynı adres bir
 * ziyaretçiye Türkçe, diğerine Almanca görünüyorsa hangisinin indeksleneceği
 * de belirsiz kalır.
 *
 * Bu yüzden her dilin kendi adresi var:
 *   Türkçe (varsayılan) → /piyasa/kripto
 *   diğerleri          → /en/piyasa/kripto, /de/piyasa/kripto …
 *
 * Varsayılan dil öneksiz kalır; böylece mevcut bağlantılar ve paylaşılmış
 * adresler kırılmaz.
 */

import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from "./config";

/** URL öneki alan diller (varsayılan dil öneksiz yayımlanır). */
export const PREFIXED_LOCALES: Locale[] = LOCALES.map((l) => l.code).filter(
  (code) => code !== DEFAULT_LOCALE,
);

/** Verilen dilde bir yolun adresi. `path` her zaman "/" ile başlar. */
export function localeHref(locale: Locale, path: string): string {
  const temiz = path.startsWith("/") ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) return temiz;
  return temiz === "/" ? `/${locale}` : `/${locale}${temiz}`;
}

/** Adresten dili ve dilsiz yolu ayırır: "/en/piyasa/kripto" → en + /piyasa/kripto */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const parcalar = pathname.split("/").filter(Boolean);
  const ilk = parcalar[0];

  if (isLocale(ilk) && ilk !== DEFAULT_LOCALE) {
    const kalan = parcalar.slice(1).join("/");
    return { locale: ilk, path: kalan ? `/${kalan}` : "/" };
  }
  return { locale: DEFAULT_LOCALE, path: pathname || "/" };
}

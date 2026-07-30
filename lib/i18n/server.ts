/** Sunucu tarafında aktif dili çerezden okur. */

import { cookies } from "next/headers";

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { makeT, type Translator } from "./index";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * Sunucu bileşenleri için: aktif dil + çeviri fonksiyonu.
 *
 * Herkese açık sayfalarda dil URL'den gelir ve doğrudan verilir (bkz.
 * `lib/i18n/routing.ts`); üye alanında adres dilsizdir, orada çerez kullanılır.
 */
export async function getI18n(locale?: Locale): Promise<{ locale: Locale; t: Translator }> {
  const secili = locale ?? (await getLocale());
  return { locale: secili, t: makeT(secili) };
}

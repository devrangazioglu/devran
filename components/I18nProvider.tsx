"use client";

import { createContext, useContext, useMemo } from "react";

import {
  DEFAULT_LOCALE,
  intlTag,
  localeMeta,
  makeT,
  type Locale,
  type Translator,
} from "@/lib/i18n";

type I18nValue = {
  locale: Locale;
  /** Çeviri fonksiyonu. */
  t: Translator;
  /** Sayı/tarih biçimlendirmede kullanılacak Intl etiketi. */
  intl: string;
  dir: "ltr" | "rtl";
};

const I18nContext = createContext<I18nValue>({
  locale: DEFAULT_LOCALE,
  t: makeT(DEFAULT_LOCALE),
  intl: intlTag(DEFAULT_LOCALE),
  dir: "ltr",
});

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const value = useMemo<I18nValue>(
    () => ({
      locale,
      t: makeT(locale),
      intl: intlTag(locale),
      dir: localeMeta(locale).dir,
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

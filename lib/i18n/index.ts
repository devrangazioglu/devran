/**
 * Çeviri katmanı.
 *
 * Anahtar bulunamazsa sırayla İngilizce ve Türkçe sözlüğe düşer; böylece
 * kısmen çevrilmiş bir dil eksik anahtarlarda ham anahtar göstermez.
 * `{param}` yer tutucuları verilen değerlerle değiştirilir.
 */

import { ANALYSIS_FALLBACK, DEFAULT_LOCALE, localeMeta, type Locale } from "./config";
import { ar } from "./dictionaries/ar";
import { de } from "./dictionaries/de";
import { en } from "./dictionaries/en";
import { es } from "./dictionaries/es";
import { fr } from "./dictionaries/fr";
import { ru } from "./dictionaries/ru";
import { tr, type Dictionary, type DictionaryKey } from "./dictionaries/tr";
import { zh } from "./dictionaries/zh";

export type { Dictionary, DictionaryKey };
export * from "./config";

const DICTIONARIES: Record<Locale, Partial<Dictionary>> = { tr, en, es, de, fr, ru, ar, zh };

export type Params = Record<string, string | number>;

function fill(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export function translate(locale: Locale, key: DictionaryKey, params?: Params): string {
  const template =
    DICTIONARIES[locale]?.[key] ??
    DICTIONARIES[ANALYSIS_FALLBACK]?.[key] ??
    DICTIONARIES[DEFAULT_LOCALE]?.[key] ??
    key;
  return fill(template, params);
}

export type Translator = (key: DictionaryKey, params?: Params) => string;

/** Bir dil için çeviri fonksiyonu üretir. */
export function makeT(locale: Locale): Translator {
  return (key, params) => translate(locale, key, params);
}

/** Analiz metinleri bu dilde hazır mı? Değilse arayüzde not gösterilir. */
export function analysisReady(locale: Locale): boolean {
  return localeMeta(locale).analysis;
}

/**
 * Piyasa sayfası metinleri.
 *
 * Ana dört piyasanın (kripto, ABD, BIST, emtia) her metni elle yazılmış ve
 * sözlükte kendi anahtarında duruyor. On bir dünya borsası için aynısını
 * yapmak 11 × 10 metin ve sekiz dil demekti; bunun yerine ortak bir şablon
 * kullanılır ve ülkeye özgü bilgiler (ad, endeks, para birimi, gecikme)
 * borsa tanımından doldurulur. Böylece yeni bir ülke metin yazmadan eklenir.
 */

import type { Translator } from "./i18n";
import { borsa } from "./markets/borsalar";
import { dunyaPiyasasi, type MarketMeta } from "./markets/types";

export type PiyasaAlani =
  | "h1"
  | "desc"
  | "aboutTitle"
  | "about"
  | "faq1.q"
  | "faq1.a"
  | "faq2.q"
  | "faq2.a"
  | "faq3.q"
  | "faq3.a";

function doldurulacaklar(t: Translator, market: MarketMeta) {
  return {
    ulke: t(market.labelKey as "market.kripto"),
    endeks: borsa(market.id)?.endeks.ticker ?? "",
    para: market.currency === "GBX" ? t("market.dunya.gbx") : market.currency,
    gecikme:
      market.gecikmeDk > 0
        ? t("market.dunya.gecikmeli", { dk: market.gecikmeDk })
        : t("market.dunya.anlik"),
  };
}

export function piyasaMetni(t: Translator, market: MarketMeta, alan: PiyasaAlani): string {
  // Kısa açıklama her ülke için ayrı yazıldı (öne çıkan şirketler farklı).
  if (!dunyaPiyasasi(market.id) || alan === "desc") {
    return t(`market.${market.id}.${alan}` as "market.kripto.h1");
  }
  return t(`market.dunya.${alan}` as "market.dunya.h1", doldurulacaklar(t, market));
}

export function seoMetni(t: Translator, market: MarketMeta, alan: "title" | "description"): string {
  if (!dunyaPiyasasi(market.id)) return t(`seo.${market.id}.${alan}` as "seo.kripto.title");
  return t(`seo.dunya.${alan}` as "seo.dunya.title", doldurulacaklar(t, market));
}

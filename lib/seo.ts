/**
 * Arama motoru görünürlüğü için ortak yardımcılar.
 *
 * Üç şeyi tek yerde tutar:
 *   • Sitenin mutlak adresi — kanonik bağlantı, site haritası ve paylaşım
 *     görselleri mutlak adres ister; göreli adres verilirse arama motoru
 *     bunları yok sayar.
 *   • Dil alternatifleri (hreflang) — sekiz dilin aynı içeriğin çevirisi
 *     olduğunu söyler; yoksa arama motoru bunları birbirinin kopyası sanar ve
 *     yalnızca birini gösterir.
 *   • Yapılandırılmış veri (JSON-LD) — sonuç sayfasında zengin görünüm
 *     (site içi arama kutusu, SSS açılırları) için.
 */

import { DEFAULT_LOCALE, localeMeta, LOCALES, type Locale } from "./i18n/config";
import { localeHref } from "./i18n/routing";

/**
 * Sitenin genel adresi.
 *
 * `NEXT_PUBLIC_SITE_URL` tanımlıysa o kullanılır (kendi alan adınız). Yoksa
 * Vercel'in ürettiği üretim adresine düşülür; o da yoksa yerel geliştirme
 * adresine. Sonda eğik çizgi bırakılmaz.
 */
export function siteUrl(): string {
  const acik = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (acik) return acik.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}

/** Yolu mutlak adrese çevirir. */
export function mutlakUrl(path: string): string {
  return `${siteUrl()}${path === "/" ? "" : path}`;
}

/**
 * Bir sayfanın kanonik adresi ve dil alternatifleri.
 *
 * `x-default`, dili belli olmayan ziyaretçiye hangi sürümün gösterileceğini
 * söyler; varsayılan dil (Türkçe) bu görevi üstlenir.
 */
export function dilAlternatifleri(path: string, locale: Locale) {
  const languages: Record<string, string> = {};
  for (const meta of LOCALES) {
    languages[meta.code] = mutlakUrl(localeHref(meta.code, path));
  }
  languages["x-default"] = mutlakUrl(localeHref(DEFAULT_LOCALE, path));

  return {
    canonical: mutlakUrl(localeHref(locale, path)),
    languages,
  };
}

/** Open Graph için dil etiketi: "tr_TR", "en_US" … */
export function ogLocale(locale: Locale): string {
  return localeMeta(locale).intl.replace("-", "_");
}

export const SITE_NAME = "Kriptosinyal";

/* ────────────────────────── Yapılandırılmış veri ────────────────────────── */

/**
 * Site kimliği + site içi arama.
 *
 * `SearchAction`, arama sonuçlarında doğrudan site içinde arama yapılabilen
 * bir kutu çıkmasını sağlar.
 */
export function websiteJsonLd(locale: Locale, description: string) {
  const url = mutlakUrl(localeHref(locale, "/"));
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl()}/#website`,
    name: SITE_NAME,
    url,
    description,
    inLanguage: localeMeta(locale).intl,
    publisher: { "@id": `${siteUrl()}/#org` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${mutlakUrl(localeHref(locale, "/ara"))}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function organizationJsonLd(description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteUrl()}/#org`,
    name: SITE_NAME,
    url: siteUrl(),
    description,
    logo: {
      "@type": "ImageObject",
      url: `${siteUrl()}/icon.svg`,
    },
  };
}

export function faqJsonLd(sorular: { soru: string; cevap: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: sorular.map(({ soru, cevap }) => ({
      "@type": "Question",
      name: soru,
      acceptedAnswer: { "@type": "Answer", text: cevap },
    })),
  };
}

export function breadcrumbJsonLd(basamaklar: { ad: string; path: string }[], locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: basamaklar.map((basamak, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: basamak.ad,
      item: mutlakUrl(localeHref(locale, basamak.path)),
    })),
  };
}

/**
 * Piyasa sayfasındaki varlık listesi.
 *
 * Sayfanın gerçekten neyi listelediğini makine okunur biçimde söyler; fiyat
 * uydurmaz, yalnızca varlık adlarını ve bağlantılarını verir.
 */
export function itemListJsonLd(
  ad: string,
  ogeler: { ad: string; path: string }[],
  locale: Locale,
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: ad,
    numberOfItems: ogeler.length,
    itemListElement: ogeler.map((oge, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: oge.ad,
      url: mutlakUrl(localeHref(locale, oge.path)),
    })),
  };
}

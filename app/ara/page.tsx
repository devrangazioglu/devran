/**
 * Herkese açık varlık arama sayfası.
 *
 * İki işe yarar: ziyaretçi menüye girmeden doğrudan bir varlık arayabilir ve
 * arama motorlarına bildirilen site içi arama adresi (`SearchAction`) gerçek
 * bir sayfaya karşılık gelir — çalışmayan bir adres bildirmek zengin sonucun
 * reddedilmesine yol açar.
 *
 * Sonuç sayfalarının kendisi dizine girmez: her sorgu için ayrı bir sayfa
 * indekslenmesi ince içerik yığını üretir.
 */
import Link from "next/link";

import AssetSearch from "@/components/AssetSearch";
import SiteNav from "@/components/SiteNav";
import { AssetAvatar } from "@/components/ui";
import { localeHref } from "@/lib/i18n/routing";
import { getI18n } from "@/lib/i18n/server";
import { searchInstruments } from "@/lib/markets/provider";

export const metadata = {
  title: "Varlık ara",
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

export default async function AramaSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const sorgu = (q ?? "").trim();
  const { t, locale } = await getI18n();
  const yol = (path: string) => localeHref(locale, path);

  const sonuclar = sorgu.length >= 2 ? await searchInstruments(sorgu, 30) : [];

  return (
    <>
      <SiteNav />

      <main className="app-main">
        <div className="container">
          <h1>{t("common.search")}</h1>
          <div style={{ maxWidth: 560, margin: "18px 0 26px" }}>
            <AssetSearch size="large" />
          </div>

          {sorgu.length >= 2 && sonuclar.length === 0 && (
            <p className="muted">{t("common.noResults")}</p>
          )}

          <div className="quote-cards">
            {sonuclar.map((instrument) => (
              <Link
                key={instrument.id}
                href={yol(`/varlik/${instrument.market}/${encodeURIComponent(instrument.symbol)}`)}
                className="quote-card"
              >
                <AssetAvatar ticker={instrument.ticker} market={instrument.market} size={34} />
                <div className="quote-card-main">
                  <strong>{instrument.ticker}</strong>
                  <span className="dim">{instrument.name}</span>
                </div>
                <span className="dim">{t(`market.${instrument.market}` as "market.kripto")}</span>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

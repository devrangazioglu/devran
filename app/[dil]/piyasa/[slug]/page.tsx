import type { Metadata } from "next";
import { notFound } from "next/navigation";

import MarketView from "@/components/pages/MarketView";
import { isLocale, makeT, type Locale } from "@/lib/i18n";
import { PREFIXED_LOCALES } from "@/lib/i18n/routing";
import { marketBySlug, MARKETS, MARKET_IDS } from "@/lib/markets/types";
import { dilAlternatifleri, ogLocale, SITE_NAME } from "@/lib/seo";

export const revalidate = 60;

export function generateStaticParams() {
  return PREFIXED_LOCALES.flatMap((dil) =>
    MARKET_IDS.map((id) => ({ dil, slug: MARKETS[id].slug })),
  );
}

function coz(dil: string): Locale {
  if (!isLocale(dil) || !PREFIXED_LOCALES.includes(dil)) notFound();
  return dil;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ dil: string; slug: string }>;
}): Promise<Metadata> {
  const { dil, slug } = await params;
  const locale = coz(dil);
  const market = marketBySlug(slug);
  if (!market) return { title: SITE_NAME };

  const t = makeT(locale);
  const title = t(`seo.${market.id}.title` as "seo.kripto.title");
  const description = t(`seo.${market.id}.description` as "seo.kripto.description");

  return {
    title,
    description,
    alternates: dilAlternatifleri(`/piyasa/${market.slug}`, locale),
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      locale: ogLocale(locale),
    },
  };
}

export default async function DilliPiyasaSayfasi({
  params,
}: {
  params: Promise<{ dil: string; slug: string }>;
}) {
  const { dil, slug } = await params;
  return <MarketView slug={slug} locale={coz(dil)} />;
}

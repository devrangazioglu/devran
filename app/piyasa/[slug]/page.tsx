import type { Metadata } from "next";

import MarketView from "@/components/pages/MarketView";
import { DEFAULT_LOCALE, makeT } from "@/lib/i18n";
import { marketBySlug, MARKETS, MARKET_IDS } from "@/lib/markets/types";
import { dilAlternatifleri, ogLocale, SITE_NAME } from "@/lib/seo";

export const revalidate = 60;

export function generateStaticParams() {
  return MARKET_IDS.map((id) => ({ slug: MARKETS[id].slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const market = marketBySlug(slug);
  if (!market) return { title: SITE_NAME };

  const t = makeT(DEFAULT_LOCALE);
  const title = t(`seo.${market.id}.title` as "seo.kripto.title");
  const description = t(`seo.${market.id}.description` as "seo.kripto.description");

  return {
    title,
    description,
    alternates: dilAlternatifleri(`/piyasa/${market.slug}`, DEFAULT_LOCALE),
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      locale: ogLocale(DEFAULT_LOCALE),
    },
  };
}

export default async function PiyasaSayfasi({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <MarketView slug={slug} locale={DEFAULT_LOCALE} />;
}

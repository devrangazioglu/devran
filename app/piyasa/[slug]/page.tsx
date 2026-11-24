import type { Metadata } from "next";

import MarketView from "@/components/pages/MarketView";
import { DEFAULT_LOCALE, makeT } from "@/lib/i18n";
import { seoMetni } from "@/lib/piyasa-metni";
import { marketBySlug, MARKETS, AKTIF_MARKET_IDS } from "@/lib/markets/types";
import { dilAlternatifleri, ogLocale, SITE_NAME } from "@/lib/seo";

export const revalidate = 60;

export function generateStaticParams() {
  return AKTIF_MARKET_IDS.map((id) => ({ slug: MARKETS[id].slug }));
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
  const title = seoMetni(t, market, "title");
  const description = seoMetni(t, market, "description");

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

/** Türkçe dışındaki dillerde planlar sayfası: /en/planlar, /de/planlar … */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Plans from "@/components/pages/Plans";
import { isLocale, makeT, type Locale } from "@/lib/i18n";
import { PREFIXED_LOCALES } from "@/lib/i18n/routing";
import { dilAlternatifleri, ogLocale, SITE_NAME } from "@/lib/seo";

export const revalidate = 3600;

export function generateStaticParams() {
  return PREFIXED_LOCALES.map((dil) => ({ dil }));
}

function coz(dil: string): Locale {
  if (!isLocale(dil) || !PREFIXED_LOCALES.includes(dil)) notFound();
  return dil;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ dil: string }>;
}): Promise<Metadata> {
  const locale = coz((await params).dil);
  const t = makeT(locale);
  const title = t("seo.plans.title");
  const description = t("seo.plans.description");

  return {
    title: { absolute: `${title} | ${SITE_NAME}` },
    description,
    alternates: dilAlternatifleri("/planlar", locale),
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      locale: ogLocale(locale),
    },
  };
}

export default async function DilliPlanlar({ params }: { params: Promise<{ dil: string }> }) {
  return <Plans locale={coz((await params).dil)} />;
}

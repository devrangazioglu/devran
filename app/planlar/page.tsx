import type { Metadata } from "next";

import Plans from "@/components/pages/Plans";
import { DEFAULT_LOCALE, makeT } from "@/lib/i18n";
import { dilAlternatifleri, ogLocale, SITE_NAME } from "@/lib/seo";

// Fiyatlar sık değişmez; sayfa saatte bir yeniden üretilir.
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const t = makeT(DEFAULT_LOCALE);
  const title = t("seo.plans.title");
  const description = t("seo.plans.description");

  return {
    title: { absolute: `${title} | ${SITE_NAME}` },
    description,
    alternates: dilAlternatifleri("/planlar", DEFAULT_LOCALE),
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      locale: ogLocale(DEFAULT_LOCALE),
    },
  };
}

export default function PlanlarSayfasi() {
  return <Plans locale={DEFAULT_LOCALE} />;
}

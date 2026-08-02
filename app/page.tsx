import type { Metadata } from "next";

import Landing from "@/components/pages/Landing";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { makeT } from "@/lib/i18n";
import { dilAlternatifleri, ogLocale, SITE_NAME } from "@/lib/seo";

// Tanıtım sayfası dakikada bir yeniden üretilir.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const t = makeT(DEFAULT_LOCALE);
  const title = t("seo.home.title");
  const description = t("seo.home.description");

  return {
    // Ana sayfa başlığında marka önde olsun; şablon kök sayfaya uygulanmadığı
    // için iki dil sürümünde de mutlak başlık verilir.
    title: { absolute: `${SITE_NAME} — ${title}` },
    description,
    alternates: dilAlternatifleri("/", DEFAULT_LOCALE),
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      locale: ogLocale(DEFAULT_LOCALE),
    },
  };
}

export default function AnaSayfa() {
  return <Landing locale={DEFAULT_LOCALE} />;
}

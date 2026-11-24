/**
 * Türkçe dışındaki dillerde tanıtım sayfası: /en, /de, /ar …
 *
 * Varsayılan dil öneksiz kaldığı için burada yalnızca diğer diller karşılanır;
 * "/tr" istenirse 404 döner ve tek kanonik adres korunur.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Landing from "@/components/pages/Landing";
import { isLocale, makeT, type Locale } from "@/lib/i18n";
import { PREFIXED_LOCALES } from "@/lib/i18n/routing";
import { dilAlternatifleri, ogLocale, SITE_NAME } from "@/lib/seo";

export const revalidate = 60;

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
  const title = t("seo.home.title");
  const description = t("seo.home.description");

  return {
    // Ana sayfa başlığında marka önde olsun; şablon kök sayfaya uygulanmadığı
    // için iki dil sürümünde de mutlak başlık verilir.
    title: { absolute: `${SITE_NAME} — ${title}` },
    description,
    alternates: dilAlternatifleri("/", locale),
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      locale: ogLocale(locale),
    },
  };
}

export default async function DilliAnaSayfa({ params }: { params: Promise<{ dil: string }> }) {
  return <Landing locale={coz((await params).dil)} />;
}

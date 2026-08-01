import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";

import Aurora from "@/components/motion/Aurora";
import { DEFAULT_LOCALE, localeMeta } from "@/lib/i18n";
import { splitLocale } from "@/lib/i18n/routing";
import { getLocale } from "@/lib/i18n/server";
import { siteUrl, SITE_NAME } from "@/lib/seo";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  // Kanonik ve paylaşım adresleri mutlak olmak zorunda; taban burada tanımlanır.
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${SITE_NAME} — teknik analiz ve al/sat sinyalleri`,
    // Alt sayfalar kendi başlığını verir, site adı sonuna eklenir.
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Bitcoin, Ethereum ve yüzlerce altcoin için 16 teknik göstergeyi hesaplayıp AL / SAT / BEKLE sinyali üreten ve sonucu sade bir dille yorumlayan analiz platformu.",
  applicationName: SITE_NAME,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // Arama sonucunda uzun açıklama ve büyük görsel önizleme serbest olsun.
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#05070c",
  colorScheme: "dark",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // `<html lang>` sayfanın gerçekten yazıldığı dili söylemeli; yanlışsa arama
  // motoru sayfayı yanlış dilde sınıflandırır ve ekran okuyucu yanlış telaffuz
  // eder. Kural sayfanın türüne göre değişir:
  //   • adreste dil öneki varsa (/en/…) o dil,
  //   • önek yoksa ve sayfa herkese açıksa varsayılan dil (Türkçe),
  //   • üye alanı gibi dilsiz adreslerde kullanıcının çerezdeki tercihi.
  const yol = ((await headers()).get("x-yol") ?? "/").split("?")[0];
  const { locale: adrestekiDil } = splitLocale(yol);
  const herkeseAcik = yol === "/" || yol.startsWith("/piyasa");

  const locale =
    adrestekiDil !== DEFAULT_LOCALE
      ? adrestekiDil
      : herkeseAcik
        ? DEFAULT_LOCALE
        : await getLocale();
  const meta = localeMeta(locale);

  return (
    <html lang={locale} dir={meta.dir}>
      <body>
        <Providers locale={locale}>
          <Aurora />
          {children}
        </Providers>
      </body>
    </html>
  );
}

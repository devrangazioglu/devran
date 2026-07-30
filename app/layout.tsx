import type { Metadata } from "next";

import Aurora from "@/components/motion/Aurora";
import { localeMeta } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kriptosinyal — teknik analiz ve al/sat sinyalleri",
  description:
    "Kripto, Amerikan borsası, Borsa İstanbul, döviz ve emtia verisiyle 16 teknik göstergeyi hesaplayıp AL / SAT / BEKLE sinyali üreten ve sonucu yorumlayan analiz platformu.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
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

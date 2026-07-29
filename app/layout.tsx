import type { Metadata } from "next";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kriptosinyal — Binance teknik analiz ve al/sat sinyalleri",
  description:
    "Binance verileriyle 16 teknik göstergeyi hesaplayıp coinlere AL / SAT / BEKLE sinyali üreten, sonucu Türkçe yorumlayan analiz platformu.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

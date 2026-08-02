"use client";

import { SessionProvider } from "next-auth/react";

import { I18nProvider } from "@/components/I18nProvider";
import type { Locale } from "@/lib/i18n";

export default function Providers({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <I18nProvider locale={locale}>{children}</I18nProvider>
    </SessionProvider>
  );
}

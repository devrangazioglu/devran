import type { Metadata } from "next";

import YasalSayfa from "@/components/pages/YasalSayfa";
import { getI18n } from "@/lib/i18n/server";
import { gizlilikPolitikasi } from "@/lib/yasal";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  const belge = gizlilikPolitikasi(locale);
  return { title: belge.baslik, description: belge.ozet, alternates: { canonical: "/gizlilik" } };
}

/** Gizlilik politikası: App Store / Google Play kaydında istenen adres. */
export default async function GizlilikSayfasi() {
  const { locale } = await getI18n();
  return <YasalSayfa belge={gizlilikPolitikasi(locale)} />;
}

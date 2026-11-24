import type { Metadata } from "next";

import YasalSayfa from "@/components/pages/YasalSayfa";
import { getI18n } from "@/lib/i18n/server";
import { kullanimKosullari } from "@/lib/yasal";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  const belge = kullanimKosullari(locale);
  return { title: belge.baslik, description: belge.ozet, alternates: { canonical: "/kosullar" } };
}

/** Kullanım koşulları (EULA): abonelikli uygulamalarda mağaza bağlantı ister. */
export default async function KosullarSayfasi() {
  const { locale } = await getI18n();
  return <YasalSayfa belge={kullanimKosullari(locale)} />;
}

import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { yoneticiMi } from "@/lib/admin";
import { yonetimVerisi } from "@/lib/yonetim";
import YonetimClient from "./YonetimClient";

export const metadata = {
  title: "Yönetim",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * Yönetim paneli. Yalnızca ADMIN_EPOSTALAR'daki hesaplar görür; diğerleri
 * için sayfa yokmuş gibi 404 döner (varlığı bile belli olmasın).
 *
 * Arayüz yalnızca Türkçe: tek kullanıcısı site sahibi.
 */
export default async function YonetimSayfasi() {
  const session = await auth();
  if (!yoneticiMi(session?.user?.email)) notFound();
  const veri = await yonetimVerisi();
  return <YonetimClient ilk={veri} kendiEpostam={session?.user?.email ?? ""} />;
}

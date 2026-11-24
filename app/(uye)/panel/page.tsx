import { auth } from "@/auth";
import { kullanicidanDurum } from "@/lib/credits";
import { DEFAULT_SETTINGS, findUserByEmail } from "@/lib/users";
import PanelClient from "./PanelClient";

// Üye alanı: içerik kişiye özel, arama sonuçlarında yeri yok.
export const metadata = {
  title: "Panel",
  robots: { index: false, follow: false },
};

export default async function PanelPage() {
  const session = await auth();
  const user = session?.user?.email ? await findUserByEmail(session.user.email) : null;
  const settings = user?.settings ?? DEFAULT_SETTINGS;
  // Planın açtığı periyotlar: kilitli olanlar arayüzde de kilitli görünsün,
  // kullanıcı tıklayıp hata almasın.
  const durum = user ? kullanicidanDurum(user) : null;

  return (
    <PanelClient
      name={user?.name ?? session?.user?.name ?? ""}
      defaultMarket={settings.defaultMarket}
      defaultInterval={settings.defaultInterval}
      watchlist={user?.watchlist ?? []}
      planPeriyotlar={durum?.plan.periyotlar ?? null}
    />
  );
}

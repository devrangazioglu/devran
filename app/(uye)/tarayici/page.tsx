import { auth } from "@/auth";
import { kullanicidanDurum } from "@/lib/credits";
import { DEFAULT_SETTINGS, findUserByEmail } from "@/lib/users";
import ScannerClient from "./ScannerClient";

// Üye alanı: içerik kişiye özel, arama sonuçlarında yeri yok.
export const metadata = {
  title: "Sinyal tarayıcı",
  robots: { index: false, follow: false },
};

export default async function ScannerPage() {
  const session = await auth();
  const user = session?.user?.email ? await findUserByEmail(session.user.email) : null;
  const settings = user?.settings ?? DEFAULT_SETTINGS;
  const durum = user ? kullanicidanDurum(user) : null;

  return (
    <ScannerClient
      defaultMarket={settings.defaultMarket}
      defaultInterval={settings.defaultInterval}
      defaultLimit={settings.scanLimit}
      onlyStrong={settings.onlyStrongSignals}
      watchlist={user?.watchlist ?? []}
      planPeriyotlar={durum?.plan.periyotlar ?? null}
      planTaramaSiniri={durum?.plan.taramaSiniri ?? null}
    />
  );
}

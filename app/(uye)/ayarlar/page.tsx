import { auth } from "@/auth";
import { DEFAULT_SETTINGS, findUserByEmail } from "@/lib/users";
import SettingsClient from "./SettingsClient";

// Üye alanı: içerik kişiye özel, arama sonuçlarında yeri yok.
export const metadata = {
  title: "Ayarlar",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const session = await auth();
  const user = session?.user?.email ? await findUserByEmail(session.user.email) : null;

  return (
    <SettingsClient
      email={session?.user?.email ?? ""}
      name={user?.name ?? session?.user?.name ?? ""}
      createdAt={user?.createdAt ?? null}
      watchlistCount={user?.watchlist.length ?? 0}
      settings={user?.settings ?? DEFAULT_SETTINGS}
      hasPassword={Boolean(user?.passwordHash)}
    />
  );
}

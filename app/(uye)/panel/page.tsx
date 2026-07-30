import { auth } from "@/auth";
import { DEFAULT_SETTINGS, findUserByEmail } from "@/lib/users";
import PanelClient from "./PanelClient";

export const metadata = { title: "Panel — Kriptosinyal" };

export default async function PanelPage() {
  const session = await auth();
  const user = session?.user?.email ? await findUserByEmail(session.user.email) : null;
  const settings = user?.settings ?? DEFAULT_SETTINGS;

  return (
    <PanelClient
      name={user?.name ?? session?.user?.name ?? ""}
      defaultMarket={settings.defaultMarket}
      defaultInterval={settings.defaultInterval}
      watchlist={user?.watchlist ?? []}
    />
  );
}

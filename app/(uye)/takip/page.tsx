import { auth } from "@/auth";
import { DEFAULT_SETTINGS, findUserByEmail } from "@/lib/users";
import WatchlistClient from "./WatchlistClient";

export const metadata = { title: "Takip listem — Kriptosinyal" };

export default async function WatchlistPage() {
  const session = await auth();
  const user = session?.user?.email ? await findUserByEmail(session.user.email) : null;

  return (
    <WatchlistClient
      initialIds={user?.watchlist ?? []}
      defaultInterval={user?.settings.defaultInterval ?? DEFAULT_SETTINGS.defaultInterval}
    />
  );
}

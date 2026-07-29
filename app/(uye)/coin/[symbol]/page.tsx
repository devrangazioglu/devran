import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { normalizeSymbol } from "@/lib/binance";
import { DEFAULT_SETTINGS, findUserByEmail } from "@/lib/users";
import CoinClient from "./CoinClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  return { title: `${symbol.toUpperCase()} analizi — Kriptosinyal` };
}

export default async function CoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ interval?: string }>;
}) {
  const { symbol: raw } = await params;
  const { interval } = await searchParams;
  const symbol = normalizeSymbol(decodeURIComponent(raw));
  if (!symbol) notFound();

  const session = await auth();
  const user = session?.user?.email ? await findUserByEmail(session.user.email) : null;

  return (
    <CoinClient
      symbol={symbol}
      initialInterval={interval ?? user?.settings.defaultInterval ?? DEFAULT_SETTINGS.defaultInterval}
      inWatchlist={(user?.watchlist ?? []).includes(symbol)}
    />
  );
}

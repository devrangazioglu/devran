import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { getInstrument, normalizeSymbol } from "@/lib/markets/provider";
import { instrumentId, isMarketId, MARKETS } from "@/lib/markets/types";
import { DEFAULT_SETTINGS, findUserByEmail } from "@/lib/users";
import AssetClient from "./AssetClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ market: string; symbol: string }>;
}) {
  const { symbol } = await params;
  // Üye alanı: analiz sayfası kişiye özel ayarlarla üretilir, dizine girmez.
  return {
    title: decodeURIComponent(symbol).toUpperCase(),
    robots: { index: false, follow: false },
  };
}

export default async function AssetPage({
  params,
  searchParams,
}: {
  params: Promise<{ market: string; symbol: string }>;
  searchParams: Promise<{ interval?: string }>;
}) {
  const { market: marketParam, symbol: symbolParam } = await params;
  const { interval } = await searchParams;

  if (!isMarketId(marketParam)) notFound();
  const symbol = normalizeSymbol(marketParam, decodeURIComponent(symbolParam));
  if (!symbol) notFound();

  const [session, instrument] = await Promise.all([
    auth(),
    getInstrument(marketParam, symbol),
  ]);
  const user = session?.user?.email ? await findUserByEmail(session.user.email) : null;
  const settings = user?.settings ?? DEFAULT_SETTINGS;

  const supported = MARKETS[marketParam].intervals;
  const requested = interval && supported.includes(interval as never) ? interval : null;
  const preferred = supported.includes(settings.defaultInterval as never)
    ? settings.defaultInterval
    : supported[supported.length - 2];

  return (
    <AssetClient
      instrument={instrument}
      initialInterval={requested ?? preferred}
      inWatchlist={(user?.watchlist ?? []).includes(instrumentId(marketParam, symbol))}
    />
  );
}

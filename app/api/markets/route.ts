import { NextResponse } from "next/server";

import { getQuotes } from "@/lib/markets/provider";
import { isMarketId, MarketDataError } from "@/lib/markets/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const marketParam = searchParams.get("market") ?? "kripto";
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 40), 1), 60);

  if (!isMarketId(marketParam)) {
    return NextResponse.json({ error: "Geçersiz piyasa." }, { status: 400 });
  }

  try {
    const { quotes, source, updatedAt } = await getQuotes(marketParam, limit);
    return NextResponse.json({
      market: marketParam,
      source,
      updatedAt,
      quotes: quotes.slice(0, limit),
    });
  } catch (error) {
    const status = error instanceof MarketDataError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Piyasa verisi alınamadı." },
      { status },
    );
  }
}

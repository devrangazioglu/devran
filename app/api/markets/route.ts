import { NextResponse } from "next/server";

import { BinanceError, fetchMarkets } from "@/lib/binance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const quote = (searchParams.get("quote") ?? "USDT").toUpperCase();
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 50), 1), 200);

  try {
    const { tickers, source } = await fetchMarkets(quote);
    return NextResponse.json({
      source,
      updatedAt: Date.now(),
      tickers: tickers.slice(0, limit),
    });
  } catch (error) {
    const status = error instanceof BinanceError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Piyasa verisi alınamadı." },
      { status },
    );
  }
}

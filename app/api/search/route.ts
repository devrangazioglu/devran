import { NextResponse } from "next/server";

import { searchInstruments } from "@/lib/markets/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").slice(0, 40);

  if (query.trim().length < 1) return NextResponse.json({ results: [] });

  try {
    return NextResponse.json({ results: await searchInstruments(query, 12) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Arama yapılamadı." },
      { status: 500 },
    );
  }
}

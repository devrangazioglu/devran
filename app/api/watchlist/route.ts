import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { normalizeSymbol } from "@/lib/binance";
import { getWatchlist, toggleWatchlist, UserStoreError } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  return NextResponse.json({ watchlist: await getWatchlist(email) });
}

export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { symbol?: unknown } | null;
  const symbol = typeof body?.symbol === "string" ? normalizeSymbol(body.symbol) : null;
  if (!symbol) return NextResponse.json({ error: "Geçersiz sembol." }, { status: 400 });

  try {
    const result = await toggleWatchlist(email, symbol);
    if (!result) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UserStoreError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("Takip listesi hatası:", error);
    return NextResponse.json(
      { error: `Sunucu hatası: ${error instanceof Error ? error.message : "bilinmeyen hata"}` },
      { status: 500 },
    );
  }
}

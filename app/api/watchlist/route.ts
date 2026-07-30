import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { normalizeSymbol } from "@/lib/markets/provider";
import { parseInstrumentId } from "@/lib/markets/types";
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

  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const parsed = typeof body?.id === "string" ? parseInstrumentId(body.id) : null;
  const symbol = parsed ? normalizeSymbol(parsed.market, parsed.symbol) : null;
  if (!parsed || !symbol) {
    return NextResponse.json({ error: "Geçersiz varlık kimliği." }, { status: 400 });
  }

  try {
    const result = await toggleWatchlist(email, `${parsed.market}:${symbol}`);
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

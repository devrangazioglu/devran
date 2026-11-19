import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { kullanicidanDurum } from "@/lib/credits";
import { normalizeSymbol } from "@/lib/markets/provider";
import { marketAktif, parseInstrumentId } from "@/lib/markets/types";
import { findUserByEmail, getWatchlist, toggleWatchlist, UserStoreError } from "@/lib/users";

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
  if (!marketAktif(parsed.market)) {
    return NextResponse.json({ error: "Bu piyasa şu anda kapalı." }, { status: 404 });
  }

  try {
    const kullanici = await findUserByEmail(email).catch(() => null);
    const durum = kullanici ? kullanicidanDurum(kullanici) : null;

    const result = await toggleWatchlist(
      email,
      `${parsed.market}:${symbol}`,
      durum?.plan.takipSiniri,
    );
    if (!result) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    if (result.limitAsildi) {
      return NextResponse.json(
        {
          error: `${durum?.plan.ad} planında takip listesi ${durum?.plan.takipSiniri} varlıkla sınırlı. Planlar sayfasından yükseltebilirsiniz.`,
          kod: "plan-takip",
        },
        { status: 403 },
      );
    }
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

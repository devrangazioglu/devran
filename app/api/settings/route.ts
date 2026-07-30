import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isInterval, isMarketId } from "@/lib/markets/types";
import { DEFAULT_SETTINGS, findUserByEmail, saveSettings, UserStoreError } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const user = await findUserByEmail(email);
  return NextResponse.json({ settings: user?.settings ?? DEFAULT_SETTINGS });
}

export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });

  const patch: Parameters<typeof saveSettings>[1] = {};

  if (typeof body.defaultInterval === "string" && isInterval(body.defaultInterval)) {
    patch.defaultInterval = body.defaultInterval;
  }
  if (typeof body.defaultMarket === "string" && isMarketId(body.defaultMarket)) {
    patch.defaultMarket = body.defaultMarket;
  }
  if (typeof body.scanLimit === "number" && Number.isFinite(body.scanLimit)) {
    patch.scanLimit = Math.min(Math.max(Math.round(body.scanLimit), 5), 60);
  }
  if (typeof body.onlyStrongSignals === "boolean") {
    patch.onlyStrongSignals = body.onlyStrongSignals;
  }

  try {
    const user = await saveSettings(email, patch);
    if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    return NextResponse.json({ settings: user.settings });
  } catch (error) {
    if (error instanceof UserStoreError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("Ayar kaydetme hatası:", error);
    return NextResponse.json(
      { error: `Sunucu hatası: ${error instanceof Error ? error.message : "bilinmeyen hata"}` },
      { status: 500 },
    );
  }
}

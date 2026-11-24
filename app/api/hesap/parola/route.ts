import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { changePassword, UserStoreError } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Parola değiştirme (parolasız Google/Apple hesabında parola ekleme). */
export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const sinir = rateLimit(`parola:${email}`, 5, 15 * 60_000);
  if (!sinir.allowed) {
    return NextResponse.json({ error: "Çok fazla deneme. Biraz sonra tekrar deneyin." }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { mevcut?: unknown; yeni?: unknown } | null;
  const mevcut = typeof body?.mevcut === "string" ? body.mevcut : "";
  const yeni = typeof body?.yeni === "string" ? body.yeni : "";
  try {
    const sonuc = await changePassword(email, mevcut, yeni);
    if (!sonuc.ok) return NextResponse.json({ error: sonuc.error }, { status: sonuc.status });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UserStoreError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("Parola değiştirilemedi:", error);
    return NextResponse.json({ error: "Parola değiştirilemedi." }, { status: 500 });
  }
}

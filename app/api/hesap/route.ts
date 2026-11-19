import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { deleteAccount, UserStoreError } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hesabı siler.
 *
 * App Store (5.1.1-v) ve Google Play, hesap açılabilen her uygulamada
 * hesabın uygulamanın içinden silinebilmesini şart koşuyor. Silme geri
 * dönüşsüzdür; arayüz önce onay ister, sunucu parolayı (ya da parolasız
 * hesapta e-postayı) yeniden doğrular. Oturum çerezini istemci kapatır.
 */
export async function DELETE(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  // Parola deneme yoluna dönmesin.
  const sinir = rateLimit(`hesap-sil:${email}`, 5, 15 * 60_000);
  if (!sinir.allowed) {
    return NextResponse.json({ error: "Çok fazla deneme. Biraz sonra tekrar deneyin." }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { parola?: unknown; eposta?: unknown } | null;
  try {
    const sonuc = await deleteAccount(email, {
      parola: typeof body?.parola === "string" ? body.parola : undefined,
      eposta: typeof body?.eposta === "string" ? body.eposta : undefined,
    });
    if (!sonuc.ok) return NextResponse.json({ error: sonuc.error }, { status: sonuc.status });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UserStoreError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("Hesap silinemedi:", error);
    return NextResponse.json({ error: "Hesap silinemedi." }, { status: 500 });
  }
}

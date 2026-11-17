import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { yoneticiMi } from "@/lib/admin";
import { denemeBaslat, planDegistir } from "@/lib/credits";
import { isFaturalama, isPlanId } from "@/lib/plans";
import { UserStoreError } from "@/lib/users";
import { bonusVer, denemeSifirla, yonetimVerisi } from "@/lib/yonetim";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Yönetici değilse uç nokta yokmuş gibi davranır (404). */
async function yonetici(): Promise<string | null> {
  const email = (await auth())?.user?.email ?? null;
  return yoneticiMi(email) ? email : null;
}

export async function GET() {
  if (!(await yonetici())) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  try {
    return NextResponse.json(await yonetimVerisi());
  } catch (error) {
    if (error instanceof UserStoreError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("Yönetim verisi okunamadı:", error);
    return NextResponse.json({ error: "Veri okunamadı." }, { status: 500 });
  }
}

/**
 * Yönetici işlemleri:
 *   { islem: "plan", email, plan, faturalama? }   — planı değiştir (ödemesiz)
 *   { islem: "bonus", email, miktar }              — ek kredi ver / geri al
 *   { islem: "deneme", email }                     — 7 gün Premium denemesi başlat
 *   { islem: "deneme-sifirla", email }             — deneme hakkını geri ver
 */
export async function POST(request: Request) {
  if (!(await yonetici())) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const email = typeof body?.email === "string" ? body.email : "";
  if (!email) return NextResponse.json({ error: "E-posta gerekli." }, { status: 400 });

  try {
    switch (body?.islem) {
      case "plan": {
        if (!isPlanId(body.plan)) return NextResponse.json({ error: "Geçersiz plan." }, { status: 400 });
        await planDegistir(email, body.plan, isFaturalama(body.faturalama) ? body.faturalama : "aylik");
        break;
      }
      case "bonus": {
        const miktar = Number(body.miktar);
        if (!Number.isFinite(miktar) || miktar === 0 || Math.abs(miktar) > 100_000) {
          return NextResponse.json({ error: "Geçersiz miktar." }, { status: 400 });
        }
        if (!(await bonusVer(email, miktar))) {
          return NextResponse.json({ error: "Üye bulunamadı." }, { status: 404 });
        }
        break;
      }
      case "deneme": {
        const sonuc = await denemeBaslat(email);
        if (!sonuc.ok) {
          return NextResponse.json({ error: `Deneme başlatılamadı (${sonuc.sebep}).` }, { status: 409 });
        }
        break;
      }
      case "deneme-sifirla": {
        if (!(await denemeSifirla(email))) {
          return NextResponse.json({ error: "Üye bulunamadı." }, { status: 404 });
        }
        break;
      }
      default:
        return NextResponse.json({ error: "Bilinmeyen işlem." }, { status: 400 });
    }
    return NextResponse.json(await yonetimVerisi());
  } catch (error) {
    if (error instanceof UserStoreError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("Yönetim işlemi başarısız:", error);
    return NextResponse.json({ error: "İşlem başarısız." }, { status: 500 });
  }
}

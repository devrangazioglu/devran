import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { abonelikDurumu, krediOzeti, planDegistir } from "@/lib/credits";
import { odemeAcik, odemeTestModu } from "@/lib/odeme";
import { isPlanId, plan } from "@/lib/plans";
import { UserStoreError } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Kullanıcının planı ve kalan kredisi. */
export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  return NextResponse.json({
    ozet: krediOzeti(await abonelikDurumu(email)),
    odemeAcik: odemeAcik() || odemeTestModu(),
  });
}

/**
 * Plan değişimi.
 *
 * Ücretsiz plana dönmek her zaman serbesttir (aboneliği bırakmak). Ücretli
 * plana geçiş ödeme ister: sağlayıcı bağlı değilken sessizce plan yükseltmek,
 * kullanıcıya ödemediği bir hizmeti vermek ve ileride geri almak demek olurdu.
 */
export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { plan?: unknown } | null;
  if (!isPlanId(body?.plan)) {
    return NextResponse.json({ error: "Geçersiz plan." }, { status: 400 });
  }
  const secilen = body.plan;

  if (secilen !== "ucretsiz" && !odemeAcik() && !odemeTestModu()) {
    return NextResponse.json(
      {
        error:
          "Ödeme sağlayıcısı henüz bağlı değil, bu yüzden ücretli planlara şu anda geçilemiyor. " +
          "Bağlandığında bu sayfadan tek adımda yükseltebileceksiniz.",
        kod: "odeme-kapali",
      },
      { status: 503 },
    );
  }

  try {
    const durum = await planDegistir(email, secilen);
    return NextResponse.json({
      ozet: krediOzeti(durum),
      odemeAcik: odemeAcik() || odemeTestModu(),
      mesaj: `Planınız ${plan(secilen).ad} olarak güncellendi.`,
    });
  } catch (error) {
    if (error instanceof UserStoreError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("Plan değiştirilemedi:", error);
    return NextResponse.json({ error: "Plan değiştirilemedi." }, { status: 500 });
  }
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { DAVET_CEREZI, yeniHesapKarsila } from "@/lib/credits";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { gecerliDavetKodu } from "@/lib/users-shared";
import { createUser, saveSettings, UserStoreError } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Aynı IP'den 10 dakikada en fazla 5 kayıt denemesi.
  const limit = rateLimit(`register:${clientIp(request)}`, 5, 10 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Çok fazla kayıt denemesi yapıldı. Lütfen birkaç dakika sonra tekrar deneyin." },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const { email, password, name, kabul } = (body ?? {}) as {
    email?: unknown;
    password?: unknown;
    name?: unknown;
    kabul?: unknown;
  };

  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "E-posta ve parola zorunludur." }, { status: 400 });
  }
  // Koşulların açık onayı olmadan hesap açılmaz (onay anı kayda yazılır).
  if (kabul !== true) {
    return NextResponse.json(
      { error: "Devam etmek için kullanım koşullarını ve yasal uyarıyı onaylayın." },
      { status: 400 },
    );
  }

  try {
    const result = await createUser({
      email,
      password,
      name: typeof name === "string" ? name : undefined,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    // Davet bağlantısıyla geldiyse ödül (hoş geldin kredisi kayıtla birlikte verilir).
    await saveSettings(result.user.email, { kosulOnayi: Date.now() }).catch(() => null);
    const davet = (await cookies()).get(DAVET_CEREZI)?.value;
    await yeniHesapKarsila(result.user.email, gecerliDavetKodu(davet) ? davet : null);

    return NextResponse.json({ user: result.user }, { status: 201 });
  } catch (error) {
    if (error instanceof UserStoreError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    // Beklenmedik hata da JSON olarak dönsün ki arayüz gerçek sebebi gösterebilsin.
    console.error("Kayıt hatası:", error);
    return NextResponse.json(
      {
        error: `Sunucu hatası: ${error instanceof Error ? error.message : "bilinmeyen hata"}`,
      },
      { status: 500 },
    );
  }
}

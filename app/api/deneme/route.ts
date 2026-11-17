import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { denemeBaslat, krediOzeti } from "@/lib/credits";
import { UserStoreError } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 7 günlük ücretsiz Premium denemesini başlatır (hesap başına bir kez). */
export async function POST() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  try {
    const sonuc = await denemeBaslat(email);
    if (!sonuc.ok) {
      const mesaj =
        sonuc.sebep === "kullanildi"
          ? "Ücretsiz deneme bu hesapta daha önce kullanıldı."
          : sonuc.sebep === "ucretli"
            ? "Zaten ücretli bir plandasınız."
            : "Hesap bulunamadı.";
      return NextResponse.json({ error: mesaj, kod: sonuc.sebep }, { status: 409 });
    }
    return NextResponse.json({ ozet: krediOzeti(sonuc.durum) });
  } catch (error) {
    if (error instanceof UserStoreError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("Deneme başlatılamadı:", error);
    return NextResponse.json({ error: "Deneme başlatılamadı." }, { status: 500 });
  }
}

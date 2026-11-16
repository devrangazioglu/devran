/**
 * Sinyal günlüğü: günlük kayıt ve değerlendirme (zamanlanmış görev).
 *
 * Vercel günde iki kez çağırır (bkz. `vercel.json`); ikinci çağrı, ilki süre
 * sınırına takıldıysa kaldığı yerden devam eder. İşlem idempotenttir: aynı gün
 * ve varlık iki kez yazılmaz, sonuçlar bir kez doldurulur. Bu yüzden ucu
 * başkasının çağırması kayıtları bozamaz; yine de `CRON_SECRET` tanımlıysa
 * yalnızca Vercel'in görevi kabul edilir.
 */

import { NextResponse } from "next/server";

import { gunlukCalisma } from "@/lib/sinyal-gunlugu";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const sir = process.env.CRON_SECRET?.trim();
  if (sir) {
    if (request.headers.get("authorization") !== `Bearer ${sir}`) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
    }
  } else {
    // Sır tanımlı değilse uç açık kalır ama sık çağrılamaz.
    const limiter = rateLimit(`sinyal-gunlugu:${clientIp(request)}`, 3, 60 * 60_000);
    if (!limiter.allowed) {
      return NextResponse.json({ error: "Çok sık çağrıldı." }, { status: 429 });
    }
  }

  try {
    const sonuc = await gunlukCalisma(45_000);
    return NextResponse.json(sonuc, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kayıt yapılamadı." },
      { status: 500 },
    );
  }
}

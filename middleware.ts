import { NextResponse, type NextRequest } from "next/server";

import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";

/**
 * Dilsiz sayfalar: yalnızca öneksiz adreste var, dili çerezden okur.
 *
 * Herkese açık sayfalardaki bağlantılar dilin önekini taşıyor (`/en/kayit`);
 * bu sayfaların dilli kopyası olmadığı için o adres 404 veriyordu. Önekli
 * istek öneksiz adrese yönlendirilir ve dil çereze yazılır, böylece sayfa
 * kullanıcının geldiği dilde açılır.
 */
const DILSIZ = /^\/([a-z]{2})(\/(?:giris|kayit|gizlilik|kosullar|destek)(?:\/.*)?)$/;

/**
 * İstenen yolu bir istek başlığına yazar.
 *
 * Next.js sunucu bileşenlerine (layout dahil) geçerli yolu vermediği için üye
 * alanı düzeni, oturum yoksa kullanıcıyı nereye geri götüreceğini buradan
 * öğrenir: `/giris?devam=/varlik/abd/AAPL`.
 *
 * Oturum denetimi burada değil, `app/(uye)/layout.tsx` içinde yapılır; böylece
 * kullanıcı deposu (pg, scrypt) kenar (edge) çalışma zamanına taşınmaz.
 */
export function middleware(request: NextRequest) {
  const eslesme = DILSIZ.exec(request.nextUrl.pathname);
  if (eslesme && isLocale(eslesme[1])) {
    const hedef = request.nextUrl.clone();
    hedef.pathname = eslesme[2];
    const yanit = NextResponse.redirect(hedef);
    yanit.cookies.set(LOCALE_COOKIE, eslesme[1], { path: "/", maxAge: 31_536_000, sameSite: "lax" });
    return yanit;
  }

  const headers = new Headers(request.headers);
  headers.set("x-yol", request.nextUrl.pathname + request.nextUrl.search);
  const yanit = NextResponse.next({ request: { headers } });

  // Davet bağlantısı (?davet=kod): kod, kayıt anına kadar çerezde taşınır;
  // ziyaretçi önce siteyi gezip sonra kaydolsa da ödül kaybolmaz.
  const davet = request.nextUrl.searchParams.get("davet");
  if (davet && /^[0-9a-f]{10}$/.test(davet)) {
    yanit.cookies.set("davet", davet, { path: "/", maxAge: 30 * 86_400, sameSite: "lax" });
  }
  return yanit;
}

/**
 * Tüm sayfalar eşlenir: üye alanı geri dönüş adresini, kök düzen ise
 * `<html lang>` için adresteki dili buradan öğrenir. Statik dosyalar ve API
 * uçları dışarıda bırakılır.
 */
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|sw.js|manifest.webmanifest|ikon/|apple-icon.png|cevrimdisi.html).*)",
  ],
};

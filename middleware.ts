import { NextResponse, type NextRequest } from "next/server";

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
  const headers = new Headers(request.headers);
  headers.set("x-yol", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/panel", "/tarayici", "/takip", "/ayarlar", "/varlik/:path*"],
};

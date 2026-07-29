import { redirect } from "next/navigation";

import { auth } from "@/auth";
import AppNav from "@/components/AppNav";

/** Üye alanı: oturum yoksa giriş sayfasına yönlendirir. */
export default async function MemberLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session?.user) redirect("/giris");

  return (
    <div className="app-shell">
      <AppNav />
      <main className="app-main">
        <div className="container container-wide">{children}</div>
      </main>
      <footer className="footer">
        <div className="container container-wide">
          <p className="disclaimer" style={{ marginTop: 0 }}>
            Buradaki sinyaller, skorlar ve seviyeler geçmiş fiyat verisinden otomatik olarak
            hesaplanır; yatırım tavsiyesi değildir. Veriler Binance Spot API&apos;sinden
            alınır ve gecikmeli olabilir.
          </p>
        </div>
      </footer>
    </div>
  );
}

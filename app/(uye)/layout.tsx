import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import AppNav from "@/components/AppNav";
import MobileTabBar from "@/components/MobileTabBar";
import { getI18n } from "@/lib/i18n/server";
import { safeNextPath, withNextPath } from "@/lib/next-path";

/** Üye alanı: oturum yoksa giriş sayfasına yönlendirir. */
export default async function MemberLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [session, { t }, headerList] = await Promise.all([auth(), getI18n(), headers()]);
  if (!session?.user) {
    // Girişten sonra kullanıcı istediği sayfaya dönsün (bkz. middleware.ts).
    redirect(withNextPath("/giris", safeNextPath(headerList.get("x-yol"))));
  }

  return (
    <div className="app-shell">
      <AppNav />
      <main className="app-main has-tabbar">
        <div className="container container-wide">{children}</div>
      </main>
      <footer className="footer">
        <div className="container container-wide">
          <p className="disclaimer" style={{ marginTop: 0 }}>
            {t("footer.disclaimerShort")}
          </p>
        </div>
      </footer>
      <MobileTabBar />
    </div>
  );
}

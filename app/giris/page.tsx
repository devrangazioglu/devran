import Link from "next/link";
import { redirect } from "next/navigation";

import { auth, googleAuthEnabled } from "@/auth";
import ConfigWarning from "@/components/ConfigWarning";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { getI18n } from "@/lib/i18n/server";
import { safeNextPath, withNextPath } from "@/lib/next-path";
import LoginForm from "./LoginForm";

/**
 * Bu sayfa arama motoru için değersiz: içeriği kişiye özel ya da ham teşhis
 * verisi. `follow` açık bırakılır, böylece içindeki bağlantılar taranmaya
 * devam eder ama sayfanın kendisi sonuçlarda çıkmaz.
 */
export const metadata = {
  title: "Giriş",
  robots: { index: false, follow: true },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ devam?: string }>;
}) {
  const [session, { t }, params] = await Promise.all([auth(), getI18n(), searchParams]);
  // Üye alanından yönlendirildiyse girişten sonra o sayfaya dönülür.
  const next = safeNextPath(params.devam);
  if (session?.user) redirect(next);

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-head">
          <Link href="/" className="logo">
            <span className="logo-mark">◉</span>
            <span>
              Kripto<em>sinyal</em>
            </span>
          </Link>
          <LanguageSwitcher compact />
        </div>
        <h1>{t("auth.loginTitle")}</h1>
        <p className="sub">{t("auth.loginSub")}</p>
        <ConfigWarning />
        <LoginForm googleEnabled={googleAuthEnabled} next={next} />
        <p className="muted auth-alt">
          {t("auth.noAccount")}{" "}
          <Link href={withNextPath("/kayit", next)} style={{ color: "var(--accent)" }}>
            {t("auth.registerLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}

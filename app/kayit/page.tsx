import Link from "next/link";
import { redirect } from "next/navigation";

import { auth, googleAuthEnabled } from "@/auth";
import ConfigWarning from "@/components/ConfigWarning";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { getI18n } from "@/lib/i18n/server";
import { safeNextPath, withNextPath } from "@/lib/next-path";
import RegisterForm from "./RegisterForm";

/**
 * Bu sayfa arama motoru için değersiz: içeriği kişiye özel ya da ham teşhis
 * verisi. `follow` açık bırakılır, böylece içindeki bağlantılar taranmaya
 * devam eder ama sayfanın kendisi sonuçlarda çıkmaz.
 */
export const metadata = {
  title: "Kayıt",
  robots: { index: false, follow: true },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ devam?: string }>;
}) {
  const [session, { t }, params] = await Promise.all([auth(), getI18n(), searchParams]);
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
        <h1>{t("auth.registerTitle")}</h1>
        <p className="sub">{t("auth.registerSub")}</p>
        <ConfigWarning />
        <RegisterForm googleEnabled={googleAuthEnabled} next={next} />
        <p className="muted auth-alt">
          {t("auth.haveAccount")}{" "}
          <Link href={withNextPath("/giris", next)} style={{ color: "var(--accent)" }}>
            {t("auth.loginLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}

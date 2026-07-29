import Link from "next/link";
import { redirect } from "next/navigation";

import { auth, googleAuthEnabled } from "@/auth";
import ConfigWarning from "@/components/ConfigWarning";
import LoginForm from "./LoginForm";

export const metadata = { title: "Giriş yap — Kriptosinyal" };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/panel");

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <Link href="/" className="logo" style={{ marginBottom: 22 }}>
          <span className="logo-mark">₿</span>
          <span>
            Kripto<em>sinyal</em>
          </span>
        </Link>
        <h1>Tekrar hoş geldiniz</h1>
        <p className="sub">Analiz paneline erişmek için giriş yapın.</p>
        <ConfigWarning />
        <LoginForm googleEnabled={googleAuthEnabled} />
        <p className="muted" style={{ fontSize: 13, marginTop: 20, textAlign: "center" }}>
          Hesabınız yok mu?{" "}
          <Link href="/kayit" style={{ color: "var(--accent)" }}>
            Ücretsiz kayıt olun
          </Link>
        </p>
      </div>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";

import { auth, googleAuthEnabled } from "@/auth";
import RegisterForm from "./RegisterForm";

export const metadata = { title: "Kayıt ol — Kriptosinyal" };

export default async function RegisterPage() {
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
        <h1>Ücretsiz hesap açın</h1>
        <p className="sub">
          Takip listeniz ve analiz tercihleriniz hesabınıza kaydedilir.
        </p>
        <RegisterForm googleEnabled={googleAuthEnabled} />
        <p className="muted" style={{ fontSize: 13, marginTop: 20, textAlign: "center" }}>
          Zaten üye misiniz?{" "}
          <Link href="/giris" style={{ color: "var(--accent)" }}>
            Giriş yapın
          </Link>
        </p>
      </div>
    </div>
  );
}

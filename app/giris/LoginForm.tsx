"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", { email, password, redirect: false });

    setLoading(false);
    if (result?.error) {
      // "CredentialsSignin" yanlış bilgi demektir; diğer hatalar (ör. veritabanına
      // ulaşılamaması) sunucu sorunudur — kullanıcıyı yanlış yönlendirmeyelim.
      setError(
        result.error === "CredentialsSignin"
          ? "E-posta veya parola hatalı."
          : `Giriş yapılamadı: sunucu tarafında bir sorun oluştu (${result.error}). Sunucu günlüklerini kontrol edin.`,
      );
      return;
    }
    router.push("/panel");
    router.refresh();
  }

  return (
    <>
      {error && <div className="notice notice-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">E-posta</label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ornek@eposta.com"
          />
        </div>
        <div className="field">
          <label htmlFor="password">Parola</label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
          {loading ? <span className="spinner" /> : null}
          {loading ? "Giriş yapılıyor…" : "Giriş yap"}
        </button>
      </form>

      {googleEnabled && (
        <>
          <div className="divider">veya</div>
          <button
            className="btn btn-ghost btn-block"
            onClick={() => signIn("google", { callbackUrl: "/panel" })}
          >
            Google ile devam et
          </button>
        </>
      )}
    </>
  );
}

"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Parola en az 8 karakter olmalı.");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Kayıt tamamlanamadı.");
      setLoading(false);
      return;
    }

    // Kayıttan sonra doğrudan giriş yap.
    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);

    if (result?.error) {
      setError("Hesap oluşturuldu ancak otomatik giriş yapılamadı. Giriş sayfasını deneyin.");
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
          <label htmlFor="name">Ad (isteğe bağlı)</label>
          <input
            id="name"
            className="input"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Adınız"
          />
        </div>
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
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="En az 8 karakter"
          />
        </div>
        <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
          {loading ? <span className="spinner" /> : null}
          {loading ? "Hesap oluşturuluyor…" : "Hesap oluştur"}
        </button>
      </form>

      {googleEnabled && (
        <>
          <div className="divider">veya</div>
          <button
            className="btn btn-ghost btn-block"
            onClick={() => signIn("google", { callbackUrl: "/panel" })}
          >
            Google ile kayıt ol
          </button>
        </>
      )}

      <p className="dim" style={{ fontSize: 12, marginTop: 16, lineHeight: 1.6 }}>
        Kayıt olarak, uygulamanın yatırım tavsiyesi vermediğini ve üretilen sinyallerin
        yalnızca teknik analiz amaçlı olduğunu kabul etmiş olursunuz.
      </p>
    </>
  );
}

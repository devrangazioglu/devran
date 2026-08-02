"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useI18n } from "@/components/I18nProvider";
import OAuthButtons from "@/components/OAuthButtons";

export default function RegisterForm({
  googleEnabled,
  appleEnabled,
  next = "/panel",
}: {
  googleEnabled: boolean;
  appleEnabled: boolean;
  next?: string;
}) {
  const { t } = useI18n();
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
      setError(t("auth.shortPassword"));
      return;
    }

    setLoading(true);
    let response: Response;
    try {
      response = await fetch("/api/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
    } catch {
      setError(t("auth.networkError"));
      setLoading(false);
      return;
    }

    if (!response.ok) {
      // Yanıt JSON değilse durum kodunu ve gövdenin başını göster.
      const raw = await response.text().catch(() => "");
      let message: string | null = null;
      try {
        message = (JSON.parse(raw) as { error?: string }).error ?? null;
      } catch {
        // JSON değil.
      }
      setError(
        message ?? `${t("auth.registerFailed")} (HTTP ${response.status}) ${raw.slice(0, 160)}`,
      );
      setLoading(false);
      return;
    }

    // Kayıttan sonra doğrudan giriş yap.
    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);

    if (result?.error) {
      setError(t("auth.autoLoginFailed"));
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <>
      {error && <div className="notice notice-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="name">{t("auth.name")}</label>
          <input
            id="name"
            className="input"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("auth.namePlaceholder")}
          />
        </div>
        <div className="field">
          <label htmlFor="email">{t("auth.email")}</label>
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
          <label htmlFor="password">{t("auth.password")}</label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("auth.passwordPlaceholder")}
          />
        </div>
        <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
          {loading ? <span className="spinner" /> : null}
          {loading ? t("auth.registering") : t("auth.register")}
        </button>
      </form>

      <OAuthButtons google={googleEnabled} apple={appleEnabled} next={next} kayit />

      <p className="dim" style={{ fontSize: 12, marginTop: 16, lineHeight: 1.6 }}>
        {t("auth.registerTerms")}
      </p>
    </>
  );
}

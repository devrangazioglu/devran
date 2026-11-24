"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useI18n } from "@/components/I18nProvider";
import OAuthButtons from "@/components/OAuthButtons";

export default function LoginForm({
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
      setError(
        result.error === "CredentialsSignin"
          ? t("auth.badCredentials")
          : t("auth.serverProblem", { code: result.error }),
      );
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
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
          {loading ? <span className="spinner" /> : null}
          {loading ? t("auth.loggingIn") : t("auth.login")}
        </button>
      </form>

      <OAuthButtons google={googleEnabled} apple={appleEnabled} next={next} />
    </>
  );
}

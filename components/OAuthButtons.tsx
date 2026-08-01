"use client";

/**
 * Google ve Apple ile giriş düğmeleri.
 *
 * Düğmeler yalnızca ilgili sağlayıcının anahtarları tanımlıysa çizilir
 * (bkz. `auth.ts`); hiçbiri yoksa bölüm tümüyle gizlenir, böylece kullanıcı
 * çalışmayan bir seçenek görmez.
 *
 * Markaların kullanım kuralları logoyu istiyor: metin yerine simgeyle
 * göstermek hem tanıdık hem de dilden bağımsız.
 */

import { signIn } from "next-auth/react";

import { useI18n } from "./I18nProvider";

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false">
      <path d="M16.36 12.68c-.02-2.3 1.88-3.4 1.96-3.45-1.07-1.56-2.73-1.78-3.32-1.8-1.42-.14-2.77.83-3.49.83-.72 0-1.83-.81-3-.79-1.55.02-2.98.9-3.77 2.28-1.6 2.79-.41 6.92 1.15 9.18.76 1.11 1.67 2.35 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.39 0 1.78.74 3 .72 1.24-.02 2.02-1.12 2.78-2.24.87-1.28 1.23-2.53 1.25-2.59-.03-.01-2.4-.92-2.42-3.66zM14.1 5.9c.63-.77 1.06-1.83.94-2.9-.91.04-2.01.61-2.66 1.37-.58.67-1.09 1.75-.96 2.79 1.02.08 2.05-.52 2.68-1.26z" />
    </svg>
  );
}

export default function OAuthButtons({
  google,
  apple,
  next = "/panel",
  kayit = false,
}: {
  google: boolean;
  apple: boolean;
  next?: string;
  /** Kayıt sayfasında metin "… ile kaydol" olur. */
  kayit?: boolean;
}) {
  const { t } = useI18n();
  if (!google && !apple) return null;

  return (
    <>
      <div className="divider">{t("auth.or")}</div>
      <div className="oauth-buttons">
        {google && (
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={() => signIn("google", { callbackUrl: next })}
          >
            <GoogleIcon />
            {kayit ? t("auth.googleRegister") : t("auth.google")}
          </button>
        )}
        {apple && (
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={() => signIn("apple", { callbackUrl: next })}
          >
            <AppleIcon />
            {kayit ? t("auth.appleRegister") : t("auth.apple")}
          </button>
        )}
      </div>
    </>
  );
}

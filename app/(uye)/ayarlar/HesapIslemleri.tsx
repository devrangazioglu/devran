"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useState } from "react";

import { useI18n } from "@/components/I18nProvider";

/**
 * Hesap işlemleri: parola, çıkış ve hesap silme.
 *
 * Hesap silme mağazaların zorunlu tuttuğu bir adım (App Store 5.1.1-v,
 * Google Play hesap silme politikası). Geri dönüşsüz olduğu için iki adımlı:
 * önce neyin silineceği anlatılır, sonra parola (Google/Apple hesabında
 * e-posta) yeniden istenir.
 */
export default function HesapIslemleri({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  const { t } = useI18n();

  const [parolaAcik, setParolaAcik] = useState(false);
  const [mevcut, setMevcut] = useState("");
  const [yeni, setYeni] = useState("");
  const [parolaDurum, setParolaDurum] = useState<{ ok: boolean; metin: string } | null>(null);
  const [parolaBekliyor, setParolaBekliyor] = useState(false);

  const [silAcik, setSilAcik] = useState(false);
  const [onay, setOnay] = useState("");
  const [silHata, setSilHata] = useState<string | null>(null);
  const [siliniyor, setSiliniyor] = useState(false);

  async function parolaKaydet(event: React.FormEvent) {
    event.preventDefault();
    setParolaBekliyor(true);
    setParolaDurum(null);
    const yanit = await fetch("/api/hesap/parola", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mevcut, yeni }),
    }).catch(() => null);
    const govde = (await yanit?.json().catch(() => null)) as { error?: string } | null;
    setParolaBekliyor(false);
    if (!yanit?.ok) {
      setParolaDurum({ ok: false, metin: govde?.error ?? t("common.error") });
      return;
    }
    setParolaDurum({ ok: true, metin: t("account.passwordChanged") });
    setMevcut("");
    setYeni("");
  }

  async function hesabiSil() {
    setSiliniyor(true);
    setSilHata(null);
    const yanit = await fetch("/api/hesap", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(hasPassword ? { parola: onay } : { eposta: onay }),
    }).catch(() => null);
    if (!yanit?.ok) {
      const govde = (await yanit?.json().catch(() => null)) as { error?: string } | null;
      setSilHata(govde?.error ?? t("common.error"));
      setSiliniyor(false);
      return;
    }
    // Kayıt silindi; oturum çerezini de kapat ve tanıtım sayfasına dön.
    await signOut({ callbackUrl: "/" });
  }

  return (
    <div className="card" id="hesap">
      <div className="card-title">{t("account.manage")}</div>

      <div className="hesap-islemleri">
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => setParolaAcik((v) => !v)}>
          {hasPassword ? t("account.changePassword") : t("account.addPassword")}
        </button>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => signOut({ callbackUrl: "/" })}>
          {t("nav.logout")}
        </button>
      </div>

      {parolaAcik && (
        <form onSubmit={parolaKaydet} className="stack" style={{ marginTop: 14, gap: 10 }}>
          {hasPassword && (
            <div className="field">
              <label htmlFor="mevcut-parola">{t("account.currentPassword")}</label>
              <input
                id="mevcut-parola"
                className="input"
                type="password"
                autoComplete="current-password"
                value={mevcut}
                onChange={(e) => setMevcut(e.target.value)}
                required
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="yeni-parola">{t("account.newPassword")}</label>
            <input
              id="yeni-parola"
              className="input"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={yeni}
              onChange={(e) => setYeni(e.target.value)}
              required
            />
          </div>
          {parolaDurum && (
            <div className={`notice ${parolaDurum.ok ? "" : "notice-error"}`}>{parolaDurum.metin}</div>
          )}
          <button className="btn btn-primary btn-sm" type="submit" disabled={parolaBekliyor}>
            {parolaBekliyor ? <span className="spinner" /> : null} {t("settings.save")}
          </button>
        </form>
      )}

      <div className="hesap-sil">
        {!silAcik ? (
          <button className="btn btn-danger btn-sm" type="button" onClick={() => setSilAcik(true)}>
            {t("account.delete")}
          </button>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            <strong>{t("account.deleteTitle")}</strong>
            <p className="muted" style={{ fontSize: 13 }}>
              {t("account.deleteText")}
            </p>
            <div className="field">
              <label htmlFor="sil-onay">
                {hasPassword ? t("account.deleteConfirmPassword") : t("account.deleteConfirmEmail", { email })}
              </label>
              <input
                id="sil-onay"
                className="input"
                type={hasPassword ? "password" : "email"}
                autoComplete={hasPassword ? "current-password" : "off"}
                value={onay}
                onChange={(e) => setOnay(e.target.value)}
              />
            </div>
            {silHata && <div className="notice notice-error">{silHata}</div>}
            <div className="hesap-islemleri">
              <button
                className="btn btn-danger btn-sm"
                type="button"
                disabled={siliniyor || !onay}
                onClick={hesabiSil}
              >
                {siliniyor ? <span className="spinner" /> : null} {t("account.deleteForever")}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={() => {
                  setSilAcik(false);
                  setOnay("");
                  setSilHata(null);
                }}
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
        <Link href="/gizlilik">{t("legal.privacy")}</Link> · <Link href="/kosullar">{t("legal.terms")}</Link> ·{" "}
        <Link href="/destek">{t("legal.support")}</Link>
      </p>
    </div>
  );
}

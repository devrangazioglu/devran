"use client";

import Link from "next/link";
import { useState } from "react";

import { useI18n } from "./I18nProvider";

/**
 * İlk analizde bir kez gösterilen yasal uyarı.
 *
 * Kayıt formundaki onay kutusunu görmeden gelen kullanıcılar (Google/Apple
 * ile giriş, eski hesaplar) da analizi görmeden önce "yatırım danışmanlığı
 * değildir" beyanını onaylar. Onay anı sunucuda hesaba yazılır; pencere bir
 * daha açılmaz.
 */
export default function IlkUyari() {
  const { t } = useI18n();
  const [acik, setAcik] = useState(true);
  const [bekliyor, setBekliyor] = useState(false);

  async function onayla() {
    setBekliyor(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kosulOnayi: true }),
    }).catch(() => null);
    setAcik(false);
  }

  if (!acik) return null;
  return (
    <div className="ilk-uyari-arka" role="dialog" aria-modal="true" aria-labelledby="ilk-uyari-baslik">
      <div className="ilk-uyari card">
        <h2 id="ilk-uyari-baslik">{t("consent.modalTitle")}</h2>
        <ul className="bullet-list">
          <li>{t("consent.point1")}</li>
          <li>{t("consent.point2")}</li>
          <li>{t("consent.point3")}</li>
        </ul>
        <p className="muted" style={{ fontSize: 13 }}>
          <Link href="/kosullar" target="_blank" style={{ color: "var(--accent)" }}>
            {t("legal.terms")}
          </Link>
          {" · "}
          <Link href="/gizlilik" target="_blank" style={{ color: "var(--accent)" }}>
            {t("legal.privacy")}
          </Link>
        </p>
        <button className="btn btn-primary btn-block" type="button" onClick={onayla} disabled={bekliyor}>
          {bekliyor ? <span className="spinner" /> : null} {t("consent.accept")}
        </button>
      </div>
    </div>
  );
}

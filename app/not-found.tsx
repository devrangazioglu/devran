import Link from "next/link";

import { LogoMark } from "@/components/Logo";
import { getI18n } from "@/lib/i18n/server";

/** Bulunamayan sayfa: Next'in İngilizce varsayılan ekranı yerine. */
export default async function BulunamadiSayfasi() {
  const { t } = await getI18n();
  return (
    <main className="auth-wrap">
      <div className="auth-card" style={{ textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <LogoMark />
        </div>
        <p className="mono dim" style={{ fontSize: 40, margin: 0 }}>404</p>
        <h1>{t("notFound.title")}</h1>
        <p className="sub">{t("notFound.text")}</p>
        <Link href="/" className="btn btn-primary" style={{ marginTop: 12 }}>
          {t("notFound.home")}
        </Link>
      </div>
    </main>
  );
}

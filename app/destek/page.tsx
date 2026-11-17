import type { Metadata } from "next";
import Link from "next/link";

import { LogoWord } from "@/components/Logo";
import SiteNav from "@/components/SiteNav";
import YasalBaglantilar from "@/components/YasalBaglantilar";
import { getI18n } from "@/lib/i18n/server";
import { faqJsonLd } from "@/lib/seo";
import { destekSss, yasalKimlik } from "@/lib/yasal";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("legal.support"), description: t("support.sub"), alternates: { canonical: "/destek" } };
}

/**
 * Destek sayfası: mağaza kaydındaki "Support URL".
 *
 * Sık sorulan sorular önce gelir; çoğu soru (iptal, hesap silme, gecikme)
 * burada yanıtlanınca e-postaya gerek kalmıyor.
 */
export default async function DestekSayfasi() {
  const { t, locale } = await getI18n();
  const sss = destekSss(locale);
  const { eposta } = yasalKimlik();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(sss)) }}
      />
      <SiteNav locale={locale} />
      <main className="app-main">
        <div className="container yasal">
          <h1>{t("legal.support")}</h1>
          <p className="yasal-ozet">{t("support.sub")}</p>

          <div className="faq" style={{ marginTop: 24 }}>
            {sss.map((madde) => (
              <details key={madde.soru}>
                <summary>{madde.soru}</summary>
                <p>{madde.cevap}</p>
              </details>
            ))}
          </div>

          <div className="card" style={{ marginTop: 28 }}>
            <div className="card-title">{t("support.contactTitle")}</div>
            {eposta ? (
              <p>
                {t("support.contactText")}{" "}
                <a href={`mailto:${eposta}`} style={{ color: "var(--accent)" }}>
                  {eposta}
                </a>
              </p>
            ) : (
              <p className="muted">{t("support.contactSoon")}</p>
            )}
            <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
              {t("support.deleteHint")}{" "}
              <Link href="/ayarlar#hesap" style={{ color: "var(--accent)" }}>
                {t("nav.settings")}
              </Link>
            </p>
          </div>
        </div>
      </main>
      <footer className="footer">
        <div className="container">
          <div className="footer-inner">
            <Link href="/" className="logo">
              <LogoWord />
            </Link>
            <YasalBaglantilar t={t} />
          </div>
          <p className="disclaimer">
            <strong>{t("footer.legalTitle")}</strong> {t("footer.legal")}
          </p>
        </div>
      </footer>
    </>
  );
}

import Link from "next/link";

import { LogoWord } from "@/components/Logo";
import Reveal from "@/components/motion/Reveal";
import PlanCards from "@/components/PlanCards";
import SiteNav from "@/components/SiteNav";
import { auth } from "@/auth";
import { getI18n } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n";
import { localeHref } from "@/lib/i18n/routing";
import { PLAN_IDS, PLANS } from "@/lib/plans";
import { breadcrumbJsonLd, faqJsonLd, planJsonLd } from "@/lib/seo";

/**
 * Herkese açık planlar sayfası.
 *
 * Fiyatın yanında kredinin ne olduğu da anlatılır: "9,99 dolar" tek başına
 * bir şey söylemiyor, "600 analiz" söylüyor.
 */
export default async function Plans({ locale: istenen }: { locale?: Locale } = {}) {
  const [{ t, locale }, session] = await Promise.all([getI18n(istenen), auth()]);
  const yol = (path: string) => localeHref(locale, path);
  const girisli = Boolean(session?.user);

  const sss = ([1, 2, 3, 4] as const).map((n) => ({
    soru: t(`plans.faq.q${n}` as "plans.faq.q1"),
    cevap: t(`plans.faq.a${n}` as "plans.faq.a1"),
  }));

  const yapisalVeri = [
    planJsonLd(
      t("plans.title"),
      t("plans.sub"),
      PLAN_IDS.map((id) => ({ ad: PLANS[id].ad, ucret: PLANS[id].ucret })),
      locale,
    ),
    faqJsonLd(sss),
    breadcrumbJsonLd(
      [
        { ad: t("nav.home"), path: "/" },
        { ad: t("plans.title"), path: "/planlar" },
      ],
      locale,
    ),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(yapisalVeri) }}
      />

      <SiteNav locale={locale} />

      <main className="app-main">
        <div className="container">
          <Reveal>
            <div className="hero-center" style={{ paddingTop: 24 }}>
              <span className="pill pill-accent">{t("nav.plans")}</span>
              <h1 className="hero-title" style={{ fontSize: "clamp(28px, 4vw, 44px)" }}>
                {t("plans.title")}
              </h1>
              <p className="lead">{t("plans.sub")}</p>
            </div>
          </Reveal>

          <Reveal delay={80}>
            {/* Girişli kullanıcı doğrudan abonelik sayfasına gider; oradan plan
                değiştirilebiliyor. */}
            <PlanCards kayitHref={girisli ? "/abonelik" : yol("/kayit")} />
          </Reveal>

          <section className="section">
            <Reveal>
              <h2 className="section-title">{t("plans.creditTitle")}</h2>
              <p className="section-sub">{t("plans.creditSub")}</p>
            </Reveal>
            <Reveal delay={60}>
              <div className="card" style={{ marginTop: 24 }}>
                <ul className="bullet-list">
                  {([1, 2, 3, 4, 5] as const).map((n) => (
                    <li key={n}>{t(`plans.credit.${n}` as "plans.credit.1")}</li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </section>

          <section className="section" id="sss">
            <Reveal>
              <h2 className="section-title">{t("home.faqTitle")}</h2>
            </Reveal>
            <div className="faq" style={{ marginTop: 30 }}>
              {sss.map((madde, index) => (
                <Reveal key={madde.soru} delay={index * 50}>
                  <details>
                    <summary>{madde.soru}</summary>
                    <p>{madde.cevap}</p>
                  </details>
                </Reveal>
              ))}
            </div>
          </section>
        </div>
      </main>

      <footer className="footer">
        <div className="container">
          <div className="footer-inner">
            <div className="logo">
              <LogoWord />
            </div>
            <nav className="footer-links">
              <Link href={yol("/")}>{t("nav.home")}</Link>
              <Link href={yol("/planlar")}>{t("nav.plans")}</Link>
              <Link href={yol("/giris")}>{t("nav.login")}</Link>
            </nav>
          </div>
          <p className="disclaimer">
            <strong>{t("footer.legalTitle")}</strong> {t("footer.legal")}
          </p>
        </div>
      </footer>
    </>
  );
}

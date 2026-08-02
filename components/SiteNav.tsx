import Link from "next/link";

import { auth } from "@/auth";
import LanguageSwitcher from "./LanguageSwitcher";
import { LogoWord } from "./Logo";
import MobileMenu from "./MobileMenu";
import { getI18n } from "@/lib/i18n/server";
import { localeHref } from "@/lib/i18n/routing";
import type { Locale } from "@/lib/i18n";
import { MARKETS, AKTIF_MARKET_IDS } from "@/lib/markets/types";

/**
 * Herkese açık sayfaların üst menüsü.
 *
 * Dil URL'den gelir: menüdeki her bağlantı aynı dilde kalmalı, yoksa
 * ziyaretçi İngilizce sayfadan Türkçe sayfaya düşer ve arama motoru dil
 * sürümleri arasında kopuk bir bağlantı ağı görür.
 */
export default async function SiteNav({ locale: istenen }: { locale?: Locale } = {}) {
  const [session, { t, locale }] = await Promise.all([auth(), getI18n(istenen)]);
  const yol = (path: string) => localeHref(locale, path);

  const marketLinks = AKTIF_MARKET_IDS.map((id) => ({
    href: yol(`/piyasa/${MARKETS[id].slug}`),
    label: t(`market.${id}` as "market.kripto"),
  }));

  const menuLinks = [
    ...marketLinks,
    { href: yol("/planlar"), label: t("nav.plans") },
    { href: `${yol("/")}#nasil`, label: t("nav.how") },
    { href: `${yol("/")}#sss`, label: t("nav.faq") },
    ...(session?.user
      ? [{ href: "/panel", label: t("nav.panel") }]
      : [
          { href: yol("/giris"), label: t("nav.login") },
          { href: yol("/kayit"), label: t("nav.register") },
        ]),
  ];

  return (
    <header className="nav">
      <div className="container container-wide nav-inner">
        <Link href={yol("/")} className="logo">
          <LogoWord />
        </Link>

        <nav className="nav-links">
          {marketLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
          <Link href={yol("/planlar")}>{t("nav.plans")}</Link>
          <a href={`${yol("/")}#nasil`}>{t("nav.how")}</a>
          <a href={`${yol("/")}#sss`}>{t("nav.faq")}</a>
        </nav>

        <div className="nav-actions">
          <span className="only-desktop">
            <LanguageSwitcher compact />
          </span>
          {session?.user ? (
            <Link href="/panel" className="btn btn-primary btn-sm">
              {t("nav.goPanel")}
            </Link>
          ) : (
            <>
              <Link href={yol("/giris")} className="btn btn-ghost btn-sm only-desktop">
                {t("nav.login")}
              </Link>
              <Link href={yol("/kayit")} className="btn btn-primary btn-sm">
                {t("nav.register")}
              </Link>
            </>
          )}
          <span className="only-mobile">
            <MobileMenu links={menuLinks} />
          </span>
        </div>
      </div>
    </header>
  );
}

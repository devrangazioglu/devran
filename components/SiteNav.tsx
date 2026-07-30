import Link from "next/link";

import { auth } from "@/auth";
import LanguageSwitcher from "./LanguageSwitcher";
import MobileMenu from "./MobileMenu";
import { getI18n } from "@/lib/i18n/server";
import { MARKETS, MARKET_IDS } from "@/lib/markets/types";

/** Herkese açık sayfaların üst menüsü. */
export default async function SiteNav() {
  const [session, { t }] = await Promise.all([auth(), getI18n()]);

  const marketLinks = MARKET_IDS.map((id) => ({
    href: `/piyasa/${MARKETS[id].slug}`,
    label: t(`market.${id}` as "market.kripto"),
  }));

  const menuLinks = [
    ...marketLinks,
    { href: "/#nasil", label: t("nav.how") },
    { href: "/#sss", label: t("nav.faq") },
    ...(session?.user
      ? [{ href: "/panel", label: t("nav.panel") }]
      : [
          { href: "/giris", label: t("nav.login") },
          { href: "/kayit", label: t("nav.register") },
        ]),
  ];

  return (
    <header className="nav">
      <div className="container container-wide nav-inner">
        <Link href="/" className="logo">
          <span className="logo-mark">◉</span>
          <span>
            Kripto<em>sinyal</em>
          </span>
        </Link>

        <nav className="nav-links">
          {marketLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
          <a href="/#nasil">{t("nav.how")}</a>
          <a href="/#sss">{t("nav.faq")}</a>
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
              <Link href="/giris" className="btn btn-ghost btn-sm only-desktop">
                {t("nav.login")}
              </Link>
              <Link href="/kayit" className="btn btn-primary btn-sm">
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

import Link from "next/link";

import { LogoMark } from "./Logo";

import { auth } from "@/auth";
import AssetSearch from "./AssetSearch";
import LanguageSwitcher from "./LanguageSwitcher";
import MobileMenu from "./MobileMenu";
import SignOutButton from "./SignOutButton";
import { getI18n } from "@/lib/i18n/server";
import { MARKETS, MARKET_IDS } from "@/lib/markets/types";

/** Üye alanının üst menüsü. */
export default async function AppNav() {
  const [session, { t }] = await Promise.all([auth(), getI18n()]);

  const links = [
    { href: "/panel", label: t("nav.panel") },
    { href: "/tarayici", label: t("nav.scanner") },
    { href: "/takip", label: t("nav.watchlist") },
    { href: "/ayarlar", label: t("nav.settings") },
  ];

  const marketLinks = MARKET_IDS.map((id) => ({
    href: `/piyasa/${MARKETS[id].slug}`,
    label: t(`market.${id}` as "market.kripto"),
  }));

  return (
    <header className="nav">
      <div className="container container-wide nav-inner">
        <Link href="/panel" className="logo">
          <LogoMark />
          <span className="only-desktop">
            Fibo<em>nex</em>
          </span>
        </Link>

        <nav className="nav-links">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="nav-search only-desktop">
          <AssetSearch />
        </div>

        <div className="nav-actions">
          <span className="only-desktop">
            <LanguageSwitcher compact />
          </span>
          <span className="muted only-desktop" style={{ fontSize: 13 }}>
            {session?.user?.email}
          </span>
          <span className="only-desktop">
            <SignOutButton />
          </span>
          <span className="only-mobile">
            <MobileMenu
              links={[...links, ...marketLinks]}
              footer={<SignOutButton />}
            />
          </span>
        </div>
      </div>
    </header>
  );
}

import Link from "next/link";

import { LogoMark } from "./Logo";

import { auth } from "@/auth";
import AssetSearch from "./AssetSearch";
import LanguageSwitcher from "./LanguageSwitcher";
import MobileMenu from "./MobileMenu";
import SignOutButton from "./SignOutButton";
import { kullanicidanDurum } from "@/lib/credits";
import { getI18n } from "@/lib/i18n/server";
import { MARKETS, AKTIF_MARKET_IDS } from "@/lib/markets/types";
import { findUserByEmail } from "@/lib/users";

/** Üye alanının üst menüsü. */
export default async function AppNav() {
  const [session, { t }] = await Promise.all([auth(), getI18n()]);

  // Kalan kredi menüde durur: kullanıcı analiz etmeden önce ne kadar hakkı
  // kaldığını görsün, bitince şaşırmasın. Depo okunamıyorsa rozet gizlenir.
  const kullanici = session?.user?.email
    ? await findUserByEmail(session.user.email).catch(() => null)
    : null;
  const durum = kullanici ? kullanicidanDurum(kullanici) : null;

  const links = [
    { href: "/panel", label: t("nav.panel") },
    { href: "/tarayici", label: t("nav.scanner") },
    { href: "/takip", label: t("nav.watchlist") },
    { href: "/abonelik", label: t("nav.subscription") },
    { href: "/ayarlar", label: t("nav.settings") },
  ];

  const marketLinks = AKTIF_MARKET_IDS.map((id) => ({
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
          {durum && (
            <Link
              href="/abonelik"
              className={`credit-chip${durum.kalan === 0 ? " credit-chip-empty" : ""}`}
              title={t("credit.remaining")}
            >
              <span aria-hidden>◆</span>
              {durum.kalan}
            </Link>
          )}
          <span className="only-desktop">
            <LanguageSwitcher compact />
          </span>
          <span className="muted only-desktop nav-email" style={{ fontSize: 13 }}>
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

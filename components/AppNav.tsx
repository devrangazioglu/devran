import { headers } from "next/headers";
import Link from "next/link";

import { LogoAd, LogoMark } from "./Logo";

import { auth } from "@/auth";
import AssetSearch from "./AssetSearch";
import LanguageSwitcher from "./LanguageSwitcher";
import MobileMenu from "./MobileMenu";
import SignOutButton from "./SignOutButton";
import { yoneticiMi } from "@/lib/admin";
import { kullanicidanDurum } from "@/lib/credits";
import { getI18n } from "@/lib/i18n/server";
import { MARKETS, AKTIF_MARKET_IDS, ANA_MARKET_IDS } from "@/lib/markets/types";
import { findUserByEmail } from "@/lib/users";
import { uygulamaUa } from "@/lib/uygulama";
import Ikon from "./Ikon";
import MobilArama from "./MobilArama";

/** Üye alanının üst menüsü. */
export default async function AppNav() {
  const [session, { t }, basliklar] = await Promise.all([auth(), getI18n(), headers()]);
  const uygulama = uygulamaUa(basliklar.get("user-agent"));

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
    { href: "/dogruluk", label: t("nav.accuracy") },
    // Uygulamada "abonelik" yerine kredi bakiyesi (App Store 3.1.1).
    { href: "/abonelik", label: uygulama ? t("nav.credits") : t("nav.subscription") },
    { href: "/ayarlar", label: t("nav.settings") },
    // Yönetim bağlantısı yalnızca yöneticide görünür.
    ...(yoneticiMi(session?.user?.email) ? [{ href: "/yonetim", label: t("nav.admin") }] : []),
  ];

  const marketLinks = [
    ...ANA_MARKET_IDS.filter((id) => AKTIF_MARKET_IDS.includes(id)).map((id) => ({
      href: `/piyasa/${MARKETS[id].slug}`,
      label: t(`market.${id}` as "market.kripto"),
    })),
    { href: "/#dunya", label: t("market.dunya") },
  ];

  return (
    <header className="nav">
      <div className="container container-wide nav-inner">
        <Link href="/panel" className="logo">
          <LogoMark />
          <span className="only-desktop">
            <LogoAd />
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
              <Ikon ad="elmas" boyut={11} dolu />
              {durum.yonetici ? "∞" : durum.kalan}
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
            <MobilArama />
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

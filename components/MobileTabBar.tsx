"use client";

/**
 * Üye alanında mobil için alt sekme çubuğu (başparmakla erişilebilir).
 *
 * Kenarlardan ayrık, yüzen bir çubuk: telefonun ana çubuğuyla (home
 * indicator) çakışmaz, içerik altından bulanık görünür. Etkin sekmenin
 * ikonu vurgulu bir kapsülün içinde durur.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

import Ikon, { type IkonAdi } from "./Ikon";
import { useI18n } from "./I18nProvider";

const TABS: { href: string; ikon: IkonAdi; key: "nav.panel" | "nav.short.scanner" | "nav.short.watchlist" | "nav.short.subscription" | "nav.settings" }[] = [
  { href: "/panel", ikon: "panel", key: "nav.panel" },
  { href: "/tarayici", ikon: "radar", key: "nav.short.scanner" },
  { href: "/takip", ikon: "yildiz", key: "nav.short.watchlist" },
  { href: "/abonelik", ikon: "tac", key: "nav.short.subscription" },
  { href: "/ayarlar", ikon: "ayarlar", key: "nav.settings" },
];

export default function MobileTabBar() {
  const { t } = useI18n();
  const pathname = usePathname();

  return (
    <nav className="tabbar" aria-label={t("nav.panel")}>
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={active ? "active" : ""}
            aria-current={active ? "page" : undefined}
          >
            <span className="tabbar-ikon">
              <Ikon ad={tab.ikon} boyut={20} dolu={active && tab.ikon === "yildiz"} />
            </span>
            <span className="tabbar-etiket">{t(tab.key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

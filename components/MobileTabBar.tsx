"use client";

/** Üye alanında mobil için alt sekme çubuğu (başparmakla erişilebilir). */

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useI18n } from "./I18nProvider";

const TABS = [
  { href: "/panel", icon: "◧", key: "nav.panel" },
  { href: "/tarayici", icon: "⌖", key: "nav.scanner" },
  { href: "/takip", icon: "★", key: "nav.watchlist" },
  { href: "/ayarlar", icon: "⚙", key: "nav.settings" },
] as const;

export default function MobileTabBar() {
  const { t } = useI18n();
  const pathname = usePathname();

  return (
    <nav className="tabbar" aria-label={t("nav.panel")}>
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link key={tab.href} href={tab.href} className={active ? "active" : ""}>
            <span aria-hidden>{tab.icon}</span>
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}

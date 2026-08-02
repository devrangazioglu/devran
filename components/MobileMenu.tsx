"use client";

/** Mobilde açılan tam ekran menü (hamburger). */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useI18n } from "./I18nProvider";
import LanguageSwitcher from "./LanguageSwitcher";

export type MenuLink = { href: string; label: string };

export default function MobileMenu({
  links,
  footer,
}: {
  links: MenuLink[];
  /** Menü altına eklenecek düğmeler (giriş/çıkış gibi). */
  footer?: React.ReactNode;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Sayfa değişince menü kapanır.
  useEffect(() => setOpen(false), [pathname]);

  // Menü açıkken arka plan kaymasın.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        className="menu-button"
        onClick={() => setOpen(true)}
        aria-label={t("common.openMenu")}
      >
        <span />
        <span />
        <span />
      </button>

      {open && (
        <div className="drawer" role="dialog" aria-modal="true">
          <div className="drawer-head">
            <LanguageSwitcher />
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
              {t("common.close")}
            </button>
          </div>

          <nav className="drawer-links">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={pathname === link.href ? "active" : ""}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {footer && <div className="drawer-footer">{footer}</div>}
        </div>
      )}
    </>
  );
}

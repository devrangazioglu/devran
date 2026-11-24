"use client";

/** Mobilde açılan tam ekran menü (hamburger). */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

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
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  // Portal yalnızca tarayıcıda kurulabilir (sunucuda document yok).
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);

  // Sayfa ya da dil değişince menü kapanır.
  useEffect(() => setOpen(false), [pathname, locale]);

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

      {/* Menü <body>'ye taşınır: üst çubuktaki bulanıklık efekti
          (backdrop-filter) "position: fixed" öğeler için yeni bir kap oluşturur.
          Menü çubuğun içinde kaldığında tam ekran değil, 68 piksellik çubuğun
          içine sıkışıyor; bağlantılar ve dil listesi görünmüyordu. */}
      {open && mounted && createPortal(
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
        </div>,
        document.body,
      )}
    </>
  );
}

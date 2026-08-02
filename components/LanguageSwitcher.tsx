"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useI18n } from "./I18nProvider";
import { LOCALES, LOCALE_COOKIE, type Locale } from "@/lib/i18n";
import { localeHref, splitLocale } from "@/lib/i18n/routing";

/**
 * Dil seçici.
 *
 * Herkese açık sayfalarda dil adreste taşınır (/en/piyasa/kripto), bu yüzden
 * seçim yapılınca aynı sayfanın o dildeki adresine gidilir: paylaşılan bağlantı
 * dili de taşır ve arama motoru her dili ayrı sayfa olarak görebilir. Üye
 * alanının adresi dilsizdir; orada yalnızca çerez güncellenip sayfa yenilenir.
 */
export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const pathname = usePathname() ?? "/";

  function choose(next: Locale) {
    // Tercih bir yıl hatırlansın (üye alanı bunu kullanır).
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setOpen(false);

    const { path } = splitLocale(pathname);
    const dilliSayfa = ["/", "/piyasa", "/giris", "/kayit"].some(
      (kok) => path === kok || path.startsWith(`${kok}/`),
    );

    if (dilliSayfa) router.push(localeHref(next, path));
    else router.refresh();
  }

  const active = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  return (
    <div className="lang" ref={wrapper}>
      <button
        className="lang-button"
        onClick={() => setOpen((value) => !value)}
        aria-label={t("common.language")}
        aria-expanded={open}
      >
        <span aria-hidden>🌐</span>
        <span>{compact ? active.short : active.name}</span>
      </button>

      {open && (
        <div className="lang-menu" role="listbox">
          {LOCALES.map((item) => (
            <button
              key={item.code}
              role="option"
              aria-selected={item.code === locale}
              className={item.code === locale ? "active" : ""}
              onClick={() => choose(item.code)}
            >
              <span className="lang-code">{item.short}</span>
              {item.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useI18n } from "./I18nProvider";
import { LOCALES, LOCALE_COOKIE, type Locale } from "@/lib/i18n";

/** Dil seçici — seçim çereze yazılır ve sayfa sunucudan yeniden çizilir. */
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

  function choose(next: Locale) {
    // Bir yıl geçerli, site genelinde bir çerez.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setOpen(false);
    router.refresh();
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

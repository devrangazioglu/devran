import Link from "next/link";

import type { Translator } from "@/lib/i18n";

/**
 * Gizlilik, koşullar ve destek bağlantıları.
 *
 * Her alt bilgide bulunur: mağaza incelemesi ve KVKK, politikaya her
 * sayfadan bir tıkla ulaşılmasını bekler. Bu sayfalar dilsizdir; dili
 * çerezden okurlar (bkz. middleware.ts), bu yüzden bağlantılar öneksizdir.
 */
export default function YasalBaglantilar({ t }: { t: Translator }) {
  return (
    <nav className="yasal-baglantilar" aria-label={t("legal.nav")}>
      <Link href="/gizlilik">{t("legal.privacy")}</Link>
      <Link href="/kosullar">{t("legal.terms")}</Link>
      <Link href="/destek">{t("legal.support")}</Link>
    </nav>
  );
}

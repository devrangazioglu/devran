"use client";

/**
 * Mobilde varlık arama.
 *
 * Üst çubuktaki arama kutusu dar ekranda sığmadığı için gizleniyordu ve
 * telefonda hisse aramanın bir yolu kalmıyordu. Burada üst çubukta bir
 * arama düğmesi durur; dokununca tam ekran arama açılır, klavye hemen
 * gelir. Boşken sık bakılan varlıklar tek dokunuşla açılır.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import AssetSearch from "./AssetSearch";
import Ikon from "./Ikon";
import { useI18n } from "./I18nProvider";

const SIK_BAKILANLAR: { href: string; etiket: string }[] = [
  { href: "/varlik/kripto/BTCUSDT", etiket: "BTC" },
  { href: "/varlik/kripto/ETHUSDT", etiket: "ETH" },
  { href: "/varlik/abd/AAPL", etiket: "AAPL" },
  { href: "/varlik/abd/NVDA", etiket: "NVDA" },
  { href: "/varlik/abd/TSLA", etiket: "TSLA" },
  { href: "/varlik/bist/THYAO.IS", etiket: "THYAO" },
  { href: "/varlik/bist/ASELS.IS", etiket: "ASELS" },
  { href: `/varlik/emtia/${encodeURIComponent("GC=F")}`, etiket: "XAU" },
  { href: `/varlik/emtia/${encodeURIComponent("USDTRY=X")}`, etiket: "USD/TRY" },
];

export default function MobilArama() {
  const { t } = useI18n();
  const [acik, setAcik] = useState(false);
  const [hazir, setHazir] = useState(false);
  const pathname = usePathname();

  useEffect(() => setHazir(true), []);
  // Bir varlık seçilip sayfa değişince arama kapanır.
  useEffect(() => setAcik(false), [pathname]);

  useEffect(() => {
    if (!acik) return;
    document.body.style.overflow = "hidden";
    const kapat = (e: KeyboardEvent) => e.key === "Escape" && setAcik(false);
    document.addEventListener("keydown", kapat);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", kapat);
    };
  }, [acik]);

  return (
    <>
      <button
        type="button"
        className="menu-button arama-dugmesi"
        onClick={() => setAcik(true)}
        aria-label={t("common.search")}
      >
        <Ikon ad="ara" boyut={18} />
      </button>

      {acik &&
        hazir &&
        createPortal(
          <div className="mobil-arama" role="dialog" aria-modal="true" aria-label={t("common.search")}>
            <div className="mobil-arama-ust">
              <div className="mobil-arama-kutu">
                <AssetSearch size="large" autoFocus />
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setAcik(false)}
              >
                {t("common.cancel")}
              </button>
            </div>

            <div className="mobil-arama-govde">
              <p className="mobil-arama-baslik">{t("search.popular")}</p>
              <div className="mobil-arama-cipler">
                {SIK_BAKILANLAR.map((v) => (
                  <Link key={v.href} href={v.href} className="mobil-arama-cip">
                    {v.etiket}
                  </Link>
                ))}
              </div>
              <p className="dim" style={{ fontSize: 12.5, marginTop: 18, lineHeight: 1.6 }}>
                {t("search.hint")}
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

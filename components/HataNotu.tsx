"use client";

/**
 * Hata kutusu.
 *
 * Metni göstermekle kalmaz, hatanın koduna bakar: plan ya da kredi sınırına
 * takılan bir istekte kullanıcıyı abonelik sayfasına yönlendirir. "Krediniz
 * bitti" cümlesinin yanında ne yapılacağı yazmıyorsa kullanıcı takılı kalır.
 */

import Link from "next/link";

import { useI18n } from "./I18nProvider";
import { ApiHatasi } from "@/lib/api-types";

const PLAN_KODLARI = new Set(["kredi-yetersiz", "plan-periyot", "plan-takip"]);

export default function HataNotu({ hata }: { hata: unknown }) {
  const { t } = useI18n();
  if (!hata) return null;

  const kod = hata instanceof ApiHatasi ? hata.kod : undefined;
  const metin = hata instanceof Error ? hata.message : String(hata);

  return (
    <div className="notice notice-error">
      {metin}
      {kod && PLAN_KODLARI.has(kod) && (
        <>
          {" "}
          <Link href="/abonelik" style={{ color: "var(--accent)", whiteSpace: "nowrap" }}>
            {t("credit.upgrade")} →
          </Link>
        </>
      )}
    </div>
  );
}

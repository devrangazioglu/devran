"use client";

/**
 * Plan kartları.
 *
 * İki yerde kullanılır: herkese açık /planlar sayfasında (tanıtım) ve üye
 * alanındaki abonelik sayfasında (seçim). Kartın gövdesi `lib/plans.ts`
 * içindeki gerçek sayılardan üretilir; burada elle yazılmış vaat yoktur.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useI18n } from "./I18nProvider";
import { PLAN_IDS, PLANS, type PlanId } from "@/lib/plans";

export default function PlanCards({
  mevcut = null,
  uyeModu = false,
  kayitHref = "/kayit",
}: {
  /** Kullanıcının şu anki planı; bilinmiyorsa null. */
  mevcut?: PlanId | null;
  /** Üye alanında kartlar plan değiştirir; tanıtımda kayda yönlendirir. */
  uyeModu?: boolean;
  kayitHref?: string;
}) {
  const { t, intl } = useI18n();
  const router = useRouter();
  const [bekleyen, setBekleyen] = useState<PlanId | null>(null);
  const [mesaj, setMesaj] = useState<{ tur: "ok" | "hata"; metin: string } | null>(null);

  // Ücretsiz planda da rakam gösterilir: başlıkta "Ücretsiz" yazarken fiyat
  // satırında da "Ücretsiz" yazmak kartı iki kez aynı şeyi söyler hâle getirir.
  const fiyat = (ucret: number) =>
    new Intl.NumberFormat(intl, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: ucret === 0 ? 0 : 2,
    }).format(ucret);

  async function planSec(id: PlanId) {
    setBekleyen(id);
    setMesaj(null);
    try {
      const response = await fetch("/api/abonelik", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: id }),
      });
      const body = (await response.json().catch(() => null)) as
        | { mesaj?: string; error?: string }
        | null;

      if (!response.ok) {
        setMesaj({ tur: "hata", metin: body?.error ?? t("common.error") });
        return;
      }
      setMesaj({ tur: "ok", metin: body?.mesaj ?? t("plans.changed") });
      router.refresh();
    } catch {
      setMesaj({ tur: "hata", metin: t("auth.networkError") });
    } finally {
      setBekleyen(null);
    }
  }

  return (
    <>
      {mesaj && (
        <div className={mesaj.tur === "ok" ? "notice" : "notice notice-error"}>{mesaj.metin}</div>
      )}

      <div className="plan-grid">
        {PLAN_IDS.map((id) => {
          const plan = PLANS[id];
          const secili = mevcut === id;
          const oneCikan = id === "premium";

          return (
            <div key={id} className={`plan-card${oneCikan ? " plan-card-featured" : ""}`}>
              {oneCikan && <span className="plan-tag">{t("plans.popular")}</span>}

              <h3>{t(`plan.${id}` as "plan.basic")}</h3>
              <p className="plan-price">
                <b>{fiyat(plan.ucret)}</b>
                <span>{t("plans.perMonth")}</span>
              </p>

              <ul className="plan-list">
                <li>
                  <b>{plan.aylikKredi}</b> {t("plans.creditLine")}
                </li>
                <li>{t("plans.scanLine", { count: plan.taramaSiniri })}</li>
                <li>{t("plans.watchLine", { count: plan.takipSiniri })}</li>
                <li>{t("plans.intervalLine", { list: plan.periyotlar.join(", ") })}</li>
                {plan.vurgu && <li>{t(plan.vurgu as "plan.vurgu.oncelik")}</li>}
              </ul>

              {secili ? (
                <span className="btn btn-ghost btn-block plan-current" aria-disabled>
                  {t("plans.current")}
                </span>
              ) : uyeModu ? (
                <button
                  className={`btn btn-block ${oneCikan ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => void planSec(id)}
                  disabled={bekleyen !== null}
                >
                  {bekleyen === id && <span className="spinner" />}
                  {id === "ucretsiz" ? t("plans.downgrade") : t("plans.choose")}
                </button>
              ) : (
                <Link
                  href={kayitHref}
                  className={`btn btn-block ${oneCikan ? "btn-primary" : "btn-ghost"}`}
                >
                  {id === "ucretsiz" ? t("plans.start") : t("plans.choose")}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

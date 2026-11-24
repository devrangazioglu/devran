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
import {
  PLAN_IDS,
  PLANS,
  paraBirimi,
  planUcreti,
  YILLIK_BEDAVA_AY,
  yillikAylikKarsiligi,
  type Faturalama,
  type PlanId,
} from "@/lib/plans";

export default function PlanCards({
  mevcut = null,
  mevcutFaturalama = null,
  uyeModu = false,
  kayitHref = "/kayit",
}: {
  /** Kullanıcının şu anki planı; bilinmiyorsa null. */
  mevcut?: PlanId | null;
  /** Kullanıcının şu anki faturalama dönemi. */
  mevcutFaturalama?: Faturalama | null;
  /** Üye alanında kartlar plan değiştirir; tanıtımda kayda yönlendirir. */
  uyeModu?: boolean;
  kayitHref?: string;
}) {
  const { t, intl, locale } = useI18n();
  const birim = paraBirimi(locale);
  const router = useRouter();
  const [faturalama, setFaturalama] = useState<Faturalama>(mevcutFaturalama ?? "aylik");
  const [bekleyen, setBekleyen] = useState<PlanId | null>(null);
  const [mesaj, setMesaj] = useState<{ tur: "ok" | "hata"; metin: string } | null>(null);

  // Türkçede Türk lirası (App Store'daki Türkiye fiyatı), diğer dillerde dolar.
  // Ücretsiz plan "0" olarak küsuratsız yazılır.
  const para = (tutar: number) =>
    new Intl.NumberFormat(intl, {
      style: "currency",
      currency: birim,
      minimumFractionDigits: tutar === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(tutar);

  async function planSec(id: PlanId) {
    setBekleyen(id);
    setMesaj(null);
    try {
      const response = await fetch("/api/abonelik", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: id, faturalama }),
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
      {/* Aylık / yıllık anahtarı */}
      <div className="fatura-anahtari">
        <div className="segmented">
          <button
            className={faturalama === "aylik" ? "active" : ""}
            onClick={() => setFaturalama("aylik")}
          >
            {t("plans.monthly")}
          </button>
          <button
            className={faturalama === "yillik" ? "active" : ""}
            onClick={() => setFaturalama("yillik")}
          >
            {t("plans.yearly")}
          </button>
        </div>
        <span className="fatura-rozet">{t("plans.yearlySave", { count: YILLIK_BEDAVA_AY })}</span>
      </div>

      {mesaj && (
        <div className={mesaj.tur === "ok" ? "notice" : "notice notice-error"}>{mesaj.metin}</div>
      )}

      <div className="plan-grid">
        {PLAN_IDS.map((id) => {
          const plan = PLANS[id];
          // "Mevcut plan" yalnızca aynı faturalama döneminde geçerli: yıllığa
          // geçmek isteyen kullanıcı düğmeyi kapalı bulmamalı.
          const secili = mevcut === id && (mevcutFaturalama ?? "aylik") === faturalama;
          const oneCikan = id === "premium";
          const ucret = planUcreti(plan, faturalama, birim);

          return (
            <div key={id} className={`plan-card${oneCikan ? " plan-card-featured" : ""}`}>
              {oneCikan && <span className="plan-tag">{t("plans.popular")}</span>}

              <h3>{t(`plan.${id}` as "plan.basic")}</h3>
              <p className="plan-price">
                <b>{para(ucret)}</b>
                <span>{faturalama === "yillik" ? t("plans.perYear") : t("plans.perMonth")}</span>
              </p>
              {/* Yıllıkta aya düşen tutar: karşılaştırmayı kullanıcıya
                  yaptırmak yerine yazıyoruz. */}
              <p className="plan-price-note">
                {faturalama === "yillik" && ucret > 0
                  ? t("plans.perMonthEquivalent", { amount: para(yillikAylikKarsiligi(plan, birim)) })
                  : " "}
              </p>

              <ul className="plan-list">
                <li>
                  <b>{plan.aylikKredi}</b> {t("plans.creditLine")}
                </li>
                <li>{t("plans.scanLine", { count: plan.taramaSiniri })}</li>
                <li>{t("plans.watchLine", { count: plan.takipSiniri })}</li>
                {/* Bütün planlarda aynı aralık; sekiz periyodu tek tek saymak kartı uzatıyordu. */}
                <li>
                  {t("plans.intervalLine", {
                    list: `${plan.periyotlar[0]} – ${plan.periyotlar[plan.periyotlar.length - 1]}`,
                  })}
                </li>
                {plan.vurgu && <li>{t(plan.vurgu as "plan.vurgu.oncelik")}</li>}
              </ul>

              {secili ? (
                <span className="btn btn-ghost btn-block plan-current" aria-disabled>
                  {t("plans.current")}
                </span>
              ) : uyeModu ? (
                <button
                  // iOS uygulamasında ücretli plan yalnızca Apple'ın uygulama içi
                  // satın almasıyla alınabilir (App Store 3.1.1); o bağlanana
                  // kadar düğme orada gizlenir (bkz. globals.css → .platform-ios).
                  className={`btn btn-block ${oneCikan ? "btn-primary" : "btn-ghost"} ${id === "ucretsiz" ? "" : "satin-al"}`}
                  onClick={() => void planSec(id)}
                  disabled={bekleyen !== null}
                >
                  {bekleyen === id && <span className="spinner" />}
                  {id === "ucretsiz" ? t("plans.downgrade") : t("plans.choose")}
                </button>
              ) : (
                <Link
                  // Uygulamada da kayıt ücretsiz; plan seçimi kayıttan sonra.
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

import { auth } from "@/auth";
import PlanCards from "@/components/PlanCards";
import { abonelikDurumu } from "@/lib/credits";
import { intlTag } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { odemeAcik, odemeTestModu } from "@/lib/odeme";

// Üye alanı: içerik kişiye özel, arama sonuçlarında yeri yok.
export const metadata = {
  title: "Aboneliğim",
  robots: { index: false, follow: false },
};

export default async function AbonelikSayfasi() {
  const [session, { t, locale }] = await Promise.all([auth(), getI18n()]);
  const email = session?.user?.email ?? "";
  const durum = email ? await abonelikDurumu(email) : null;

  const tarih = (ms: number) =>
    new Intl.DateTimeFormat(intlTag(locale), { dateStyle: "long" }).format(new Date(ms));

  // Kullanılan oranı çubukta göstermek için (0–100).
  const oran = durum && durum.toplam > 0 ? Math.min((durum.harcanan / durum.toplam) * 100, 100) : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t("sub.title")}</h1>
          <p className="sub">{t("sub.sub")}</p>
        </div>
      </div>

      {durum ? (
        <div className="card credit-card">
          <div className="credit-head">
            <div>
              <span className="card-label">{t("sub.currentPlan")}</span>
              <strong className="credit-plan">{t(`plan.${durum.plan.id}` as "plan.basic")}</strong>
              <span className="muted" style={{ fontSize: 13 }}>
                {durum.faturalama === "yillik" ? t("plans.yearly") : t("plans.monthly")}
              </span>
            </div>
            <div className="credit-numbers">
              <b>{durum.kalan}</b>
              <span>
                / {durum.toplam} {t("credit.remaining")}
              </span>
            </div>
          </div>

          <div className="credit-bar" role="presentation">
            <span style={{ width: `${oran}%` }} />
          </div>

          <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
            {t("credit.renews", { date: tarih(durum.donemSonu) })} ·{" "}
            {t("credit.scanLimit", { count: durum.plan.taramaSiniri })} ·{" "}
            {t("credit.watchLimit", { count: durum.plan.takipSiniri })}
          </p>
        </div>
      ) : (
        <div className="notice notice-warn">{t("sub.noLedger")}</div>
      )}

      {!odemeAcik() && !odemeTestModu() && (
        <div className="notice" style={{ marginTop: 18 }}>
          {t("plans.paymentClosed")}
        </div>
      )}

      <div style={{ marginTop: 22 }}>
        <PlanCards
          mevcut={durum?.plan.id ?? null}
          mevcutFaturalama={durum?.faturalama ?? null}
          uyeModu
        />
      </div>

      <div className="card" style={{ marginTop: 22 }}>
        <div className="card-title">{t("plans.creditTitle")}</div>
        <ul className="bullet-list">
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <li key={n}>{t(`plans.credit.${n}` as "plans.credit.1")}</li>
          ))}
        </ul>
      </div>
    </>
  );
}

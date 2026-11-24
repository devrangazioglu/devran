import { auth } from "@/auth";
import DavetKarti from "@/components/DavetKarti";
import PlanCards from "@/components/PlanCards";
import { abonelikDurumu, davetBilgisi } from "@/lib/credits";
import { intlTag } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { odemeAcik, odemeTestModu } from "@/lib/odeme";
import { findUserByEmail } from "@/lib/users";
import Ikon from "@/components/Ikon";

// Üye alanı: içerik kişiye özel, arama sonuçlarında yeri yok.
export const metadata = {
  title: "Aboneliğim",
  robots: { index: false, follow: false },
};

export default async function AbonelikSayfasi() {
  const [session, { t, locale }] = await Promise.all([auth(), getI18n()]);
  const email = session?.user?.email ?? "";
  const durum = email ? await abonelikDurumu(email) : null;
  const kullanici = email ? await findUserByEmail(email) : null;
  const davet = kullanici ? davetBilgisi(kullanici) : null;

  const tarih = (ms: number) =>
    new Intl.DateTimeFormat(intlTag(locale), { dateStyle: "long" }).format(new Date(ms));

  // Kullanılan oranı çubukta göstermek için (0–100).
  const oran = durum && durum.toplam > 0 ? Math.min((durum.harcanan / durum.toplam) * 100, 100) : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <span className="yalniz-web">{t("sub.title")}</span>
            <span className="yalniz-uygulama">{t("nav.credits")}</span>
          </h1>
          <p className="sub">
            <span className="yalniz-web">{t("sub.sub")}</span>
            <span className="yalniz-uygulama">{t("sub.subApp")}</span>
          </p>
        </div>
      </div>

      {durum?.yonetici && (
        <div className="notice deneme-notu" style={{ marginBottom: 18 }}>
          <strong className="ikonlu-baslik">
            <Ikon ad="yonetim" boyut={16} /> {t("nav.admin")}
          </strong> · {t("sub.adminNote")}
        </div>
      )}

      {durum ? (
        <div className="card credit-card">
          <div className="credit-head">
            {/* Uygulamada plan adı ve faturalama gösterilmez (App Store 3.1.1). */}
            <div className="yalniz-uygulama">
              <span className="card-label">{t("credit.remaining")}</span>
            </div>
            <div className="yalniz-web">
              <span className="card-label">{t("sub.currentPlan")}</span>
              <strong className="credit-plan">{t(`plan.${durum.plan.id}` as "plan.basic")}</strong>
              <span className="muted" style={{ fontSize: 13 }}>
                {durum.faturalama === "yillik" ? t("plans.yearly") : t("plans.monthly")}
              </span>
            </div>
            <div className="credit-numbers">
              <b>{durum.yonetici ? "∞" : durum.kalan}</b>
              <span>
                / {durum.yonetici ? "∞" : durum.toplam} {t("credit.remaining")}
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
            {durum.bonus > 0 && <> · {t("credit.bonus", { count: durum.bonus })}</>}
          </p>
        </div>
      ) : (
        <div className="notice notice-warn">{t("sub.noLedger")}</div>
      )}

      {!odemeAcik() && !odemeTestModu() && (
        <div className="notice satin-al yalniz-web" style={{ marginTop: 18 }}>
          {t("plans.paymentClosed")}
        </div>
      )}

      <div className="yalniz-web" style={{ marginTop: 22 }}>
        <PlanCards
          mevcut={durum?.kayitliPlan ?? null}
          mevcutFaturalama={durum?.faturalama ?? null}
          uyeModu
        />
      </div>

      {davet && (
        <div style={{ marginTop: 22 }}>
          <DavetKarti kod={davet.kod} sayi={davet.sayi} sinir={davet.sinir} odul={davet.odul} />
        </div>
      )}

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

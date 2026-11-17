import { auth } from "@/auth";
import DavetKarti from "@/components/DavetKarti";
import DenemeDugmesi from "@/components/DenemeDugmesi";
import PlanCards from "@/components/PlanCards";
import { abonelikDurumu, davetBilgisi, DENEME_MS } from "@/lib/credits";
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
  const kalanGun = durum?.denemeBitis
    ? Math.max(Math.ceil((durum.denemeBitis - Date.now()) / 86_400_000), 1)
    : 0;

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

      {durum?.yonetici && (
        <div className="notice deneme-notu" style={{ marginBottom: 18 }}>
          <strong className="ikonlu-baslik">
            <Ikon ad="yonetim" boyut={16} /> {t("nav.admin")}
          </strong> · {t("sub.adminNote")}
        </div>
      )}

      {durum?.denemeBitis && (
        <div className="notice deneme-notu" style={{ marginBottom: 18 }}>
          <strong className="ikonlu-baslik">
            <Ikon ad="parilti" boyut={16} /> {t("trial.active", { gun: kalanGun })}
          </strong>{" "}
          {t("trial.activeText", { date: tarih(durum.denemeBitis) })}
        </div>
      )}

      {durum?.denemeHakki && (
        <div className="card deneme-karti" style={{ marginBottom: 18 }}>
          <div>
            <div className="card-title" style={{ marginBottom: 6 }}>
              {t("trial.offerTitle", { gun: DENEME_MS / 86_400_000 })}
            </div>
            <p className="muted" style={{ fontSize: 14, margin: 0 }}>
              {t("trial.offerText")}
            </p>
          </div>
          <DenemeDugmesi />
        </div>
      )}

      {durum ? (
        <div className="card credit-card">
          <div className="credit-head">
            <div>
              <span className="card-label">{t("sub.currentPlan")}</span>
              <strong className="credit-plan">{t(`plan.${durum.plan.id}` as "plan.basic")}</strong>
              <span className="muted" style={{ fontSize: 13 }}>
                {durum.denemeBitis
                  ? t("trial.label")
                  : durum.faturalama === "yillik"
                    ? t("plans.yearly")
                    : t("plans.monthly")}
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
        <div className="notice satin-al" style={{ marginTop: 18 }}>
          {t("plans.paymentClosed")}
        </div>
      )}

      <div style={{ marginTop: 22 }}>
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

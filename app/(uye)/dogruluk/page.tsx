/**
 * Canlı doğruluk sayfası: sitenin verdiği sinyaller gerçekte tuttu mu?
 *
 * Veri `lib/sinyal-gunlugu.ts`'ten gelir: her gün sabit bir listenin sinyali
 * yazılır, 10 işlem günü sonra sonucu eklenir. Metinler bilerek sade: sayfa
 * teknik analiz bilmeyen birinin "bu siteye ne kadar güvenebilirim?" sorusunu
 * yanıtlamak için var.
 */

import Link from "next/link";

import { formatNumber, formatPercent, formatPrice } from "@/lib/format";
import { intlTag, type Translator } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { isBuySignal, isSellSignal } from "@/lib/analysis";
import { istatistikHesapla, kayitlariOku, UFUK, type Istatistik, type YonOzeti } from "@/lib/sinyal-gunlugu";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sinyal doğruluğu",
  robots: { index: false, follow: false },
};

/** Bu kadar sonuçtan azıyla kesin konuşulmaz. */
const AZ_ORNEK = 30;

function tarihYaz(tarih: string, intl: string): string {
  return new Date(`${tarih}T12:00:00Z`).toLocaleDateString(intl, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function YonKarti({
  baslik,
  ozet,
  yon,
  t,
  intl,
}: {
  baslik: string;
  ozet: YonOzeti;
  yon: "al" | "sat";
  t: Translator;
  intl: string;
}) {
  const yuzde = (oran: number | null) => (oran === null ? "—" : `%${formatNumber(oran * 100, intl, 0)}`);
  const fark = ozet.oran !== null && ozet.taban !== null ? (ozet.oran - ozet.taban) * 100 : null;
  const hukum =
    ozet.n === 0
      ? t("dogru.none")
      : ozet.n < AZ_ORNEK
        ? t("dogru.few", { n: ozet.n })
        : fark !== null && fark >= 3
          ? t("dogru.better", { fark: formatNumber(fark, intl, 0) })
          : fark !== null && fark <= -3
            ? t("dogru.worse", { fark: formatNumber(Math.abs(fark), intl, 0) })
            : t("dogru.same");

  return (
    <div className="card">
      <div className="card-title">
        <span>{baslik}</span>
        <span className={`badge ${yon === "al" ? "badge-up" : "badge-down"}`}>
          {t(yon === "al" ? "signal.BUY" : "signal.SELL")}
        </span>
      </div>
      <div className="dogru-buyuk mono">{yuzde(ozet.oran)}</div>
      <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>
        {ozet.n === 0
          ? t("dogru.noneYet")
          : t(yon === "al" ? "dogru.buyLine" : "dogru.sellLine", { n: ozet.n, tutan: ozet.tutan, ufuk: UFUK })}
      </p>
      <div className="dogru-kiyas">
        <div>
          <span className="dim">{t("dogru.withSignal")}</span>
          <div className="meter">
            <i style={{ width: `${(ozet.oran ?? 0) * 100}%`, background: "var(--accent)" }} />
          </div>
          <strong className="mono">{yuzde(ozet.oran)}</strong>
        </div>
        <div>
          <span className="dim">{t(yon === "al" ? "dogru.baseUp" : "dogru.baseDown")}</span>
          <div className="meter">
            <i style={{ width: `${(ozet.taban ?? 0) * 100}%`, background: "var(--text-dim)" }} />
          </div>
          <strong className="mono">{yuzde(ozet.taban)}</strong>
        </div>
      </div>
      <p style={{ fontSize: 14, marginTop: 14 }}>{hukum}</p>
      {ozet.ortalama !== null && (
        <p className="dim" style={{ fontSize: 13, marginTop: 6 }}>
          {t("dogru.avg", { getiri: formatPercent(ozet.ortalama, intl) })}
        </p>
      )}
    </div>
  );
}

function Durum({ ist, t, intl }: { ist: Istatistik; t: Translator; intl: string }) {
  if (ist.toplam === 0) {
    return <div className="notice">{t("dogru.empty")}</div>;
  }
  if (ist.degerlendirilen === 0) {
    return (
      <div className="notice">
        {t("dogru.waiting", {
          toplam: ist.toplam,
          baslangic: ist.baslangic ? tarihYaz(ist.baslangic, intl) : "—",
          ilk: ist.ilkSonuc ? tarihYaz(ist.ilkSonuc, intl) : "—",
        })}
      </div>
    );
  }
  return (
    <div className="notice">
      {t("dogru.status", {
        toplam: ist.toplam,
        degerlendirilen: ist.degerlendirilen,
        bekleyen: ist.bekleyen,
        baslangic: ist.baslangic ? tarihYaz(ist.baslangic, intl) : "—",
      })}
    </div>
  );
}

export default async function DogrulukSayfasi() {
  const { t, locale } = await getI18n();
  const intl = intlTag(locale);

  let ist: Istatistik | null = null;
  let hata: string | null = null;
  try {
    ist = istatistikHesapla(await kayitlariOku());
  } catch (error) {
    hata = error instanceof Error ? error.message : "bilinmeyen hata";
  }

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div>
          <h1>{t("dogru.title")}</h1>
          <p className="sub" style={{ maxWidth: 760 }}>
            {t("dogru.intro", { ufuk: UFUK })}
          </p>
        </div>
      </div>

      {hata || !ist ? (
        <div className="notice notice-error">{t("dogru.error")}</div>
      ) : (
        <>
          <Durum ist={ist} t={t} intl={intl} />

          {/* Sonuç yokken boş kartlar ("—") bir şey anlatmaz; durum kutusu yeter. */}
          {ist.degerlendirilen > 0 && (
            <div className="grid-2">
              <YonKarti baslik={t("dogru.buyTitle")} ozet={ist.al} yon="al" t={t} intl={intl} />
              <YonKarti baslik={t("dogru.sellTitle")} ozet={ist.sat} yon="sat" t={t} intl={intl} />
            </div>
          )}

          {ist.piyasalar.length > 0 && (
            <div className="card">
              <div className="card-title">{t("dogru.byMarket")}</div>
              <div className="tablo-kaydir">
                <table className="sinama-tablo">
                  <thead>
                    <tr>
                      <th />
                      <th>{t("dogru.colBuy")}</th>
                      <th>{t("dogru.colSell")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ist.piyasalar.map((p) => (
                      <tr key={p.market}>
                        <th scope="row">{t(`market.${p.market}` as "market.kripto")}</th>
                        <td className="mono">
                          {p.al.oran === null ? "—" : `%${formatNumber(p.al.oran * 100, intl, 0)}`}
                          <span className="dim"> ({p.al.n})</span>
                        </td>
                        <td className="mono">
                          {p.sat.oran === null ? "—" : `%${formatNumber(p.sat.oran * 100, intl, 0)}`}
                          <span className="dim"> ({p.sat.n})</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {ist.son.length > 0 && (
            <div className="card">
              <div className="card-title">{t("dogru.recent")}</div>
              <div className="dogru-liste">
                {ist.son.map((k) => {
                  const yon = isBuySignal(k.sinyal) ? 1 : isSellSignal(k.sinyal) ? -1 : 0;
                  const tuttu = k.getiri === null || yon === 0 ? null : k.getiri * yon > 0;
                  return (
                    <div className="dogru-satir" key={k.id}>
                      <div>
                        <Link href={`/varlik/${k.market}/${encodeURIComponent(k.symbol)}?interval=1d`}>
                          <strong>{k.ticker}</strong>
                        </Link>
                        <span className="dim"> · {tarihYaz(k.tarih, intl)}</span>
                      </div>
                      <span
                        className={`badge ${yon > 0 ? "badge-up" : yon < 0 ? "badge-down" : "badge-flat"}`}
                      >
                        {t(`signal.${k.sinyal}` as "signal.BUY")}
                      </span>
                      <span className="mono dim">{formatPrice(k.fiyat, intl)}</span>
                      <span className={`mono ${k.getiri === null ? "dim" : k.getiri >= 0 ? "up" : "down"}`}>
                        {k.getiri === null ? t("dogru.pending") : formatPercent(k.getiri, intl)}
                      </span>
                      <span className={tuttu === null ? "dim" : tuttu ? "up" : "down"}>
                        {tuttu === null ? "" : tuttu ? t("dogru.hit") : t("dogru.miss")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-title">{t("dogru.howTitle")}</div>
            <ul className="bullet-list">
              <li>{t("dogru.how1")}</li>
              <li>{t("dogru.how2", { ufuk: UFUK })}</li>
              <li>{t("dogru.how3")}</li>
              <li>{t("dogru.how4")}</li>
            </ul>
            <p className="dim" style={{ fontSize: 12, marginTop: 12 }}>
              {t("footer.disclaimerShort")}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

/**
 * Detay sayfasının "bu sinyale ne kadar güvenilir" kartları:
 * piyasa durumu, geçmiş sınaması ve temel analiz.
 *
 * Üçü de sinyalin kendisini değil **bağlamını** gösterir. Bir AL rozeti tek
 * başına bir iddiadır; bu kartlar iddianın hangi varsayımla üretildiğini,
 * aynı kuralların bu varlıkta geçmişte ne yaptığını ve şirketin bilançosunun
 * ne söylediğini yanına koyar.
 */

import { useI18n } from "@/components/I18nProvider";
import { Meter } from "@/components/ui";
import type { Analysis, BacktestSide } from "@/lib/analysis";
import { backtestVerdictKey } from "@/lib/commentary";
import { formatNumber, formatPercent, formatPrice } from "@/lib/format";
import type { Fundamentals } from "@/lib/fundamentals";
import { finansSektoru } from "@/lib/fundamentals";
import { analystLabel, metricDisplay, metricValue, sectorName } from "@/lib/fundamentals-text";

/* ────────────────────────── Piyasa durumu ────────────────────────── */

export function RejimKarti({ analysis }: { analysis: Analysis }) {
  const { t, intl } = useI18n();
  const { regime } = analysis;
  const yon =
    regime.direction >= 0.15
      ? { ad: t("asset.directionUp"), sinif: "up" }
      : regime.direction <= -0.15
        ? { ad: t("asset.directionDown"), sinif: "down" }
        : { ad: t("asset.directionFlat"), sinif: "flat" };
  const rozet =
    regime.key === "regime.up" ? "badge-up" : regime.key === "regime.down" ? "badge-down" : "badge-flat";

  return (
    <div className="card">
      <div className="card-title">
        <span>{t("asset.regime")}</span>
        <span className={`badge ${rozet}`}>{t(regime.key)}</span>
      </div>

      <div className="grid-2" style={{ gap: 14, marginBottom: 14 }}>
        <div>
          <div className="dim card-label">
            {t("asset.trendiness")} %{formatNumber(regime.trendiness * 100, intl, 0)}
          </div>
          <Meter value={regime.trendiness * 100} />
        </div>
        <div>
          <div className="dim card-label">
            {t("asset.direction")}: <span className={yon.sinif}>{yon.ad}</span>
          </div>
          <YonCubugu value={regime.direction} />
        </div>
      </div>

      <p className="muted" style={{ fontSize: 13 }}>
        {t(`${regime.key}.note` as "regime.up.note")}
      </p>

      <div className="kv" style={{ marginTop: 14 }}>
        <span>{t("asset.method")}</span>
        <strong>{t(analysis.profileKey)}</strong>
      </div>
      <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
        {t(`${analysis.profileKey}.note` as "profile.equity.note")}
      </p>
    </div>
  );
}

/** −1…+1 arası bir değeri ortadan iki yana açılan çubukla gösterir. */
function YonCubugu({ value }: { value: number }) {
  const oran = Math.min(Math.abs(value), 1) * 50;
  return (
    <div className="yon-cubugu" aria-hidden>
      <i
        style={{
          width: `${oran}%`,
          left: value >= 0 ? "50%" : `${50 - oran}%`,
          background: value >= 0 ? "var(--up)" : "var(--down)",
        }}
      />
    </div>
  );
}

/* ────────────────────────── Geçmiş sınaması ────────────────────────── */

export function SinamaKarti({ analysis }: { analysis: Analysis }) {
  const { t, intl } = useI18n();
  const sinama = analysis.backtest;

  if (!sinama) {
    return (
      <div className="card">
        <div className="card-title">{t("backtest.title")}</div>
        <p className="muted" style={{ fontSize: 13 }}>
          {t("backtest.unavailable")}
        </p>
      </div>
    );
  }

  const yuzde = (oran: number) => `%${formatNumber(oran * 100, intl, 0)}`;
  const satir = (ad: "BUY" | "SELL", sonuc: BacktestSide | null) => {
    const etiket = t(`signal.${ad}` as "signal.BUY");
    if (!sonuc) {
      return (
        <tr key={ad}>
          <th scope="row" className={ad === "BUY" ? "up" : "down"}>
            {etiket}
          </th>
          <td colSpan={5} className="dim">
            {t("backtest.none")}
          </td>
        </tr>
      );
    }
    // Gösterilen fark ham farktır (isabet − taban); hüküm ise küçük örnek
    // için büzülmüş farka bakar. İkisi ayrı tutulur ki tablo doğrulanabilsin.
    const fark = (sonuc.hitRate - sonuc.baseRate) * 100;
    return (
      <tr key={ad}>
        <th scope="row" className={ad === "BUY" ? "up" : "down"}>
          {etiket}
        </th>
        <td className="mono">
          {sonuc.signals}
          {!sonuc.reliable && <span className="dim sinama-az"> · {t("backtest.few")}</span>}
        </td>
        <td className="mono">{yuzde(sonuc.hitRate)}</td>
        <td className="mono dim">{yuzde(sonuc.baseRate)}</td>
        <td className={`mono ${fark > 0 ? "up" : fark < 0 ? "down" : "muted"}`}>
          {t("backtest.points", {
            value: `${fark > 0 ? "+" : fark < 0 ? "−" : ""}${formatNumber(Math.abs(fark), intl, 0)}`,
          })}
        </td>
        <td className={`mono ${sonuc.avgReturn > 0 ? "up" : sonuc.avgReturn < 0 ? "down" : "muted"}`}>
          {formatPercent(sonuc.avgReturn, intl)}
        </td>
      </tr>
    );
  };

  const hukumler = (["BUY", "SELL"] as const)
    .map((ad) => ({ ad, sonuc: ad === "BUY" ? sinama.buy : sinama.sell }))
    .filter((x): x is { ad: "BUY" | "SELL"; sonuc: BacktestSide } => x.sonuc !== null);

  return (
    <div className="card">
      <div className="card-title">
        <span>{t("backtest.title")}</span>
        <span className="pill" style={{ fontSize: 12 }}>
          {t(`interval.${analysis.interval}` as "interval.4h")}
        </span>
      </div>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        {t("backtest.intro", { samples: sinama.samples, horizon: sinama.horizon })}
      </p>

      <div className="tablo-kaydir">
        <table className="sinama-tablo">
          <thead>
            <tr>
              <th />
              <th>{t("backtest.signals")}</th>
              <th>{t("backtest.hit")}</th>
              <th>{t("backtest.base")}</th>
              <th>{t("backtest.edge")}</th>
              <th>{t("backtest.avg")}</th>
            </tr>
          </thead>
          <tbody>
            {satir("BUY", sinama.buy)}
            {satir("SELL", sinama.sell)}
          </tbody>
        </table>
      </div>

      {hukumler.length > 0 && (
        <ul className="bullet-list" style={{ marginTop: 14 }}>
          {hukumler.map(({ ad, sonuc }) => (
            <li key={ad}>
              {t(backtestVerdictKey(sonuc), { side: t(`signal.${ad}` as "signal.BUY") })}
            </li>
          ))}
        </ul>
      )}

      <p className="dim" style={{ fontSize: 12, marginTop: 12 }}>
        {t("backtest.baseHint")} {t("backtest.caveat")}
      </p>
    </div>
  );
}

/* ────────────────────────── Olasılık ve risk matematiği ────────────────────────── */

/**
 * Skorun yanına sayısal bağlam (bkz. lib/quant.ts). Üç ayrı kart:
 *   • OlasilikKarti  — yükseliş olasılığı ve beklenen fiyat aralıkları
 *   • IstatistikKarti — Hurst, z-skor, Sharpe, düşüş, endeksle ilişki
 *   • BeklentiKarti  — sinyalin geçmiş beklentisi ve pozisyon büyüklüğü
 * İlk ikisi yan yana durur; üçüncüsü işlem planının altına, ait olduğu yere girer.
 */

function useKant() {
  const { t, intl } = useI18n();
  return {
    t,
    intl,
    yuzde: (oran: number, basamak = 0) => `%${formatNumber(oran * 100, intl, basamak)}`,
    isaretli: (deger: number, basamak = 2) =>
      `${deger > 0 ? "+" : deger < 0 ? "−" : ""}${formatNumber(Math.abs(deger), intl, basamak)}`,
    ton: (deger: number) => (deger > 0 ? "up" : deger < 0 ? "down" : "muted"),
  };
}

function PeriyotRozeti({ analysis }: { analysis: Analysis }) {
  const { t } = useI18n();
  return (
    <span className="pill" style={{ fontSize: 12 }}>
      {t(`interval.${analysis.interval}` as "interval.4h")}
    </span>
  );
}

export function OlasilikKarti({ analysis }: { analysis: Analysis }) {
  const { t, intl, yuzde } = useKant();
  const q = analysis.quant;
  if (!q) return null;
  const olasilik = q.probability;

  return (
    <div className="card kart-dolu">
      <div className="card-title">
        <span>{t("quant.titleProb")}</span>
        <PeriyotRozeti analysis={analysis} />
      </div>

      {olasilik ? (
        <>
          <div className="dim card-label">
            {t("quant.probUp", { horizon: q.horizon })}:{" "}
            <strong className={olasilik.up >= 0.5 ? "up" : "down"}>{yuzde(olasilik.up)}</strong>
          </div>
          <Meter
            value={olasilik.up * 100}
            tone={olasilik.up >= 0.5 ? "var(--up)" : "var(--down)"}
          />
          <p className="dim" style={{ fontSize: 12, margin: "8px 0 14px" }}>
            {t("quant.probNote", { base: yuzde(olasilik.baseRate), samples: olasilik.samples })}
            {olasilik.slope <= 0 ? ` ${t("quant.probFlat")}` : ""}
          </p>
        </>
      ) : (
        <p className="dim" style={{ fontSize: 12, marginBottom: 14 }}>
          {t("quant.probUnavailable")}
        </p>
      )}

      <div className="kv">
        <span>{t("quant.band1")}</span>
        <strong className="mono">
          {formatPrice(q.expectedMove.low1, intl)} – {formatPrice(q.expectedMove.high1, intl)}
        </strong>
      </div>
      <div className="kv">
        <span>{t("quant.band2")}</span>
        <strong className="mono">
          {formatPrice(q.expectedMove.low2, intl)} – {formatPrice(q.expectedMove.high2, intl)}
        </strong>
      </div>
      <div className="kv">
        <span>{t("quant.sigma", { horizon: q.horizon })}</span>
        <strong className="mono">±%{formatNumber(q.expectedMove.sigmaPercent, intl)}</strong>
      </div>
      <div className="kv">
        <span>{t("quant.volAnnual")}</span>
        <strong className="mono">%{formatNumber(q.volAnnual, intl, 1)}</strong>
      </div>

      <p className="dim kart-dipnot">{t("quant.caveat")}</p>
    </div>
  );
}

export function IstatistikKarti({ analysis }: { analysis: Analysis }) {
  const { t, intl, isaretli, ton } = useKant();
  const q = analysis.quant;
  if (!q) return null;
  const piyasa = q.market;

  return (
    <div className="card kart-dolu">
      <div className="card-title">
        <span>{t("quant.titleStats")}</span>
        <PeriyotRozeti analysis={analysis} />
      </div>

      <div className="kv">
        <span>{t("quant.hurst")}</span>
        <strong className="mono">
          {q.hurst === null ? "—" : formatNumber(q.hurst, intl, 2)}
          {q.hurstKey && <span className="dim"> · {t(q.hurstKey)}</span>}
        </strong>
      </div>
      <div className="kv">
        <span>{t("quant.zScore")}</span>
        <strong className={`mono ${q.zScore === null ? "" : ton(q.zScore)}`}>
          {q.zScore === null ? "—" : `${isaretli(q.zScore)} σ`}
        </strong>
      </div>
      <div className="kv">
        <span>{t("quant.sharpe")}</span>
        <strong className={`mono ${q.sharpe === null ? "" : ton(q.sharpe)}`}>
          {q.sharpe === null ? "—" : isaretli(q.sharpe)}
        </strong>
      </div>
      <div className="kv">
        <span>{t("quant.maxDrawdown")}</span>
        <strong className="mono down">%{formatNumber(Math.abs(q.maxDrawdown), intl, 1)}</strong>
      </div>
      {piyasa && (
        <>
          <div className="kv">
            <span>{t("quant.beta", { ticker: piyasa.ticker })}</span>
            <strong className="mono">{formatNumber(piyasa.beta, intl, 2)}</strong>
          </div>
          <div className="kv">
            <span>{t("quant.correlation")}</span>
            <strong className="mono">{isaretli(piyasa.correlation)}</strong>
          </div>
          <div className="kv">
            <span>{t("quant.alpha")}</span>
            <strong className={`mono ${ton(piyasa.alphaAnnual)}`}>
              {formatPercent(piyasa.alphaAnnual, intl, 1)}
            </strong>
          </div>
        </>
      )}

      <p className="dim kart-dipnot">{t("quant.statsHint")}</p>
    </div>
  );
}

export function BeklentiKarti({ analysis }: { analysis: Analysis }) {
  const { t, intl, yuzde, ton } = useKant();
  const q = analysis.quant;
  if (!q) return null;
  const kenar = q.edge;
  const yon = kenar?.side ?? (analysis.score >= 0 ? "BUY" : "SELL");

  return (
    <div className="card">
      <div className="card-title">
        <span>{t("quant.titleEdge")}</span>
        <span className={`badge ${yon === "BUY" ? "badge-up" : "badge-down"}`}>
          {t(`signal.${yon}` as "signal.BUY")}
        </span>
      </div>

      {kenar ? (
        <>
          {!kenar.reliable && (
            <div className="notice" style={{ marginBottom: 14 }}>
              {t("backtest.verdict.few", { side: t(`signal.${yon}` as "signal.BUY") })}
            </div>
          )}
          <div className="kv">
            <span>{t("quant.expectancy")}</span>
            <strong className={`mono ${ton(kenar.expectancy)}`}>
              {formatPercent(kenar.expectancy, intl)}
            </strong>
          </div>
          <div className="kv">
            <span>{t("quant.winRate")}</span>
            <strong className="mono">
              {yuzde(kenar.winRate)} ({kenar.signals})
            </strong>
          </div>
          <div className="kv">
            <span>{t("quant.payoff")}</span>
            <strong className="mono">{formatNumber(kenar.payoff, intl, 2)} : 1</strong>
          </div>
          <div className="kv">
            <span>{t("quant.profitFactor")}</span>
            <strong className="mono">
              {kenar.profitFactor === null ? "—" : formatNumber(kenar.profitFactor, intl, 2)}
            </strong>
          </div>
          <div className="kv">
            <span>{t("quant.kelly")}</span>
            <strong className={`mono ${kenar.halfKelly > 0 ? "up" : "muted"}`}>
              {kenar.halfKelly > 0 ? yuzde(kenar.halfKelly, 1) : t("quant.noEdge")}
            </strong>
          </div>
        </>
      ) : (
        <p className="dim" style={{ fontSize: 12, marginBottom: 10 }}>
          {t("quant.edgeUnavailable")}
        </p>
      )}
      {q.positionPercent !== null && (
        <div className="kv">
          <span>{t("quant.position")}</span>
          <strong className="mono">%{formatNumber(q.positionPercent, intl, 1)}</strong>
        </div>
      )}

      <p className="dim kart-dipnot">{t("quant.positionHint")}</p>
    </div>
  );
}

/* ────────────────────────── Temel analiz ────────────────────────── */

/** Yalnızca pozitifken anlamlı oranlar (bkz. `lib/fundamentals.ts`, positiveOnly). */
const YALNIZ_POZITIF = new Set<string>(["pe", "pb", "ps", "evEbitda"]);

function puanTonu(puan: number): string {
  return puan >= 57 ? "var(--up)" : puan < 43 ? "var(--down)" : "var(--flat, #f59e0b)";
}

export function TemelKarti({
  fundamentals,
  overallKey,
}: {
  fundamentals: Fundamentals;
  overallKey: string | null;
}) {
  const { t, intl } = useI18n();
  const analist = analystLabel(t, fundamentals.analystRating);
  const rozet =
    fundamentals.score >= 57 ? "badge-up" : fundamentals.score < 43 ? "badge-down" : "badge-flat";

  return (
    <div className="card">
      <div className="card-title">
        <span>{t("fund.title")}</span>
        <span className={`badge ${rozet}`}>{t(fundamentals.gradeKey)}</span>
      </div>

      <div className="temel-ust">
        <div className="temel-puan">
          <strong className="mono" style={{ color: puanTonu(fundamentals.score) }}>
            {fundamentals.score}
          </strong>
          <span className="dim">/ 100</span>
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <p style={{ fontSize: 14 }}>
            {fundamentals.scope === "sector"
              ? t("fund.comparedSector", {
                  sector: sectorName(t, fundamentals.sector),
                  peers: fundamentals.peers,
                })
              : t("fund.comparedMarket", { peers: fundamentals.peers })}
          </p>
          {overallKey && (
            <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
              {t(overallKey as "overall.waitMid")}
            </p>
          )}
        </div>
      </div>

      <div className="temel-sutunlar">
        {fundamentals.pillars.map((sutun) => (
          <div className="temel-sutun" key={sutun.id}>
            <div className="temel-sutun-bas">
              <strong>{t(`fund.pillar.${sutun.id}` as "fund.pillar.growth")}</strong>
              <span className="mono" style={{ color: sutun.score === null ? undefined : puanTonu(sutun.score) }}>
                {sutun.score === null ? "—" : formatNumber(sutun.score, intl, 0)}
              </span>
            </div>
            <Meter
              value={sutun.score ?? 0}
              tone={sutun.score === null ? "var(--border)" : puanTonu(sutun.score)}
            />
            <p className="dim" style={{ fontSize: 12, margin: "8px 0 10px" }}>
              {t(`fund.pillar.${sutun.id}.hint` as "fund.pillar.growth.hint")}
            </p>
            {sutun.metrics.map((olcut) => (
              <div className="temel-olcut" key={olcut.id}>
                <div>
                  <span>{t(`fund.metric.${olcut.id}` as "fund.metric.pe")}</span>
                  <span className="dim temel-olcut-alt">
                    {t("fund.median")}: {metricValue(olcut.id, olcut.median, intl)}
                    {/* Zarar ya da negatif özsermaye sıralamaya "en kötü" diye
                        girer; "emsallerin %0'ından iyi" yazmak bir şey anlatmaz. */}
                    {olcut.percentile !== null &&
                      !(YALNIZ_POZITIF.has(olcut.id) && olcut.value <= 0) &&
                      ` · ${t("fund.better", { p: formatNumber(olcut.percentile, intl, 0) })}`}
                  </span>
                </div>
                <strong className="mono">{metricDisplay(t, olcut, intl)}</strong>
              </div>
            ))}
          </div>
        ))}
      </div>

      {(fundamentals.dividendYield !== null || analist) && (
        <div className="grid-2" style={{ gap: "0 24px", marginTop: 14 }}>
          {fundamentals.dividendYield !== null && (
            <div className="kv">
              <span>{t("fund.dividend")}</span>
              <strong className="mono">%{formatNumber(fundamentals.dividendYield, intl, 2)}</strong>
            </div>
          )}
          {analist && (
            <div className="kv">
              <span>{t("fund.analyst")}</span>
              <strong>{analist}</strong>
            </div>
          )}
        </div>
      )}

      {fundamentals.flags.length > 0 && (
        <ul className="bullet-list warn" style={{ marginTop: 14 }}>
          {fundamentals.flags.map((flag) => (
            <li key={flag}>{t(flag as "fund.flag.loss")}</li>
          ))}
        </ul>
      )}

      <p className="dim" style={{ fontSize: 12, marginTop: 14 }}>
        {finansSektoru(fundamentals.sector) && `${t("fund.financeNote")} `}
        {t("fund.note")}
      </p>
    </div>
  );
}

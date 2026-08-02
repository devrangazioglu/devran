"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import CandleChart, { type Gorunum } from "@/components/CandleChart";
import HataNotu from "@/components/HataNotu";
import { useI18n } from "@/components/I18nProvider";
import IndicatorChart from "@/components/IndicatorChart";
import Reveal from "@/components/motion/Reveal";
import SpotlightCard from "@/components/motion/SpotlightCard";
import {
  AssetAvatar,
  Change,
  Dots,
  MarketBadge,
  Meter,
  ScoreGauge,
  SignalBadge,
  VerdictBadge,
} from "@/components/ui";
import { groupChecks, patternName, patternNote, renderNote, renderValue } from "@/lib/analysis-text";
import { getJson, type AnalyzeResponse } from "@/lib/api-types";
import {
  formatCompact,
  formatNumber,
  formatPercent,
  formatPrice,
  formatRelative,
} from "@/lib/format";
import { MARKETS, type Instrument, type Interval } from "@/lib/markets/types";

export default function AssetClient({
  instrument,
  initialInterval,
  inWatchlist,
  planPeriyotlar,
}: {
  instrument: Instrument;
  initialInterval: string;
  inWatchlist: boolean;
  /** Planın açtığı periyotlar; defter okunamıyorsa null (kısıtlama yok). */
  planPeriyotlar: Interval[] | null;
}) {
  const { t, intl } = useI18n();
  const intervals = MARKETS[instrument.market].intervals;

  const [period, setPeriod] = useState<Interval>(() => {
    const istenen = initialInterval as Interval;
    if (!planPeriyotlar || planPeriyotlar.includes(istenen)) return istenen;
    // Plana kapalı bir periyotla açılmak, sayfayı hatayla karşılamak demek.
    return planPeriyotlar.includes("4h") ? "4h" : planPeriyotlar[planPeriyotlar.length - 1];
  });
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  // Hata nesnesi olduğu gibi saklanır: kodu (kredi/plan) HataNotu okuyor.
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [watched, setWatched] = useState(inWatchlist);
  // Grafiklerin ortak zaman penceresi (yakınlaştırma); null = tamamı.
  const [gorunum, setGorunum] = useState<Gorunum | null>(null);
  const [savingWatch, setSavingWatch] = useState(false);

  const load = useCallback(
    async (selected: Interval) => {
      setLoading(true);
      setError(null);
      try {
        setData(
          await getJson<AnalyzeResponse>(
            `/api/analyze?market=${instrument.market}&symbol=${encodeURIComponent(
              instrument.symbol,
            )}&interval=${selected}`,
          ),
        );
      } catch (caught) {
        setError(caught ?? new Error(t("common.error")));
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [instrument.market, instrument.symbol, t],
  );

  useEffect(() => {
    void load(period);
    // Periyot değişince eski yakınlaştırma yeni seriye uymaz.
    setGorunum(null);
  }, [period, load]);

  async function toggleWatch() {
    setSavingWatch(true);
    try {
      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: instrument.id }),
      });
      if (response.ok) {
        const body = (await response.json()) as { added: boolean };
        setWatched(body.added);
      }
    } finally {
      setSavingWatch(false);
    }
  }

  const analysis = data?.analysis;
  const commentary = data?.commentary;
  const quote = data?.quote;

  return (
    <>
      {/* ── Başlık ─────────────────────────────────────── */}
      <div className="page-head">
        <div className="coin-cell">
          <AssetAvatar ticker={instrument.ticker} market={instrument.market} size={42} />
          <div>
            <h1>{instrument.ticker}</h1>
            <p className="sub">
              <span className="dim">{instrument.name}</span>
              {analysis && (
                <>
                  {" · "}
                  <span className="mono" style={{ color: "var(--text)", fontSize: 16 }}>
                    {formatPrice(analysis.price, intl)}
                  </span>{" "}
                  <span>{instrument.currency}</span>{" "}
                  {quote && <Change value={quote.changePercent} />}{" "}
                  <span className="dim">· {formatRelative(analysis.updatedAt, intl)}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="toolbar">
          <MarketBadge market={instrument.market} />
          <div className="segmented">
            {intervals.map((value) => {
              const acik = !planPeriyotlar || planPeriyotlar.includes(value);
              return (
                <button
                  key={value}
                  className={value === period ? "active" : ""}
                  onClick={() => setPeriod(value)}
                  disabled={!acik}
                  title={acik ? undefined : t("credit.periodLocked")}
                >
                  {acik ? value : `🔒 ${value}`}
                </button>
              );
            })}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={toggleWatch} disabled={savingWatch}>
            {watched ? `★ ${t("watch.unfollow")}` : `☆ ${t("watch.follow")}`}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => void load(period)}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : "↻"} {t("common.refresh")}
          </button>
        </div>
      </div>

      {analysis?.source === "demo" && <div className="notice notice-warn">{t("common.demoNotice")}</div>}
      {data && !data.analysisLocalized && (
        <div className="notice">{t("asset.analysisLangNote")}</div>
      )}
      {instrument.market !== "kripto" && <div className="notice">{t("market.closedNote")}</div>}
      {error ? (
        <>
          <HataNotu hata={error} />
          <p className="muted" style={{ marginTop: -8 }}>
            <Link href="/panel" style={{ textDecoration: "underline" }}>
              {t("asset.backToPanel")}
            </Link>
          </p>
        </>
      ) : null}

      {loading && !data && (
        <div className="stack">
          <div className="skeleton" style={{ height: 180 }} />
          <div className="skeleton" style={{ height: 340 }} />
          <div className="skeleton" style={{ height: 240 }} />
        </div>
      )}

      {analysis && commentary && data && (
        <div className="stack">
          {/* ── Sinyal kartı ────────────────────────────── */}
          <Reveal>
            <SpotlightCard className="card" tilt={false}>
              <div className="signal-hero">
                <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
                  <ScoreGauge score={analysis.score} signal={analysis.signal} />
                  <SignalBadge signal={analysis.signal} />
                </div>

                <div style={{ width: "100%" }}>
                  <h2 style={{ fontSize: 19, marginBottom: 10 }}>{commentary.headline}</h2>
                  <p className="muted" style={{ fontSize: 14, marginBottom: 18 }}>
                    {t("asset.tally", {
                      buy: analysis.tally.buy,
                      sell: analysis.tally.sell,
                      neutral: analysis.tally.neutral,
                      trend: t(analysis.trendStrength.labelKey as "trend.strong"),
                      volatility: t(analysis.volatility.regimeKey as "vol.normal"),
                    })}
                  </p>

                  <div className="grid-3" style={{ gap: 14 }}>
                    <div>
                      <div className="dim card-label">
                        {t("common.confidence")} %{analysis.confidence}
                      </div>
                      <Meter value={analysis.confidence} />
                    </div>
                    <div>
                      <div className="dim card-label">{t("asset.buyVotes")}</div>
                      <Meter
                        value={(analysis.tally.buy / analysis.checks.length) * 100}
                        tone="var(--up)"
                      />
                    </div>
                    <div>
                      <div className="dim card-label">{t("asset.sellVotes")}</div>
                      <Meter
                        value={(analysis.tally.sell / analysis.checks.length) * 100}
                        tone="var(--down)"
                      />
                    </div>
                  </div>

                  {data.timeframes.length > 0 && (
                    <div className="timeframe-row">
                      <span className="dim" style={{ fontSize: 12 }}>
                        {t("asset.otherTimeframes")}:
                      </span>
                      {data.timeframes.map((frame) => (
                        <button
                          key={frame.interval}
                          className="pill"
                          onClick={() => setPeriod(frame.interval)}
                        >
                          {frame.interval}
                          <span
                            className={
                              frame.score > 18 ? "up" : frame.score < -18 ? "down" : "flat"
                            }
                            style={{ fontWeight: 600 }}
                          >
                            {t(`signal.${frame.signal}` as "signal.BUY")}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </SpotlightCard>
          </Reveal>

          {/* ── Grafikler ───────────────────────────────── */}
          <CandleChart
            candles={data.candles}
            overlays={{
              ema21: data.series.ema21,
              ema50: data.series.ema50,
              ema200: data.series.ema200,
              bbUpper: data.series.bbUpper,
              bbLower: data.series.bbLower,
            }}
            intl={intl}
            gorunum={gorunum}
            onGorunum={setGorunum}
            etiketler={{
              yatay: t("chart.time"),
              dikey: t("chart.price"),
              sifirla: t("chart.reset"),
              yakinlastir: t("chart.zoomIn"),
              uzaklastir: t("chart.zoomOut"),
              ipucu: t("chart.hint"),
            }}
          />

          <div className="grid-2">
            <IndicatorChart
              title="RSI (14)"
              lines={[{ values: data.series.rsi, color: "#8ff0a4", label: "RSI" }]}
              guides={[30, 50, 70]}
              min={0}
              max={100}
              gorunum={gorunum}
            />
            <IndicatorChart
              title="MACD (12, 26, 9)"
              lines={[
                { values: data.series.macd, color: "#60a5fa", label: "MACD" },
                { values: data.series.macdSignal, color: "#f59e0b", label: t("common.signal") },
              ]}
              histogram={data.series.macdHistogram}
              guides={[0]}
              gorunum={gorunum}
            />
          </div>

          {/* ── Yorum + plan ────────────────────────────── */}
          <div className="split">
            <Reveal>
              <div className="card">
                <div className="card-title">
                  <span>{t("asset.analysisComment")}</span>
                  <span className="pill" style={{ fontSize: 12 }}>
                    {t(`interval.${analysis.interval}` as "interval.4h")}
                  </span>
                </div>
                <div className="prose">
                  {commentary.paragraphs.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>

                {commentary.highlights.length > 0 && (
                  <>
                    <h3 style={{ fontSize: 14, margin: "22px 0 12px" }}>{t("asset.highlights")}</h3>
                    <ul className="bullet-list">
                      {commentary.highlights.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </>
                )}

                <h3 style={{ fontSize: 14, margin: "22px 0 12px" }}>{t("asset.risks")}</h3>
                <ul className="bullet-list warn">
                  {commentary.risks.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <div className="stack">
              {/* İşlem planı */}
              <Reveal delay={60}>
                <div className="card">
                  <div className="card-title">
                    <span>{t("asset.plan")}</span>
                    <span
                      className={`badge ${analysis.trade.side === "LONG" ? "badge-up" : "badge-down"}`}
                    >
                      {analysis.trade.side === "LONG" ? t("asset.planLong") : t("asset.planShort")}
                    </span>
                  </div>
                  {analysis.trade.advisory && (
                    <div className="notice" style={{ marginBottom: 14 }}>
                      {t("asset.planAdvisory")}
                    </div>
                  )}
                  <div className="kv">
                    <span>{t("asset.entry")}</span>
                    <strong className="mono">{formatPrice(analysis.trade.entry, intl)}</strong>
                  </div>
                  <div className="kv">
                    <span>{t("asset.stopLoss")}</span>
                    <strong className="mono down">
                      {formatPrice(analysis.trade.stopLoss, intl)}
                    </strong>
                  </div>
                  {analysis.trade.targets.map((target, index) => (
                    <div className="kv" key={index}>
                      <span>{t("asset.target", { n: index + 1 })}</span>
                      <strong className="mono up">{formatPrice(target, intl)}</strong>
                    </div>
                  ))}
                  <div className="kv">
                    <span>{t("asset.risk")}</span>
                    <strong className="mono">
                      %{formatNumber(analysis.trade.riskPercent, intl)}
                    </strong>
                  </div>
                  <div className="kv">
                    <span>{t("asset.riskReward")}</span>
                    <strong className="mono">
                      {formatNumber(analysis.trade.riskReward, intl, 2)} : 1
                    </strong>
                  </div>
                  <div className="kv">
                    <span>{t("asset.atr")}</span>
                    <strong className="mono">
                      {formatPrice(analysis.trade.atr, intl)} (%
                      {formatNumber(analysis.trade.atrPercent, intl)})
                    </strong>
                  </div>
                </div>
              </Reveal>

              {/* Seviyeler */}
              <Reveal delay={120}>
                <div className="card">
                  <div className="card-title">{t("asset.levels")}</div>
                  {analysis.levels.resistances.length === 0 &&
                  analysis.levels.supports.length === 0 ? (
                    <p className="muted" style={{ fontSize: 13 }}>
                      {t("asset.noLevels")}
                    </p>
                  ) : (
                    <>
                      {[...analysis.levels.resistances].reverse().map((level, index) => (
                        <div className="level-bar" key={`r${index}`}>
                          <span className="down">{t("asset.resistance")}</span>
                          <strong className="mono">{formatPrice(level.price, intl)}</strong>
                          <span className="dim">
                            {formatPercent(level.distancePercent, intl)}
                          </span>
                          <Dots value={level.strength} />
                        </div>
                      ))}
                      <div className="level-bar level-current">
                        <span className="muted">{t("asset.current")}</span>
                        <strong className="mono">{formatPrice(analysis.price, intl)}</strong>
                        <span />
                        <span />
                      </div>
                      {analysis.levels.supports.map((level, index) => (
                        <div className="level-bar" key={`s${index}`}>
                          <span className="up">{t("asset.support")}</span>
                          <strong className="mono">{formatPrice(level.price, intl)}</strong>
                          <span className="dim">
                            {formatPercent(level.distancePercent, intl)}
                          </span>
                          <Dots value={level.strength} />
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </Reveal>

              {/* Formasyonlar */}
              <Reveal delay={160}>
                <div className="card">
                  <div className="card-title">{t("asset.patterns")}</div>
                  {analysis.patterns.length === 0 ? (
                    <p className="muted" style={{ fontSize: 13 }}>
                      {t("asset.noPatterns")}
                    </p>
                  ) : (
                    <div className="stack" style={{ gap: 12 }}>
                      {analysis.patterns.map((pattern) => (
                        <div key={pattern.id}>
                          <div className="pattern-head">
                            <strong style={{ fontSize: 14, fontWeight: 500 }}>
                              {patternName(t, pattern.id)}
                            </strong>
                            <VerdictBadge verdict={pattern.bias} />
                          </div>
                          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                            {patternNote(t, pattern.id)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Reveal>

              {/* Gün içi */}
              {quote && (
                <Reveal delay={200}>
                  <div className="card">
                    <div className="card-title">{t("asset.dayStats")}</div>
                    <div className="kv">
                      <span>{t("common.high")}</span>
                      <strong className="mono">{formatPrice(quote.high, intl)}</strong>
                    </div>
                    <div className="kv">
                      <span>{t("common.low")}</span>
                      <strong className="mono">{formatPrice(quote.low, intl)}</strong>
                    </div>
                    <div className="kv">
                      <span>{t("common.change")}</span>
                      <strong>
                        <Change value={quote.changePercent} />
                      </strong>
                    </div>
                    <div className="kv">
                      <span>{t("common.volume")}</span>
                      <strong className="mono">
                        {formatCompact(quote.volume, intl)} {quote.currency}
                      </strong>
                    </div>
                  </div>
                </Reveal>
              )}
            </div>
          </div>

          {/* ── Gösterge tablosu ────────────────────────── */}
          <div className="grid-2">
            {groupChecks(analysis.checks).map((group) => (
              <Reveal key={group.category}>
                <div className="card">
                  <div className="card-title">
                    <span>{t(`category.${group.category}` as "category.trend")}</span>
                    <span className="dim" style={{ fontSize: 12 }}>
                      {t("common.indicatorCount", { count: group.items.length })}
                    </span>
                  </div>
                  {group.items.map((check) => (
                    <div className="check-row" key={check.id}>
                      <div>
                        <div className="name">{t(check.labelKey as "ind.rsi")}</div>
                        <div className="note">{renderNote(t, check)}</div>
                      </div>
                      <div className="value mono dim" style={{ fontSize: 13 }}>
                        {renderValue(check.value, intl)}
                      </div>
                      <VerdictBadge verdict={check.verdict} />
                    </div>
                  ))}

                  {group.category === "volatility" && (
                    <div style={{ marginTop: 14 }}>
                      <div className="kv">
                        <span>{t("asset.atr")}</span>
                        <strong className="mono">
                          {formatPrice(analysis.trade.atr, intl)} (%
                          {formatNumber(analysis.volatility.atrPercent, intl)})
                        </strong>
                      </div>
                      <div className="kv">
                        <span>{t("asset.bandwidth")}</span>
                        <strong className="mono">
                          {analysis.indicators.bbBandwidth === null
                            ? "—"
                            : `%${formatNumber(analysis.indicators.bbBandwidth, intl)}`}
                        </strong>
                      </div>
                      <div className="kv">
                        <span>{t("asset.volatilityRegime")}</span>
                        <strong>{t(analysis.volatility.regimeKey as "vol.normal")}</strong>
                      </div>
                      <div className="kv">
                        <span>{t("asset.squeeze")}</span>
                        <strong className={analysis.volatility.squeeze ? "flat" : "muted"}>
                          {analysis.volatility.squeeze
                            ? t("asset.squeezeYes")
                            : t("asset.squeezeNo")}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

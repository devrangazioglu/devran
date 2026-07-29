"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import CandleChart from "@/components/CandleChart";
import IndicatorChart from "@/components/IndicatorChart";
import {
  Change,
  CoinAvatar,
  Dots,
  Meter,
  ScoreGauge,
  SignalBadge,
  VerdictBadge,
} from "@/components/ui";
import { getJson, type AnalyzeResponse } from "@/lib/api-types";
import { INTERVALS, type Interval } from "@/lib/binance";
import { groupChecks } from "@/lib/commentary";
import {
  formatCompact,
  formatNumber,
  formatPercent,
  formatPrice,
  formatRelative,
} from "@/lib/format";

export default function CoinClient({
  symbol,
  initialInterval,
  inWatchlist,
}: {
  symbol: string;
  initialInterval: string;
  inWatchlist: boolean;
}) {
  const [period, setPeriod] = useState<Interval>(
    (INTERVALS.find((i) => i.value === initialInterval)?.value ?? "4h") as Interval,
  );
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [watched, setWatched] = useState(inWatchlist);
  const [savingWatch, setSavingWatch] = useState(false);

  const load = useCallback(
    async (selected: Interval) => {
      setLoading(true);
      setError(null);
      try {
        setData(
          await getJson<AnalyzeResponse>(
            `/api/analyze?symbol=${encodeURIComponent(symbol)}&interval=${selected}`,
          ),
        );
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Analiz alınamadı.");
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [symbol],
  );

  useEffect(() => {
    void load(period);
  }, [period, load]);

  async function toggleWatch() {
    setSavingWatch(true);
    try {
      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbol }),
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
  const ticker = data?.ticker;
  const commentary = data?.commentary;

  return (
    <>
      {/* ── Başlık ─────────────────────────────────────── */}
      <div className="page-head">
        <div className="coin-cell">
          <CoinAvatar base={analysis?.base ?? symbol.slice(0, 3)} size={42} />
          <div>
            <h1>
              {analysis ? `${analysis.base}/${analysis.quote}` : symbol}
            </h1>
            <p className="sub">
              {analysis ? (
                <>
                  <span className="mono" style={{ color: "var(--text)", fontSize: 16 }}>
                    {formatPrice(analysis.price)}
                  </span>{" "}
                  {ticker && <Change value={ticker.priceChangePercent} />}{" "}
                  <span className="dim">
                    · {analysis.intervalLabel} · {formatRelative(analysis.updatedAt)}
                  </span>
                </>
              ) : (
                "Analiz hazırlanıyor…"
              )}
            </p>
          </div>
        </div>

        <div className="toolbar">
          <div className="segmented">
            {INTERVALS.map((item) => (
              <button
                key={item.value}
                className={item.value === period ? "active" : ""}
                onClick={() => setPeriod(item.value)}
              >
                {item.value}
              </button>
            ))}
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={toggleWatch}
            disabled={savingWatch}
          >
            {watched ? "★ Takipten çıkar" : "☆ Takibe al"}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => void load(period)} disabled={loading}>
            {loading ? <span className="spinner" /> : "↻"} Yenile
          </button>
        </div>
      </div>

      {analysis?.source === "demo" && (
        <div className="notice notice-warn">
          Binance API&apos;sine ulaşılamadı; <strong>demo veriyle</strong> analiz gösteriliyor.
          Sayılar gerçek piyasayı yansıtmaz.
        </div>
      )}
      {error && (
        <div className="notice notice-error">
          {error}{" "}
          <Link href="/panel" style={{ textDecoration: "underline" }}>
            Panele dön
          </Link>
        </div>
      )}

      {loading && !data && (
        <div className="stack">
          <div className="skeleton" style={{ height: 180 }} />
          <div className="skeleton" style={{ height: 380 }} />
          <div className="skeleton" style={{ height: 240 }} />
        </div>
      )}

      {analysis && commentary && data && (
        <div className="stack">
          {/* ── Sinyal kartı ────────────────────────────── */}
          <div className="card">
            <div className="signal-hero">
              <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
                <ScoreGauge score={analysis.score} signal={analysis.signal} />
                <SignalBadge signal={analysis.signal} />
              </div>

              <div style={{ width: "100%" }}>
                <h2 style={{ fontSize: 20, marginBottom: 10 }}>{commentary.headline}</h2>
                <p className="muted" style={{ fontSize: 14, marginBottom: 18 }}>
                  {analysis.tally.al} gösterge alış, {analysis.tally.sat} gösterge satış,{" "}
                  {analysis.tally.notr} gösterge nötr yönde. Trend gücü:{" "}
                  <strong style={{ color: "var(--text)" }}>{analysis.trendStrength.label}</strong>{" "}
                  · Volatilite: <strong style={{ color: "var(--text)" }}>{analysis.volatility.regime}</strong>
                </p>

                <div className="grid-3" style={{ gap: 14 }}>
                  <div>
                    <div className="dim" style={{ fontSize: 12, marginBottom: 6 }}>
                      GÜVEN %{analysis.confidence}
                    </div>
                    <Meter value={analysis.confidence} />
                  </div>
                  <div>
                    <div className="dim" style={{ fontSize: 12, marginBottom: 6 }}>
                      ALIŞ OYU
                    </div>
                    <Meter
                      value={(analysis.tally.al / analysis.checks.length) * 100}
                      tone="var(--up)"
                    />
                  </div>
                  <div>
                    <div className="dim" style={{ fontSize: 12, marginBottom: 6 }}>
                      SATIŞ OYU
                    </div>
                    <Meter
                      value={(analysis.tally.sat / analysis.checks.length) * 100}
                      tone="var(--down)"
                    />
                  </div>
                </div>

                {/* Çoklu zaman dilimi uyumu */}
                {data.timeframes.length > 0 && (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
                    <span className="dim" style={{ fontSize: 12, alignSelf: "center" }}>
                      DİĞER PERİYOTLAR:
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
                          {frame.signal}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

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
          />

          <div className="grid-2">
            <IndicatorChart
              title="RSI (14)"
              lines={[{ values: data.series.rsi, color: "#8ff0a4", label: "RSI" }]}
              guides={[30, 50, 70]}
              min={0}
              max={100}
            />
            <IndicatorChart
              title="MACD (12, 26, 9)"
              lines={[
                { values: data.series.macd, color: "#60a5fa", label: "MACD" },
                { values: data.series.macdSignal, color: "#f59e0b", label: "Sinyal" },
              ]}
              histogram={data.series.macdHistogram}
              guides={[0]}
            />
          </div>

          {/* ── Yorum + plan ────────────────────────────── */}
          <div className="split">
            <div className="card">
              <div className="card-title">
                <span>Analiz yorumu</span>
                <span className="pill" style={{ fontSize: 12 }}>
                  {analysis.intervalLabel}
                </span>
              </div>
              <div className="prose">
                {commentary.paragraphs.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>

              {commentary.highlights.length > 0 && (
                <>
                  <h3 style={{ fontSize: 14, margin: "22px 0 12px" }}>Öne çıkanlar</h3>
                  <ul className="bullet-list">
                    {commentary.highlights.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </>
              )}

              <h3 style={{ fontSize: 14, margin: "22px 0 12px" }}>Riskler ve uyarılar</h3>
              <ul className="bullet-list warn">
                {commentary.risks.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="stack">
              {/* İşlem planı */}
              <div className="card">
                <div className="card-title">
                  <span>İşlem planı</span>
                  <span
                    className={`badge ${
                      analysis.trade.side === "LONG" ? "badge-up" : "badge-down"
                    }`}
                  >
                    {analysis.trade.side === "LONG" ? "UZUN / ALIŞ" : "KISA / SATIŞ"}
                  </span>
                </div>
                {analysis.trade.advisory && (
                  <div className="notice" style={{ marginBottom: 14 }}>
                    Sinyal &quot;BEKLE&quot; olduğu için bu plan yalnızca senaryodur.
                  </div>
                )}
                <div className="kv">
                  <span>Giriş</span>
                  <strong className="mono">{formatPrice(analysis.trade.entry)}</strong>
                </div>
                <div className="kv">
                  <span>Zarar durdur</span>
                  <strong className="mono down">{formatPrice(analysis.trade.stopLoss)}</strong>
                </div>
                {analysis.trade.targets.map((target, index) => (
                  <div className="kv" key={index}>
                    <span>Hedef {index + 1}</span>
                    <strong className="mono up">{formatPrice(target)}</strong>
                  </div>
                ))}
                <div className="kv">
                  <span>Risk</span>
                  <strong className="mono">%{formatNumber(analysis.trade.riskPercent)}</strong>
                </div>
                <div className="kv">
                  <span>Risk / ödül</span>
                  <strong className="mono">
                    {formatNumber(analysis.trade.riskReward, 2)} : 1
                  </strong>
                </div>
                <div className="kv">
                  <span>ATR (14)</span>
                  <strong className="mono">
                    {formatPrice(analysis.trade.atr)} (%
                    {formatNumber(analysis.trade.atrPercent)})
                  </strong>
                </div>
              </div>

              {/* Seviyeler */}
              <div className="card">
                <div className="card-title">Destek ve direnç</div>
                {analysis.levels.resistances.length === 0 &&
                analysis.levels.supports.length === 0 ? (
                  <p className="muted" style={{ fontSize: 13 }}>
                    Bu veri aralığında belirgin bir pivot seviyesi bulunamadı.
                  </p>
                ) : (
                  <>
                    {[...analysis.levels.resistances].reverse().map((level, index) => (
                      <div className="level-bar" key={`r${index}`}>
                        <span className="down">Direnç</span>
                        <strong className="mono">{formatPrice(level.price)}</strong>
                        <span className="dim">{formatPercent(level.distancePercent)}</span>
                        <Dots value={level.strength} />
                      </div>
                    ))}
                    <div
                      className="level-bar"
                      style={{
                        borderColor: "rgba(143,240,164,0.4)",
                        background: "var(--accent-dim)",
                      }}
                    >
                      <span className="muted">Güncel</span>
                      <strong className="mono">{formatPrice(analysis.price)}</strong>
                      <span />
                      <span />
                    </div>
                    {analysis.levels.supports.map((level, index) => (
                      <div className="level-bar" key={`s${index}`}>
                        <span className="up">Destek</span>
                        <strong className="mono">{formatPrice(level.price)}</strong>
                        <span className="dim">{formatPercent(level.distancePercent)}</span>
                        <Dots value={level.strength} />
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Formasyonlar */}
              <div className="card">
                <div className="card-title">Formasyonlar</div>
                {analysis.patterns.length === 0 ? (
                  <p className="muted" style={{ fontSize: 13 }}>
                    Son mumlarda tanımlı bir formasyon tespit edilmedi.
                  </p>
                ) : (
                  <div className="stack" style={{ gap: 12 }}>
                    {analysis.patterns.map((pattern) => (
                      <div key={pattern.id}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            alignItems: "center",
                          }}
                        >
                          <strong style={{ fontSize: 14, fontWeight: 500 }}>
                            {pattern.name}
                          </strong>
                          <VerdictBadge verdict={pattern.bias} />
                        </div>
                        <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                          {pattern.note}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 24 saat özeti */}
              {ticker && (
                <div className="card">
                  <div className="card-title">24 saat</div>
                  <div className="kv">
                    <span>En yüksek</span>
                    <strong className="mono">{formatPrice(ticker.highPrice)}</strong>
                  </div>
                  <div className="kv">
                    <span>En düşük</span>
                    <strong className="mono">{formatPrice(ticker.lowPrice)}</strong>
                  </div>
                  <div className="kv">
                    <span>Değişim</span>
                    <strong>
                      <Change value={ticker.priceChangePercent} />
                    </strong>
                  </div>
                  <div className="kv">
                    <span>Hacim</span>
                    <strong className="mono">{formatCompact(ticker.quoteVolume)} {ticker.quote}</strong>
                  </div>
                  <div className="kv">
                    <span>İşlem sayısı</span>
                    <strong className="mono">{formatCompact(ticker.trades)}</strong>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Gösterge tablosu ────────────────────────── */}
          <div className="grid-2">
            {groupChecks(analysis.checks).map((group) => (
              <div className="card" key={group.category}>
                <div className="card-title">
                  <span>{group.category}</span>
                  <span className="dim" style={{ fontSize: 12 }}>
                    {group.items.length} gösterge
                  </span>
                </div>
                {group.items.map((check) => (
                  <div className="check-row" key={check.id}>
                    <div>
                      <div className="name">{check.name}</div>
                      <div className="note">{check.note}</div>
                    </div>
                    <div className="value mono dim" style={{ fontSize: 13 }}>
                      {check.value}
                    </div>
                    <VerdictBadge verdict={check.verdict} />
                  </div>
                ))}

                {/* Volatilite kartında skora girmeyen ölçümler de gösterilir. */}
                {group.category === "Volatilite" && (
                  <div style={{ marginTop: 14 }}>
                    <div className="kv">
                      <span>ATR (14)</span>
                      <strong className="mono">
                        {formatPrice(analysis.trade.atr)} (%
                        {formatNumber(analysis.volatility.atrPercent)})
                      </strong>
                    </div>
                    <div className="kv">
                      <span>Bollinger bant genişliği</span>
                      <strong className="mono">
                        {analysis.indicators.bbBandwidth === null
                          ? "—"
                          : `%${formatNumber(analysis.indicators.bbBandwidth)}`}
                      </strong>
                    </div>
                    <div className="kv">
                      <span>Volatilite rejimi</span>
                      <strong>{analysis.volatility.regime}</strong>
                    </div>
                    <div className="kv">
                      <span>Bant sıkışması</span>
                      <strong className={analysis.volatility.squeeze ? "flat" : "muted"}>
                        {analysis.volatility.squeeze ? "var (kırılım beklentisi)" : "yok"}
                      </strong>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

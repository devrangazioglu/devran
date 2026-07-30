"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useI18n } from "@/components/I18nProvider";
import { AssetAvatar, Change, MarketBadge, Score, SignalBadge } from "@/components/ui";
import { isBuySignal, isSellSignal } from "@/lib/analysis";
import { patternName } from "@/lib/analysis-text";
import { getJson, type ScanResponse, type ScanRow } from "@/lib/api-types";
import { formatCompact, formatNumber, formatPrice, formatRelative } from "@/lib/format";
import { MARKETS, MARKET_IDS, type Interval, type MarketId } from "@/lib/markets/types";

type Filter = "all" | "buy" | "sell" | "watch";
type SortKey = "score" | "confidence" | "change" | "volume" | "rsi";

export default function ScannerClient({
  defaultMarket,
  defaultInterval,
  defaultLimit,
  onlyStrong,
  watchlist,
}: {
  defaultMarket: string;
  defaultInterval: string;
  defaultLimit: number;
  onlyStrong: boolean;
  watchlist: string[];
}) {
  const { t, intl } = useI18n();

  const [market, setMarket] = useState<MarketId>(
    (MARKET_IDS.includes(defaultMarket as MarketId) ? defaultMarket : "kripto") as MarketId,
  );
  const [period, setPeriod] = useState<Interval>(defaultInterval as Interval);
  const [limit, setLimit] = useState(defaultLimit);
  const [filter, setFilter] = useState<Filter>("all");
  const [strongOnly, setStrongOnly] = useState(onlyStrong);
  const [sort, setSort] = useState<SortKey>("score");
  const [data, setData] = useState<ScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!MARKETS[market].intervals.includes(period)) {
      setPeriod(MARKETS[market].intervals.includes("1d") ? "1d" : MARKETS[market].intervals[0]);
    }
  }, [market, period]);

  const run = useCallback(async () => {
    if (!MARKETS[market].intervals.includes(period)) return;
    setLoading(true);
    setError(null);
    try {
      setData(
        await getJson<ScanResponse>(
          `/api/scan?market=${market}&interval=${period}&limit=${limit}`,
        ),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [market, period, limit, t]);

  useEffect(() => {
    void run();
  }, [run]);

  const rows = useMemo(() => {
    let list = [...(data?.rows ?? [])];

    if (filter === "buy") list = list.filter((r) => isBuySignal(r.signal));
    if (filter === "sell") list = list.filter((r) => isSellSignal(r.signal));
    if (filter === "watch") list = list.filter((r) => watchlist.includes(r.id));
    if (strongOnly) list = list.filter((r) => r.signal === "STRONG_BUY" || r.signal === "STRONG_SELL");

    const comparators: Record<SortKey, (a: ScanRow, b: ScanRow) => number> = {
      score: (a, b) => b.score - a.score,
      confidence: (a, b) => b.confidence - a.confidence,
      change: (a, b) => b.changePercent - a.changePercent,
      volume: (a, b) => b.volume - a.volume,
      rsi: (a, b) => (b.rsi ?? 0) - (a.rsi ?? 0),
    };
    return list.sort(comparators[sort]);
  }, [data, filter, strongOnly, sort, watchlist]);

  const counts = useMemo(() => {
    const list = data?.rows ?? [];
    return {
      buy: list.filter((r) => isBuySignal(r.signal)).length,
      sell: list.filter((r) => isSellSignal(r.signal)).length,
      wait: list.filter((r) => r.signal === "WAIT").length,
    };
  }, [data]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t("scan.title")}</h1>
          <p className="sub">
            {t("scan.sub", {
              market: t(`market.${market}` as "market.kripto"),
              count: limit,
              interval: period,
            })}
            {data && ` · ${t("scan.scanned", { count: data.scanned })} · ${formatRelative(data.updatedAt, intl)}`}
          </p>
        </div>
        <div className="toolbar">
          <div className="segmented">
            {MARKET_IDS.map((id) => (
              <button key={id} className={id === market ? "active" : ""} onClick={() => setMarket(id)}>
                {t(`market.${id}` as "market.kripto")}
              </button>
            ))}
          </div>
          <div className="segmented">
            {MARKETS[market].intervals.map((value) => (
              <button
                key={value}
                className={value === period ? "active" : ""}
                onClick={() => setPeriod(value)}
              >
                {value}
              </button>
            ))}
          </div>
          <select className="select" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            {[10, 20, 30, 40, 60].map((value) => (
              <option key={value} value={value}>
                {t("scan.assetCount", { count: value })}
              </option>
            ))}
          </select>
          <button className="btn btn-primary btn-sm" onClick={() => void run()} disabled={loading}>
            {loading ? <span className="spinner" /> : null}
            {loading ? t("scan.scanning") : t("scan.rescan")}
          </button>
        </div>
      </div>

      {data?.source === "demo" && <div className="notice notice-warn">{t("common.demoNotice")}</div>}
      {error && <div className="notice notice-error">{error}</div>}

      <div className="grid-4" style={{ marginBottom: 18 }}>
        <div className="card compact">
          <div className="dim card-label">{t("scan.buyCount")}</div>
          <strong className="up" style={{ fontSize: 24 }}>
            {counts.buy}
          </strong>
        </div>
        <div className="card compact">
          <div className="dim card-label">{t("scan.sellCount")}</div>
          <strong className="down" style={{ fontSize: 24 }}>
            {counts.sell}
          </strong>
        </div>
        <div className="card compact">
          <div className="dim card-label">{t("scan.waitCount")}</div>
          <strong className="flat" style={{ fontSize: 24 }}>
            {counts.wait}
          </strong>
        </div>
        <div className="card compact">
          <div className="dim card-label">{t("scan.bias")}</div>
          <strong style={{ fontSize: 17 }}>
            {counts.buy > counts.sell * 1.5
              ? t("scan.biasBull")
              : counts.sell > counts.buy * 1.5
                ? t("scan.biasBear")
                : t("scan.biasMixed")}
          </strong>
        </div>
      </div>

      <div className="toolbar" style={{ marginBottom: 14 }}>
        <div className="segmented">
          {(
            [
              ["all", t("common.all")],
              ["buy", t("scan.filterBuy")],
              ["sell", t("scan.filterSell")],
              ["watch", t("scan.filterWatch")],
            ] as [Filter, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              className={filter === value ? "active" : ""}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="score">{t("scan.sortScore")}</option>
          <option value="confidence">{t("scan.sortConfidence")}</option>
          <option value="change">{t("scan.sortChange")}</option>
          <option value="volume">{t("scan.sortVolume")}</option>
          <option value="rsi">{t("scan.sortRsi")}</option>
        </select>
        <label className="pill" style={{ cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={strongOnly}
            onChange={(e) => setStrongOnly(e.target.checked)}
          />
          {t("scan.onlyStrong")}
        </label>
      </div>

      {/* Masaüstü tablo */}
      <div className="only-desktop">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{t("common.asset")}</th>
                <th className="num">{t("common.price")}</th>
                <th className="num">{t("common.change")}</th>
                <th>{t("common.signal")}</th>
                <th className="num">{t("common.score")}</th>
                <th className="num">{t("common.confidence")}</th>
                <th className="num">RSI</th>
                <th className="num">ADX</th>
                <th className="num">ATR %</th>
                <th>{t("common.pattern")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                Array.from({ length: 10 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={12}>
                      <div className="skeleton" style={{ height: 18 }} />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ textAlign: "center", padding: 30 }}>
                    <span className="muted">{t("scan.empty")}</span>
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={row.id}>
                    <td className="dim">{index + 1}</td>
                    <td>
                      <Link
                        href={`/varlik/${row.market}/${encodeURIComponent(row.symbol)}?interval=${period}`}
                        className="coin-cell"
                      >
                        <AssetAvatar ticker={row.ticker} market={row.market} />
                        <span>
                          <strong style={{ fontWeight: 500 }}>{row.ticker}</strong>
                          <span className="dim block-sub">{row.name}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="num mono">{formatPrice(row.price, intl)}</td>
                    <td className="num">
                      <Change value={row.changePercent} />
                    </td>
                    <td>
                      <SignalBadge signal={row.signal} />
                    </td>
                    <td className="num">
                      <Score value={row.score} />
                    </td>
                    <td className="num mono">%{row.confidence}</td>
                    <td className="num mono">
                      {row.rsi === null ? "—" : formatNumber(row.rsi, intl, 0)}
                    </td>
                    <td className="num mono">
                      {row.adx === null ? "—" : formatNumber(row.adx, intl, 0)}
                    </td>
                    <td className="num mono dim">{formatNumber(row.atrPercent, intl, 1)}</td>
                    <td className="dim pattern-cell">
                      {row.patterns.length
                        ? row.patterns.map((id) => patternName(t, id)).join(", ")
                        : "—"}
                    </td>
                    <td className="num">
                      <Link
                        href={`/varlik/${row.market}/${encodeURIComponent(row.symbol)}?interval=${period}`}
                        className="btn btn-ghost btn-sm"
                      >
                        {t("common.details")}
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobil kartlar */}
      <div className="only-mobile quote-cards">
        {rows.map((row, index) => (
          <Link
            key={row.id}
            href={`/varlik/${row.market}/${encodeURIComponent(row.symbol)}?interval=${period}`}
            className="quote-card"
          >
            <span className="top-rank">{index + 1}</span>
            <AssetAvatar ticker={row.ticker} market={row.market} size={32} />
            <div className="quote-card-main">
              <strong>{row.ticker}</strong>
              <span className="dim">
                <Score value={row.score} /> · %{row.confidence}
              </span>
            </div>
            <div className="quote-card-side">
              <SignalBadge signal={row.signal} />
              <span className="mono dim">{formatPrice(row.price, intl)}</span>
            </div>
          </Link>
        ))}
        {rows.length === 0 && !loading && <p className="muted">{t("scan.empty")}</p>}
      </div>

      {data && (
        <p className="dim" style={{ fontSize: 12, marginTop: 14 }}>
          {t("scan.footnote")} · {t("common.volume")}:{" "}
          {formatCompact(
            (data.rows ?? []).reduce((sum, r) => sum + r.volume, 0),
            intl,
          )}
        </p>
      )}
    </>
  );
}

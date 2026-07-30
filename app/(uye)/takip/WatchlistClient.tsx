"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import AssetSearch from "@/components/AssetSearch";
import { useI18n } from "@/components/I18nProvider";
import { AssetAvatar, Change, MarketBadge, Score, SignalBadge } from "@/components/ui";
import { getJson, type ScanResponse } from "@/lib/api-types";
import { formatNumber, formatPrice } from "@/lib/format";
import { MARKETS, type Instrument, type Interval } from "@/lib/markets/types";

const PERIODS: Interval[] = ["15m", "1h", "4h", "1d", "1w"];

export default function WatchlistClient({
  initialIds,
  defaultInterval,
}: {
  initialIds: string[];
  defaultInterval: string;
}) {
  const { t, intl } = useI18n();
  const [ids, setIds] = useState(initialIds);
  const [period, setPeriod] = useState<Interval>(defaultInterval as Interval);
  const [data, setData] = useState<ScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (list: string[], selected: Interval) => {
      if (list.length === 0) {
        setData(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        setData(
          await getJson<ScanResponse>(
            `/api/scan?interval=${selected}&ids=${encodeURIComponent(list.join(","))}`,
          ),
        );
      } catch (caught) {
        setData(null);
        setError(caught instanceof Error ? caught.message : t("common.error"));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    void load(ids, period);
  }, [ids, period, load]);

  async function toggle(id: string) {
    setSaving(true);
    try {
      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? t("common.error"));
        return;
      }
      const body = (await response.json()) as { watchlist: string[] };
      setIds(body.watchlist);
    } finally {
      setSaving(false);
    }
  }

  function add(instrument: Instrument) {
    if (ids.includes(instrument.id)) {
      setError(t("watch.already", { symbol: instrument.ticker }));
      return;
    }
    setError(null);
    void toggle(instrument.id);
  }

  const rows = data?.rows ?? [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t("watch.title")}</h1>
          <p className="sub">{t("watch.sub", { count: ids.length, interval: period })}</p>
        </div>
        <div className="toolbar">
          <div className="segmented">
            {PERIODS.map((value) => (
              <button
                key={value}
                className={value === period ? "active" : ""}
                onClick={() => setPeriod(value)}
              >
                {value}
              </button>
            ))}
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => void load(ids, period)}
            disabled={loading || ids.length === 0}
          >
            {loading ? <span className="spinner" /> : "↻"} {t("common.refresh")}
          </button>
        </div>
      </div>

      {error && <div className="notice notice-error">{error}</div>}
      {data?.source === "demo" && <div className="notice notice-warn">{t("common.demoNotice")}</div>}

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">{t("watch.add")}</div>
        <AssetSearch onPick={add} placeholderKey="watch.addPlaceholder" />
        {saving && <p className="dim" style={{ fontSize: 12, marginTop: 8 }}>…</p>}
      </div>

      {ids.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <p className="muted" style={{ marginBottom: 16 }}>
            {t("watch.empty")}
          </p>
          <Link href="/panel" className="btn btn-primary">
            {t("nav.panel")}
          </Link>
        </div>
      ) : (
        <>
          <div className="only-desktop">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("common.asset")}</th>
                    <th>{t("nav.markets")}</th>
                    <th className="num">{t("common.price")}</th>
                    <th className="num">{t("common.change")}</th>
                    <th>{t("common.signal")}</th>
                    <th className="num">{t("common.score")}</th>
                    <th className="num">{t("common.confidence")}</th>
                    <th className="num">RSI</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {loading && rows.length === 0
                    ? ids.map((id) => (
                        <tr key={id}>
                          <td colSpan={9}>
                            <div className="skeleton" style={{ height: 18 }} />
                          </td>
                        </tr>
                      ))
                    : rows.map((row) => (
                        <tr key={row.id}>
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
                          <td>
                            <MarketBadge market={row.market} />
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
                          <td className="num">
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => void toggle(row.id)}
                              disabled={saving}
                            >
                              {t("watch.remove")}
                            </button>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="only-mobile quote-cards">
            {rows.map((row) => (
              <div key={row.id} className="quote-card">
                <Link
                  href={`/varlik/${row.market}/${encodeURIComponent(row.symbol)}?interval=${period}`}
                  className="quote-card-link"
                >
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
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => void toggle(row.id)}
                  disabled={saving}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Change, CoinAvatar, SignalBadge } from "@/components/ui";
import { getJson, type ScanResponse } from "@/lib/api-types";
import { INTERVALS, type Interval } from "@/lib/binance";
import { formatCompact, formatNumber, formatPrice, formatRelative } from "@/lib/format";

type Filter = "hepsi" | "al" | "sat" | "takip";
type SortKey = "score" | "confidence" | "change" | "volume" | "rsi";

export default function ScannerClient({
  defaultInterval,
  defaultLimit,
  onlyStrong,
  watchlist,
}: {
  defaultInterval: string;
  defaultLimit: number;
  onlyStrong: boolean;
  watchlist: string[];
}) {
  const [period, setPeriod] = useState<Interval>(
    (INTERVALS.find((i) => i.value === defaultInterval)?.value ?? "4h") as Interval,
  );
  const [limit, setLimit] = useState(defaultLimit);
  const [filter, setFilter] = useState<Filter>("hepsi");
  const [strongOnly, setStrongOnly] = useState(onlyStrong);
  const [sort, setSort] = useState<SortKey>("score");
  const [data, setData] = useState<ScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(
        await getJson<ScanResponse>(`/api/scan?interval=${period}&limit=${limit}`),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Tarama başarısız oldu.");
    } finally {
      setLoading(false);
    }
  }, [period, limit]);

  useEffect(() => {
    void run();
  }, [run]);

  const rows = useMemo(() => {
    let list = [...(data?.rows ?? [])];

    if (filter === "al") list = list.filter((r) => r.signal === "AL" || r.signal === "GÜÇLÜ AL");
    if (filter === "sat") list = list.filter((r) => r.signal === "SAT" || r.signal === "GÜÇLÜ SAT");
    if (filter === "takip") list = list.filter((r) => watchlist.includes(r.symbol));
    if (strongOnly) list = list.filter((r) => r.signal === "GÜÇLÜ AL" || r.signal === "GÜÇLÜ SAT");

    const comparators: Record<SortKey, (a: typeof list[number], b: typeof list[number]) => number> = {
      score: (a, b) => b.score - a.score,
      confidence: (a, b) => b.confidence - a.confidence,
      change: (a, b) => b.changePercent24h - a.changePercent24h,
      volume: (a, b) => b.quoteVolume - a.quoteVolume,
      rsi: (a, b) => (b.rsi ?? 0) - (a.rsi ?? 0),
    };
    return list.sort(comparators[sort]);
  }, [data, filter, strongOnly, sort, watchlist]);

  const counts = useMemo(() => {
    const list = data?.rows ?? [];
    return {
      buy: list.filter((r) => r.signal === "AL" || r.signal === "GÜÇLÜ AL").length,
      sell: list.filter((r) => r.signal === "SAT" || r.signal === "GÜÇLÜ SAT").length,
      wait: list.filter((r) => r.signal === "BEKLE").length,
    };
  }, [data]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Sinyal tarayıcı</h1>
          <p className="sub">
            Hacme göre ilk {limit} USDT paritesini {period} periyodunda tarar, skora göre
            sıralar.
            {data && ` ${data.scanned} coin tarandı · ${formatRelative(data.updatedAt)}.`}
          </p>
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
          <select
            className="select"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            {[10, 20, 30, 40, 60].map((value) => (
              <option key={value} value={value}>
                {value} coin
              </option>
            ))}
          </select>
          <button className="btn btn-primary btn-sm" onClick={() => void run()} disabled={loading}>
            {loading ? <span className="spinner" /> : null}
            {loading ? "Taranıyor…" : "Yeniden tara"}
          </button>
        </div>
      </div>

      {data?.source === "demo" && (
        <div className="notice notice-warn">
          Binance API&apos;sine ulaşılamadı; <strong>demo veriyle</strong> tarama yapıldı.
        </div>
      )}
      {error && <div className="notice notice-error">{error}</div>}

      {/* Özet + filtreler */}
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <div className="card" style={{ padding: 16 }}>
          <div className="dim" style={{ fontSize: 12 }}>
            ALIŞ SİNYALİ
          </div>
          <strong className="up" style={{ fontSize: 24 }}>
            {counts.buy}
          </strong>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div className="dim" style={{ fontSize: 12 }}>
            SATIŞ SİNYALİ
          </div>
          <strong className="down" style={{ fontSize: 24 }}>
            {counts.sell}
          </strong>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div className="dim" style={{ fontSize: 12 }}>
            BEKLE
          </div>
          <strong className="flat" style={{ fontSize: 24 }}>
            {counts.wait}
          </strong>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div className="dim" style={{ fontSize: 12 }}>
            PİYASA EĞİLİMİ
          </div>
          <strong style={{ fontSize: 18 }}>
            {counts.buy > counts.sell * 1.5
              ? "Boğa ağırlıklı"
              : counts.sell > counts.buy * 1.5
                ? "Ayı ağırlıklı"
                : "Kararsız"}
          </strong>
        </div>
      </div>

      <div className="toolbar" style={{ marginBottom: 14 }}>
        <div className="segmented">
          {(
            [
              ["hepsi", "Tümü"],
              ["al", "Alış"],
              ["sat", "Satış"],
              ["takip", "Takip listem"],
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
        <select
          className="select"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
        >
          <option value="score">Skora göre</option>
          <option value="confidence">Güvene göre</option>
          <option value="change">24s değişime göre</option>
          <option value="volume">Hacme göre</option>
          <option value="rsi">RSI&apos;ye göre</option>
        </select>
        <label className="pill" style={{ cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={strongOnly}
            onChange={(e) => setStrongOnly(e.target.checked)}
          />
          Yalnızca güçlü sinyaller
        </label>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Parite</th>
              <th className="num">Fiyat</th>
              <th className="num">24s</th>
              <th>Sinyal</th>
              <th className="num">Skor</th>
              <th className="num">Güven</th>
              <th className="num">RSI</th>
              <th className="num">ADX</th>
              <th className="num">ATR %</th>
              <th>Formasyon</th>
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
                  <span className="muted">Bu filtrelerle eşleşen coin yok.</span>
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.symbol}>
                  <td className="dim">{index + 1}</td>
                  <td>
                    <Link href={`/coin/${row.symbol}?interval=${period}`} className="coin-cell">
                      <CoinAvatar base={row.base} />
                      <span>
                        <strong style={{ fontWeight: 500 }}>{row.base}</strong>
                        <span className="dim">/{row.quote}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="num mono">{formatPrice(row.price)}</td>
                  <td className="num">
                    <Change value={row.changePercent24h} />
                  </td>
                  <td>
                    <SignalBadge signal={row.signal} />
                  </td>
                  <td
                    className={`num mono ${row.score > 0 ? "up" : row.score < 0 ? "down" : "muted"}`}
                  >
                    {row.score > 0 ? `+${row.score}` : row.score}
                  </td>
                  <td className="num mono">%{row.confidence}</td>
                  <td className="num mono">{row.rsi === null ? "—" : formatNumber(row.rsi, 0)}</td>
                  <td className="num mono">{row.adx === null ? "—" : formatNumber(row.adx, 0)}</td>
                  <td className="num mono dim">{formatNumber(row.atrPercent, 1)}</td>
                  <td className="dim" style={{ fontSize: 12, whiteSpace: "normal", maxWidth: 210 }}>
                    {row.patterns.length ? row.patterns.join(", ") : "—"}
                  </td>
                  <td className="num">
                    <Link
                      href={`/coin/${row.symbol}?interval=${period}`}
                      className="btn btn-ghost btn-sm"
                    >
                      Detay
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && (
        <p className="dim" style={{ fontSize: 12, marginTop: 14 }}>
          Toplam tarama hacmi:{" "}
          {formatCompact((data.rows ?? []).reduce((sum, r) => sum + r.quoteVolume, 0))} USDT.
          Skorlar seçilen periyottaki son kapanışa göre hesaplanır; mum kapanmadan önce
          değişebilir.
        </p>
      )}
    </>
  );
}

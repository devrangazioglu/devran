"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Change, CoinAvatar, SignalBadge } from "@/components/ui";
import { getJson, type ScanResponse } from "@/lib/api-types";
import { INTERVALS, type Interval } from "@/lib/binance";
import { formatNumber, formatPrice } from "@/lib/format";

export default function WatchlistClient({
  initialSymbols,
  defaultInterval,
}: {
  initialSymbols: string[];
  defaultInterval: string;
}) {
  const [symbols, setSymbols] = useState(initialSymbols);
  const [period, setPeriod] = useState<Interval>(
    (INTERVALS.find((i) => i.value === defaultInterval)?.value ?? "4h") as Interval,
  );
  const [data, setData] = useState<ScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [newSymbol, setNewSymbol] = useState("");
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
            `/api/scan?interval=${selected}&symbols=${list.join(",")}`,
          ),
        );
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Takip listesi analiz edilemedi.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load(symbols, period);
  }, [symbols, period, load]);

  async function toggle(symbol: string) {
    setSaving(true);
    try {
      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbol }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Kaydedilemedi.");
        return;
      }
      const body = (await response.json()) as { watchlist: string[] };
      setSymbols(body.watchlist);
      setNewSymbol("");
    } finally {
      setSaving(false);
    }
  }

  function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    const symbol = newSymbol.trim().toUpperCase();
    if (!symbol) return;
    const withQuote = /USDT$|BTC$|ETH$|BNB$|FDUSD$/.test(symbol) ? symbol : `${symbol}USDT`;
    if (symbols.includes(withQuote)) {
      setError(`${withQuote} zaten listenizde.`);
      return;
    }
    setError(null);
    void toggle(withQuote);
  }

  const rows = data?.rows ?? [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Takip listem</h1>
          <p className="sub">
            Listenizdeki {symbols.length} parite {period} periyodunda analiz edilir.
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
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => void load(symbols, period)}
            disabled={loading || symbols.length === 0}
          >
            {loading ? <span className="spinner" /> : "↻"} Yenile
          </button>
        </div>
      </div>

      {error && <div className="notice notice-error">{error}</div>}
      {data?.source === "demo" && (
        <div className="notice notice-warn">
          Binance API&apos;sine ulaşılamadı; <strong>demo veriyle</strong> analiz gösteriliyor.
        </div>
      )}

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">Parite ekle</div>
        <form onSubmit={handleAdd} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            className="input"
            placeholder="Örn. AVAX veya AVAXUSDT"
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            style={{ flex: "1 1 220px" }}
          />
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? <span className="spinner" /> : null} Listeye ekle
          </button>
        </form>
        <p className="dim" style={{ fontSize: 12, marginTop: 10 }}>
          Kotasyon yazmazsanız sonuna otomatik olarak <strong>USDT</strong> eklenir.
        </p>
      </div>

      {symbols.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <p className="muted" style={{ marginBottom: 16 }}>
            Takip listeniz boş. Panelden bir coin seçip &quot;Takibe al&quot; diyebilir ya da
            yukarıdaki formu kullanabilirsiniz.
          </p>
          <Link href="/panel" className="btn btn-primary">
            Panele git
          </Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Parite</th>
                <th className="num">Fiyat</th>
                <th className="num">24s</th>
                <th>Sinyal</th>
                <th className="num">Skor</th>
                <th className="num">Güven</th>
                <th className="num">RSI</th>
                <th>Trend</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0
                ? symbols.map((symbol) => (
                    <tr key={symbol}>
                      <td colSpan={9}>
                        <div className="skeleton" style={{ height: 18 }} />
                      </td>
                    </tr>
                  ))
                : rows.map((row) => (
                    <tr key={row.symbol}>
                      <td>
                        <Link
                          href={`/coin/${row.symbol}?interval=${period}`}
                          className="coin-cell"
                        >
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
                        className={`num mono ${
                          row.score > 0 ? "up" : row.score < 0 ? "down" : "muted"
                        }`}
                      >
                        {row.score > 0 ? `+${row.score}` : row.score}
                      </td>
                      <td className="num mono">%{row.confidence}</td>
                      <td className="num mono">
                        {row.rsi === null ? "—" : formatNumber(row.rsi, 0)}
                      </td>
                      <td className="dim" style={{ fontSize: 13 }}>
                        {row.trendLabel}
                      </td>
                      <td className="num">
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => void toggle(row.symbol)}
                          disabled={saving}
                        >
                          Çıkar
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

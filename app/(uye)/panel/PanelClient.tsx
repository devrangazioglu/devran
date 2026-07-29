"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Change, CoinAvatar, SignalBadge } from "@/components/ui";
import { getJson, type MarketsResponse, type ScanResponse } from "@/lib/api-types";
import { INTERVALS, type Interval } from "@/lib/binance";
import { formatCompact, formatPrice, formatRelative } from "@/lib/format";

const TOP_SIGNAL_COUNT = 14;

export default function PanelClient({
  name,
  defaultInterval,
  watchlist,
}: {
  name: string;
  defaultInterval: string;
  watchlist: string[];
}) {
  const [period, setPeriod] = useState<Interval>(
    (INTERVALS.find((i) => i.value === defaultInterval)?.value ?? "4h") as Interval,
  );
  const [markets, setMarkets] = useState<MarketsResponse | null>(null);
  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [loadingMarkets, setLoadingMarkets] = useState(true);
  const [loadingScan, setLoadingScan] = useState(true);

  const loadMarkets = useCallback(async () => {
    setLoadingMarkets(true);
    setMarketError(null);
    try {
      setMarkets(await getJson<MarketsResponse>("/api/markets?limit=40"));
    } catch (error) {
      setMarketError(error instanceof Error ? error.message : "Piyasa verisi alınamadı.");
    } finally {
      setLoadingMarkets(false);
    }
  }, []);

  const loadScan = useCallback(async (period: Interval) => {
    setLoadingScan(true);
    setScanError(null);
    try {
      setScan(await getJson<ScanResponse>(`/api/scan?interval=${period}&limit=${TOP_SIGNAL_COUNT}`));
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Sinyaller taranamadı.");
    } finally {
      setLoadingScan(false);
    }
  }, []);

  useEffect(() => {
    void loadMarkets();
  }, [loadMarkets]);

  useEffect(() => {
    void loadScan(period);
  }, [period, loadScan]);

  const tickers = markets?.tickers ?? [];
  const btc = tickers.find((t) => t.symbol === "BTCUSDT");
  const eth = tickers.find((t) => t.symbol === "ETHUSDT");
  const rising = tickers.filter((t) => t.priceChangePercent > 0).length;
  const falling = tickers.filter((t) => t.priceChangePercent < 0).length;
  const totalVolume = tickers.reduce((sum, t) => sum + t.quoteVolume, 0);

  const buys = (scan?.rows ?? []).filter((r) => r.signal === "AL" || r.signal === "GÜÇLÜ AL");
  const sells = (scan?.rows ?? [])
    .filter((r) => r.signal === "SAT" || r.signal === "GÜÇLÜ SAT")
    .reverse();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Merhaba {name}</h1>
          <p className="sub">
            {markets
              ? `Piyasa verisi ${formatRelative(markets.updatedAt)} güncellendi.`
              : "Piyasa verisi yükleniyor…"}
            {markets?.source === "demo" && " · DEMO VERİ"}
          </p>
        </div>
        <div className="toolbar">
          <div className="segmented">
            {INTERVALS.filter((i) => ["15m", "1h", "4h", "1d"].includes(i.value)).map((item) => (
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
            onClick={() => {
              void loadMarkets();
              void loadScan(period);
            }}
            disabled={loadingMarkets || loadingScan}
          >
            {loadingMarkets || loadingScan ? <span className="spinner" /> : "↻"} Yenile
          </button>
        </div>
      </div>

      {markets?.source === "demo" && (
        <div className="notice notice-warn">
          Binance API&apos;sine ulaşılamadığı için <strong>demo veri</strong> gösteriliyor.
          Rakamlar gerçek piyasayı yansıtmaz.
        </div>
      )}
      {marketError && <div className="notice notice-error">{marketError}</div>}

      {/* Özet kartları */}
      <div className="grid-4" style={{ marginBottom: 22 }}>
        <div className="card">
          <div className="dim" style={{ fontSize: 12 }}>
            BTC/USDT
          </div>
          <strong className="mono" style={{ fontSize: 22 }}>
            {btc ? formatPrice(btc.lastPrice) : "—"}
          </strong>
          <div style={{ fontSize: 13 }}>
            <Change value={btc?.priceChangePercent ?? null} /> <span className="dim">24s</span>
          </div>
        </div>
        <div className="card">
          <div className="dim" style={{ fontSize: 12 }}>
            ETH/USDT
          </div>
          <strong className="mono" style={{ fontSize: 22 }}>
            {eth ? formatPrice(eth.lastPrice) : "—"}
          </strong>
          <div style={{ fontSize: 13 }}>
            <Change value={eth?.priceChangePercent ?? null} /> <span className="dim">24s</span>
          </div>
        </div>
        <div className="card">
          <div className="dim" style={{ fontSize: 12 }}>
            PİYASA GENİŞLİĞİ
          </div>
          <strong style={{ fontSize: 22 }}>
            <span className="up">{rising}</span>
            <span className="dim"> / </span>
            <span className="down">{falling}</span>
          </strong>
          <div className="dim" style={{ fontSize: 13 }}>
            yükselen / düşen (ilk 40)
          </div>
        </div>
        <div className="card">
          <div className="dim" style={{ fontSize: 12 }}>
            24S HACİM (İLK 40)
          </div>
          <strong className="mono" style={{ fontSize: 22 }}>
            {formatCompact(totalVolume)} $
          </strong>
          <div className="dim" style={{ fontSize: 13 }}>
            USDT pariteleri
          </div>
        </div>
      </div>

      {/* Sinyaller */}
      <div className="grid-2" style={{ marginBottom: 22 }}>
        <div className="card">
          <div className="card-title">
            <span>En güçlü alış sinyalleri</span>
            <span className="pill" style={{ fontSize: 12 }}>
              {period}
            </span>
          </div>
          {loadingScan ? (
            <SignalSkeleton />
          ) : buys.length === 0 ? (
            <p className="muted" style={{ fontSize: 14 }}>
              Bu zaman diliminde alış sinyali veren coin bulunamadı.
            </p>
          ) : (
            buys.slice(0, 5).map((row) => <SignalRow key={row.symbol} row={row} />)
          )}
        </div>

        <div className="card">
          <div className="card-title">
            <span>En güçlü satış sinyalleri</span>
            <span className="pill" style={{ fontSize: 12 }}>
              {period}
            </span>
          </div>
          {loadingScan ? (
            <SignalSkeleton />
          ) : sells.length === 0 ? (
            <p className="muted" style={{ fontSize: 14 }}>
              Bu zaman diliminde satış sinyali veren coin bulunamadı.
            </p>
          ) : (
            sells.slice(0, 5).map((row) => <SignalRow key={row.symbol} row={row} />)
          )}
        </div>
      </div>

      {scanError && <div className="notice notice-error">{scanError}</div>}

      {/* Takip listesi kısayolu */}
      {watchlist.length > 0 && (
        <div className="card" style={{ marginBottom: 22 }}>
          <div className="card-title">
            <span>Takip listem</span>
            <Link href="/takip" className="btn btn-ghost btn-sm">
              Tümünü analiz et
            </Link>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {watchlist.map((symbol) => (
              <Link key={symbol} href={`/coin/${symbol}`} className="pill">
                {symbol}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Piyasa tablosu */}
      <div className="page-head" style={{ marginBottom: 12 }}>
        <div>
          <h1 style={{ fontSize: 20 }}>Piyasa</h1>
          <p className="sub">Hacme göre ilk 40 USDT paritesi. Analiz için bir satıra tıklayın.</p>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Parite</th>
              <th className="num">Fiyat</th>
              <th className="num">24s değişim</th>
              <th className="num">24s en yüksek</th>
              <th className="num">24s en düşük</th>
              <th className="num">Hacim (USDT)</th>
              <th className="num">İşlem</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loadingMarkets && tickers.length === 0
              ? Array.from({ length: 8 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={8}>
                      <div className="skeleton" style={{ height: 18 }} />
                    </td>
                  </tr>
                ))
              : tickers.map((ticker) => (
                  <tr key={ticker.symbol}>
                    <td>
                      <Link href={`/coin/${ticker.symbol}`} className="coin-cell">
                        <CoinAvatar base={ticker.base} />
                        <span>
                          <strong style={{ fontWeight: 500 }}>{ticker.base}</strong>
                          <span className="dim">/{ticker.quote}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="num mono">{formatPrice(ticker.lastPrice)}</td>
                    <td className="num">
                      <Change value={ticker.priceChangePercent} />
                    </td>
                    <td className="num mono dim">{formatPrice(ticker.highPrice)}</td>
                    <td className="num mono dim">{formatPrice(ticker.lowPrice)}</td>
                    <td className="num mono">{formatCompact(ticker.quoteVolume)}</td>
                    <td className="num mono dim">{formatCompact(ticker.trades)}</td>
                    <td className="num">
                      <Link href={`/coin/${ticker.symbol}`} className="btn btn-ghost btn-sm">
                        Analiz
                      </Link>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SignalRow({ row }: { row: ScanResponse["rows"][number] }) {
  return (
    <Link
      href={`/coin/${row.symbol}`}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "11px 0",
        borderBottom: "1px solid var(--border-soft)",
      }}
    >
      <div className="coin-cell">
        <CoinAvatar base={row.base} />
        <div>
          <div style={{ fontSize: 14 }}>{row.base}</div>
          <div className="dim" style={{ fontSize: 12 }}>
            RSI {row.rsi?.toFixed(0) ?? "—"} · ADX {row.adx?.toFixed(0) ?? "—"} ·{" "}
            {row.trendLabel}
          </div>
        </div>
      </div>
      <div style={{ textAlign: "right", display: "grid", gap: 4, justifyItems: "end" }}>
        <SignalBadge signal={row.signal} />
        <div className="dim mono" style={{ fontSize: 12 }}>
          skor {row.score > 0 ? `+${row.score}` : row.score} · güven %{row.confidence}
        </div>
      </div>
    </Link>
  );
}

function SignalSkeleton() {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: 42 }} />
      ))}
    </div>
  );
}

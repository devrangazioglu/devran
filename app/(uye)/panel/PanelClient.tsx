"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import HataNotu from "@/components/HataNotu";
import { useI18n } from "@/components/I18nProvider";
import Reveal from "@/components/motion/Reveal";
import SpotlightCard from "@/components/motion/SpotlightCard";
import { AssetAvatar, Change, MarketBadge, Score, SignalBadge } from "@/components/ui";
import { isBuySignal, isSellSignal } from "@/lib/analysis";
import { getJson, type MarketsResponse, type ScanResponse, type ScanRow } from "@/lib/api-types";
import { formatCompact, formatNumber, formatPrice, formatRelative } from "@/lib/format";
import { displayTicker } from "@/lib/markets/instruments";
import {
  MARKETS,
  AKTIF_MARKET_IDS,
  parseInstrumentId,
  type Interval,
  type MarketId,
  type Quote,
} from "@/lib/markets/types";

const SCAN_SIZE = 30;

export default function PanelClient({
  name,
  defaultMarket,
  defaultInterval,
  watchlist,
  planPeriyotlar,
}: {
  name: string;
  defaultMarket: string;
  defaultInterval: string;
  watchlist: string[];
  /** Planın açtığı periyotlar; defter okunamıyorsa null (kısıtlama yok). */
  planPeriyotlar: Interval[] | null;
}) {
  const { t, intl } = useI18n();

  const [market, setMarket] = useState<MarketId>(
    (AKTIF_MARKET_IDS.includes(defaultMarket as MarketId) ? defaultMarket : "kripto") as MarketId,
  );
  const [period, setPeriod] = useState<Interval>(defaultInterval as Interval);
  const [markets, setMarkets] = useState<MarketsResponse | null>(null);
  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [marketError, setMarketError] = useState<string | null>(null);
  // Tarama hatası nesne olarak saklanır: kredi/plan kodunu HataNotu okuyor.
  const [scanError, setScanError] = useState<unknown>(null);
  const [loadingMarkets, setLoadingMarkets] = useState(true);
  const [loadingScan, setLoadingScan] = useState(true);

  // Planın kapalı bıraktığı periyot arayüzde de kilitli görünür: tıklanabilir
  // ama çalışmayan bir düğme, kullanıcıya hata ekranından başka bir şey vermez.
  const periyotAcik = (value: Interval) => !planPeriyotlar || planPeriyotlar.includes(value);

  // Ayarlardaki varsayılan periyot plana kapalıysa açık olan bir periyoda geç.
  useEffect(() => {
    if (!periyotAcik(period) && planPeriyotlar?.length) {
      setPeriod(planPeriyotlar.includes("4h") ? "4h" : planPeriyotlar[planPeriyotlar.length - 1]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, planPeriyotlar]);

  // Piyasa değişince o piyasanın desteklediği bir periyoda geç.
  useEffect(() => {
    if (!MARKETS[market].intervals.includes(period)) {
      setPeriod(MARKETS[market].intervals.includes("1d") ? "1d" : MARKETS[market].intervals[0]);
    }
  }, [market, period]);

  // `sessiz`: arka plandaki kendiliğinden tazeleme. Ekranda yükleniyor
  // göstergesi çıkmaz ve geçici bir hata ekrandaki dolu listeyi silmez.
  const loadMarkets = useCallback(async (selected: MarketId, sessiz = false) => {
    if (!sessiz) setLoadingMarkets(true);
    setMarketError(null);
    try {
      setMarkets(await getJson<MarketsResponse>(`/api/markets?market=${selected}&limit=40`));
    } catch (error) {
      // Seçilen piyasa değiştiği için eski liste artık yanlış piyasaya ait.
      if (!sessiz) setMarkets(null);
      setMarketError(error instanceof Error ? error.message : t("common.error"));
    } finally {
      if (!sessiz) setLoadingMarkets(false);
    }
  }, [t]);

  const loadScan = useCallback(
    async (selected: MarketId, selectedPeriod: Interval, sessiz = false) => {
      if (!sessiz) setLoadingScan(true);
      setScanError(null);
      try {
        setScan(
          await getJson<ScanResponse>(
            `/api/scan?market=${selected}&interval=${selectedPeriod}&limit=${SCAN_SIZE}`,
          ),
        );
      } catch (error) {
        if (!sessiz) setScan(null);
        setScanError(error ?? new Error(t("common.error")));
      } finally {
        if (!sessiz) setLoadingScan(false);
      }
    },
    [t],
  );

  useEffect(() => {
    void loadMarkets(market);
  }, [market, loadMarkets]);

  useEffect(() => {
    if (!MARKETS[market].intervals.includes(period)) return;
    void loadScan(market, period);
  }, [market, period, loadScan]);

  // Fiyat listesinin kendiliğinden tazelenmesi.
  //
  // Yalnızca fiyat listesi tazelenir; tarama tazelenmez. Tarama kredi harcayan
  // bir işlem ve açık unutulmuş bir sekmenin kullanıcının kredisini sessizce
  // yakması kabul edilemez — tarama, kullanıcı ↻ dediğinde ya da piyasa/periyot
  // değiştirdiğinde yenilenir. Sekme arka plandayken istek atılmaz.
  useEffect(() => {
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void loadMarkets(market, true);
    }, 60_000);
    return () => clearInterval(timer);
  }, [market, loadMarkets]);

  const quotes = markets?.quotes ?? [];
  const rising = quotes.filter((q) => q.changePercent > 0).length;
  const falling = quotes.filter((q) => q.changePercent < 0).length;
  const totalVolume = quotes.reduce((sum, q) => sum + q.volume, 0);
  const leaders = quotes.slice(0, 2);

  const rows = scan?.rows ?? [];
  const buys = rows.filter((row) => isBuySignal(row.signal)).slice(0, 10);
  const sells = rows.filter((row) => isSellSignal(row.signal)).reverse().slice(0, 5);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{name ? t("panel.greeting", { name }) : t("nav.panel")}</h1>
          <p className="sub">
            {markets
              ? t("panel.sub", {
                  time: formatRelative(markets.updatedAt, intl),
                  updated: t("common.updated"),
                })
              : t("panel.loadingMarkets")}
            {markets?.source === "demo" && ` · ${t("common.demoData")}`}
          </p>
        </div>

        <div className="toolbar">
          {/* Tek piyasa açıkken seçici gösterilmez: tek düğmeli bir seçim,
              kullanıcıya olmayan bir tercih sunar. */}
          {AKTIF_MARKET_IDS.length > 1 && (
            <div className="segmented">
              {AKTIF_MARKET_IDS.map((id) => (
                <button
                  key={id}
                  className={id === market ? "active" : ""}
                  onClick={() => setMarket(id)}
                >
                  {t(`market.${id}` as "market.kripto")}
                </button>
              ))}
            </div>
          )}
          <div className="segmented">
            {MARKETS[market].intervals
              .filter((value) => ["15m", "1h", "4h", "1d"].includes(value))
              .map((value) => (
                <button
                  key={value}
                  className={value === period ? "active" : ""}
                  onClick={() => setPeriod(value)}
                  disabled={!periyotAcik(value)}
                  title={periyotAcik(value) ? undefined : t("credit.periodLocked")}
                >
                  {periyotAcik(value) ? value : `🔒 ${value}`}
                </button>
              ))}
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              void loadMarkets(market);
              void loadScan(market, period);
            }}
            disabled={loadingMarkets || loadingScan}
          >
            {loadingMarkets || loadingScan ? <span className="spinner" /> : "↻"}{" "}
            {t("common.refresh")}
          </button>
        </div>
      </div>

      {markets?.source === "demo" && <div className="notice notice-warn">{t("common.demoNotice")}</div>}
      {marketError && <div className="notice notice-error">{marketError}</div>}

      {/* Özet kartları */}
      <div className="grid-4" style={{ marginBottom: 22 }}>
        {leaders.map((quote) => (
          <SummaryCard key={quote.id} quote={quote} intl={intl} />
        ))}
        <div className="card">
          <div className="dim card-label">{t("panel.breadth")}</div>
          <strong style={{ fontSize: 22 }}>
            <span className="up">{rising}</span>
            <span className="dim"> / </span>
            <span className="down">{falling}</span>
          </strong>
          <div className="dim" style={{ fontSize: 13 }}>
            {t("panel.breadthSub")}
          </div>
        </div>
        <div className="card">
          <div className="dim card-label">{t("panel.totalVolume")}</div>
          <strong className="mono" style={{ fontSize: 22 }}>
            {formatCompact(totalVolume, intl)}
          </strong>
          <div className="dim" style={{ fontSize: 13 }}>
            {t(`market.${market}` as "market.kripto")}
          </div>
        </div>
      </div>

      {/* En çok AL sinyali verenler — Top 10 */}
      <Reveal>
        <SpotlightCard className="card" tilt={false}>
          <div className="card-title">
            <span>{t("panel.topBuyTitle")}</span>
            <span className="pill" style={{ fontSize: 12 }}>
              {t(`market.${market}` as "market.kripto")} · {period}
            </span>
          </div>
          <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
            {t("panel.topBuySub")}
          </p>

          {loadingScan ? (
            <SignalSkeleton rows={5} />
          ) : buys.length === 0 ? (
            <p className="muted" style={{ fontSize: 14 }}>
              {t("panel.noBuy")}
            </p>
          ) : (
            <ol className="top-list">
              {buys.map((row, index) => (
                <li key={row.id}>
                  <span className="top-rank">{index + 1}</span>
                  <SignalRow row={row} intl={intl} trendLabel={t(row.trendLabelKey as "trend.strong")} />
                </li>
              ))}
            </ol>
          )}
        </SpotlightCard>
      </Reveal>

      <div className="grid-2" style={{ margin: "22px 0" }}>
        <div className="card">
          <div className="card-title">{t("panel.topSellTitle")}</div>
          {loadingScan ? (
            <SignalSkeleton rows={3} />
          ) : sells.length === 0 ? (
            <p className="muted" style={{ fontSize: 14 }}>
              {t("panel.noSell")}
            </p>
          ) : (
            sells.map((row) => (
              <SignalRow
                key={row.id}
                row={row}
                intl={intl}
                trendLabel={t(row.trendLabelKey as "trend.strong")}
              />
            ))
          )}
        </div>

        {watchlist.length > 0 && (
          <div className="card">
            <div className="card-title">
              <span>{t("panel.watchlistShortcut")}</span>
              <Link href="/takip" className="btn btn-ghost btn-sm">
                {t("panel.analyzeAll")}
              </Link>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {watchlist.map((id) => {
                const parsed = parseInstrumentId(id);
                if (!parsed) return null;
                const { market: itemMarket, symbol } = parsed;
                return (
                  <Link
                    key={id}
                    href={`/varlik/${itemMarket}/${encodeURIComponent(symbol)}`}
                    className="pill"
                  >
                    {displayTicker(itemMarket, symbol)}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <HataNotu hata={scanError} />

      {/* Piyasa listesi */}
      <div className="page-head" style={{ marginBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>{t("panel.marketTable")}</h2>
          <p className="sub">{t("panel.marketTableSub")}</p>
        </div>
      </div>

      <div className="only-desktop">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("common.asset")}</th>
                <th className="num">{t("common.price")}</th>
                <th className="num">{t("common.change")}</th>
                <th className="num">{t("common.high")}</th>
                <th className="num">{t("common.low")}</th>
                <th className="num">{t("common.volume")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loadingMarkets && quotes.length === 0
                ? Array.from({ length: 8 }, (_, i) => (
                    <tr key={i}>
                      <td colSpan={7}>
                        <div className="skeleton" style={{ height: 18 }} />
                      </td>
                    </tr>
                  ))
                : quotes.map((quote) => (
                    <tr key={quote.id}>
                      <td>
                        <Link
                          href={`/varlik/${quote.market}/${encodeURIComponent(quote.symbol)}`}
                          className="coin-cell"
                        >
                          <AssetAvatar ticker={quote.ticker} market={quote.market} />
                          <span>
                            <strong style={{ fontWeight: 500 }}>{quote.ticker}</strong>
                            <span className="dim block-sub">{quote.name}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="num mono">{formatPrice(quote.price, intl)}</td>
                      <td className="num">
                        <Change value={quote.changePercent} />
                      </td>
                      <td className="num mono dim">{formatPrice(quote.high, intl)}</td>
                      <td className="num mono dim">{formatPrice(quote.low, intl)}</td>
                      <td className="num mono">{formatCompact(quote.volume, intl)}</td>
                      <td className="num">
                        <Link
                          href={`/varlik/${quote.market}/${encodeURIComponent(quote.symbol)}`}
                          className="btn btn-ghost btn-sm"
                        >
                          {t("common.analyze")}
                        </Link>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="only-mobile quote-cards">
        {quotes.map((quote) => (
          <Link
            key={quote.id}
            href={`/varlik/${quote.market}/${encodeURIComponent(quote.symbol)}`}
            className="quote-card"
          >
            <AssetAvatar ticker={quote.ticker} market={quote.market} size={34} />
            <div className="quote-card-main">
              <strong>{quote.ticker}</strong>
              <span className="dim">{quote.name}</span>
            </div>
            <div className="quote-card-side">
              <span className="mono">{formatPrice(quote.price, intl)}</span>
              <Change value={quote.changePercent} />
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

function SummaryCard({ quote, intl }: { quote: Quote; intl: string }) {
  return (
    <div className="card">
      <div className="dim card-label">{quote.ticker}</div>
      <strong className="mono" style={{ fontSize: 22 }}>
        {formatPrice(quote.price, intl)}
      </strong>
      <div style={{ fontSize: 13 }}>
        <Change value={quote.changePercent} />{" "}
        <span className="dim">{quote.currency}</span>
      </div>
    </div>
  );
}

function SignalRow({
  row,
  intl,
  trendLabel,
}: {
  row: ScanRow;
  intl: string;
  trendLabel: string;
}) {
  return (
    <Link
      href={`/varlik/${row.market}/${encodeURIComponent(row.symbol)}`}
      className="signal-row"
    >
      <div className="coin-cell">
        <AssetAvatar ticker={row.ticker} market={row.market} />
        <div>
          <div style={{ fontSize: 14 }}>{row.ticker}</div>
          <div className="dim" style={{ fontSize: 12 }}>
            RSI {row.rsi === null ? "—" : formatNumber(row.rsi, intl, 0)} · ADX{" "}
            {row.adx === null ? "—" : formatNumber(row.adx, intl, 0)} · {trendLabel}
          </div>
        </div>
      </div>
      <div className="signal-row-side">
        <MarketBadge market={row.market} />
        <SignalBadge signal={row.signal} />
        <span className="dim mono" style={{ fontSize: 12 }}>
          <Score value={row.score} /> · %{row.confidence}
        </span>
      </div>
    </Link>
  );
}

function SignalSkeleton({ rows }: { rows: number }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: 46 }} />
      ))}
    </div>
  );
}

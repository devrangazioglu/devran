import Link from "next/link";
import { notFound } from "next/navigation";

import AssetSearch from "@/components/AssetSearch";
import Reveal from "@/components/motion/Reveal";
import SiteNav from "@/components/SiteNav";
import { AssetAvatar, Change } from "@/components/ui";
import { formatCompact, formatPrice } from "@/lib/format";
import { intlTag } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { getQuotes } from "@/lib/markets/provider";
import { marketBySlug, MARKETS, MARKET_IDS, type Quote } from "@/lib/markets/types";

export const revalidate = 60;

export async function generateStaticParams() {
  return MARKET_IDS.map((id) => ({ slug: MARKETS[id].slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const market = marketBySlug(slug);
  if (!market) return { title: "Kriptosinyal" };
  const { t } = await getI18n();
  return {
    title: `${t(market.labelKey as "market.kripto")} — Kriptosinyal`,
    description: t(`market.${market.id}.desc` as "market.kripto.desc"),
  };
}

export default async function MarketPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const market = marketBySlug(slug);
  if (!market) notFound();

  const { t, locale } = await getI18n();
  const intl = intlTag(locale);

  let quotes: Quote[] = [];
  let source: "canli" | "demo" = "canli";
  let error: string | null = null;

  try {
    const result = await getQuotes(market.id, 60);
    quotes = result.quotes;
    source = result.source;
  } catch (caught) {
    error = caught instanceof Error ? caught.message : t("common.error");
  }

  return (
    <>
      <SiteNav />

      <main className="app-main">
        <div className="container container-wide">
          <div className="page-head">
            <div>
              <h1>{t(market.labelKey as "market.kripto")}</h1>
              <p className="sub">{t(`market.${market.id}.desc` as "market.kripto.desc")}</p>
            </div>
            <div className="toolbar market-tabs">
              {MARKET_IDS.map((id) => (
                <Link
                  key={id}
                  href={`/piyasa/${MARKETS[id].slug}`}
                  className={`segmented-link ${id === market.id ? "active" : ""}`}
                >
                  {t(`market.${id}` as "market.kripto")}
                </Link>
              ))}
            </div>
          </div>

          <div style={{ maxWidth: 560, marginBottom: 20 }}>
            <AssetSearch />
          </div>

          {source === "demo" && <div className="notice notice-warn">{t("common.demoNotice")}</div>}
          {!market.alwaysOpen && <div className="notice">{t("market.closedNote")}</div>}
          {error && <div className="notice notice-error">{error}</div>}

          {/* Masaüstü: tablo */}
          <Reveal className="only-desktop">
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
                  {quotes.map((quote) => (
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
          </Reveal>

          {/* Mobil: kart listesi */}
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

          {quotes.length === 0 && !error && (
            <p className="muted">{t("home.highlightsEmpty")}</p>
          )}
        </div>
      </main>

      <footer className="footer">
        <div className="container container-wide">
          <p className="disclaimer" style={{ marginTop: 0 }}>
            {t("footer.disclaimerShort")}
          </p>
        </div>
      </footer>
    </>
  );
}

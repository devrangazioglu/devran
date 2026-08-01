import Link from "next/link";
import { notFound } from "next/navigation";

import AssetSearch from "@/components/AssetSearch";
import Reveal from "@/components/motion/Reveal";
import SiteNav from "@/components/SiteNav";
import { AssetAvatar, Change } from "@/components/ui";
import { formatCompact, formatPrice } from "@/lib/format";
import { intlTag, type Locale } from "@/lib/i18n";
import { localeHref } from "@/lib/i18n/routing";
import { getI18n } from "@/lib/i18n/server";
import { getQuotes } from "@/lib/markets/provider";
import { marketBySlug, MARKETS, AKTIF_MARKET_IDS, type Quote } from "@/lib/markets/types";
import { breadcrumbJsonLd, faqJsonLd, itemListJsonLd } from "@/lib/seo";

export default async function MarketView({
  slug,
  locale: istenen,
}: {
  slug: string;
  locale?: Locale;
}) {
  const market = marketBySlug(slug);
  if (!market) notFound();

  const { t, locale } = await getI18n(istenen);
  const intl = intlTag(locale);
  const yol = (path: string) => localeHref(locale, path);
  const marketAdi = t(market.labelKey as "market.kripto");

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

  // Sayfanın ne listelediğini ve site içindeki yerini makine okunur biçimde
  // bildirir; ayrıca piyasaya özel SSS arama sonucunda açılır madde olarak
  // görünebilir.
  const sss = ([1, 2, 3] as const).map((n) => ({
    soru: t(`market.${market.id}.faq${n}.q` as "market.kripto.faq1.q"),
    cevap: t(`market.${market.id}.faq${n}.a` as "market.kripto.faq1.a"),
  }));

  const yapisalVeri = [
    breadcrumbJsonLd(
      [
        { ad: t("nav.home"), path: "/" },
        { ad: marketAdi, path: `/piyasa/${market.slug}` },
      ],
      locale,
    ),
    itemListJsonLd(
      marketAdi,
      quotes.slice(0, 20).map((quote) => ({
        ad: `${quote.ticker} — ${quote.name}`,
        path: `/varlik/${quote.market}/${quote.symbol}`,
      })),
      locale,
    ),
    faqJsonLd(sss),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(yapisalVeri) }}
      />

      <SiteNav locale={locale} />

      <main className="app-main">
        <div className="container container-wide">
          <div className="page-head">
            <div>
              <h1>{t(`market.${market.id}.h1` as "market.kripto.h1")}</h1>
              <p className="sub">{t(`market.${market.id}.desc` as "market.kripto.desc")}</p>
            </div>
            {AKTIF_MARKET_IDS.length > 1 && (
              <div className="toolbar market-tabs">
                {AKTIF_MARKET_IDS.map((id) => (
                  <Link
                    key={id}
                    href={yol(`/piyasa/${MARKETS[id].slug}`)}
                    className={`segmented-link ${id === market.id ? "active" : ""}`}
                  >
                    {t(`market.${id}` as "market.kripto")}
                  </Link>
                ))}
              </div>
            )}
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
                          href={yol(`/varlik/${quote.market}/${encodeURIComponent(quote.symbol)}`)}
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
                          href={yol(`/varlik/${quote.market}/${encodeURIComponent(quote.symbol)}`)}
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
                href={yol(`/varlik/${quote.market}/${encodeURIComponent(quote.symbol)}`)}
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

          {/* Sayfanın konusunu anlatan metin. Yalnızca sayı dolu bir tablo,
              arama motoruna sayfanın neyle ilgili olduğunu söylemiyor. */}
          <section className="prose market-about">
            <h2>{t(`market.${market.id}.aboutTitle` as "market.kripto.aboutTitle")}</h2>
            <p>{t(`market.${market.id}.about` as "market.kripto.about")}</p>
            <p>{t("market.methodology")}</p>
          </section>

          <section className="faq market-faq">
            <h2 className="section-title" style={{ textAlign: "start", fontSize: 22 }}>
              {t("nav.faq")}
            </h2>
            {sss.map((madde) => (
              <details key={madde.soru}>
                <summary>{madde.soru}</summary>
                <p>{madde.cevap}</p>
              </details>
            ))}
          </section>
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

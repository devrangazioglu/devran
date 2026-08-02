import Link from "next/link";

import AssetSearch from "@/components/AssetSearch";
import PlanCards from "@/components/PlanCards";
import Reveal from "@/components/motion/Reveal";
import SpotlightCard from "@/components/motion/SpotlightCard";
import { LogoWord } from "@/components/Logo";
import SiteNav from "@/components/SiteNav";
import { AssetAvatar, Change } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { intlTag, type Locale } from "@/lib/i18n";
import { localeHref } from "@/lib/i18n/routing";
import { faqJsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import { getQuotes } from "@/lib/markets/provider";
import { MARKETS, AKTIF_MARKET_IDS, type MarketId, type Quote } from "@/lib/markets/types";

// Tanıtım sayfası dakikada bir yeniden üretilir.
export const revalidate = 60;

/** Üst şeritteki altı başlık: en çok işlem görenlerle günün en hareketlileri. */
async function highlights(): Promise<Quote[]> {
  const TOPLAM = 6;
  const lists = await Promise.all(
    AKTIF_MARKET_IDS.map((market) =>
      getQuotes(market, 12)
        .then(({ quotes }) => quotes)
        .catch(() => []),
    ),
  );

  const dolu = lists.filter((list) => list.length > 0);
  const pay = Math.ceil(TOPLAM / Math.max(dolu.length, 1));

  const picks: Quote[] = [];
  const ekle = (quote?: Quote) => {
    if (quote && !picks.some((p) => p.id === quote.id)) picks.push(quote);
  };

  for (const list of dolu) {
    const hacim = [...list].sort((a, b) => b.volume - a.volume);
    const hareket = [...list].sort(
      (a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent),
    );
    const oncesi = picks.length;
    for (let i = 0; i < list.length && picks.length - oncesi < pay; i++) {
      ekle(hacim[i]);
      ekle(hareket[i]);
    }
  }
  return picks.slice(0, TOPLAM);
}

export default async function Landing({ locale: istenen }: { locale?: Locale } = {}) {
  const [{ t, locale }, quotes] = await Promise.all([getI18n(istenen), highlights()]);
  const intl = intlTag(locale);
  const yol = (path: string) => localeHref(locale, path);

  // SSS içeriği hem sayfada hem yapılandırılmış veride kullanılır; ikisi tek
  // kaynaktan gelsin ki arama sonucundaki cevap sayfadakinden şaşmasın.
  const sss = ([1, 2, 3, 4, 5] as const).map((n) => ({
    soru: t(`faq.q${n}` as "faq.q1"),
    cevap: t(`faq.a${n}` as "faq.a1"),
  }));

  const indicatorGroups = [
    {
      key: "category.trend" as const,
      items: ["EMA 9 / 21", "EMA 50 / 200", "Fiyat / EMA 200", "Supertrend", "ADX + DI", "VWAP"],
    },
    {
      key: "category.momentum" as const,
      items: ["RSI (14)", "MACD (12, 26, 9)", "Stokastik", "CCI (20)", "Williams %R", "ROC (10)"],
    },
    {
      key: "category.volatility" as const,
      items: ["Bollinger %B", "Bant genişliği", "ATR (14)", "Sıkışma"],
    },
    {
      key: "category.volume" as const,
      items: ["OBV", "Money Flow Index", "Hacim patlaması", "Hacim oranı"],
    },
  ];

  const yapisalVeri = [
    websiteJsonLd(locale, t("home.lead", { signals: "" }).trim()),
    organizationJsonLd(t("home.marketsSub")),
    faqJsonLd(sss),
  ];

  return (
    <>
      {/* Arama motorlarına sitenin kimliğini, site içi aramayı ve SSS'yi
          makine okunur biçimde bildirir. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(yapisalVeri) }}
      />

      <SiteNav locale={locale} />

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="hero">
        <div className="container">
          <div className="hero-center">
            <Reveal>
              <span className="pill pill-accent">{t("home.badge")}</span>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="hero-title">{t("home.title")}</h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="lead">
                {t("home.lead", { signals: `${t("signal.BUY")} / ${t("signal.SELL")} / ${t("signal.WAIT")}` })}
              </p>
            </Reveal>

            <Reveal delay={240} className="hero-search">
              <div className="search-card">
                <div className="search-card-title">{t("home.searchTitle")}</div>
                <AssetSearch size="large" />
                <p className="dim" style={{ fontSize: 12, marginTop: 10 }}>
                  {t("home.searchSub")}
                </p>
              </div>
            </Reveal>

            <Reveal delay={320}>
              <div className="hero-actions">
                <Link href={yol("/kayit")} className="btn btn-primary">
                  {t("home.ctaPrimary")}
                </Link>
                <a href="#nasil" className="btn btn-ghost">
                  {t("home.ctaSecondary")}
                </a>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Canlı öne çıkanlar ───────────────────────────── */}
      {quotes.length > 0 && (
        <section className="section-tight">
          <div className="container">
            <div className="ticker-strip">
              {quotes.map((quote) => (
                <Link
                  key={quote.id}
                  href={yol(`/piyasa/${MARKETS[quote.market].slug}`)}
                  className="ticker-item"
                >
                  <AssetAvatar ticker={quote.ticker} market={quote.market} size={24} />
                  <span className="ticker-name">{quote.ticker}</span>
                  <span className="mono">{formatPrice(quote.price, intl)}</span>
                  <Change value={quote.changePercent} />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Piyasalar ────────────────────────────────────── */}
      {/* Tek piyasa açıkken kart ızgarası anlamsız; şeritteki bağlantılar ve
          menü zaten piyasa sayfasına götürüyor. */}
      {AKTIF_MARKET_IDS.length > 1 && (
        <section className="section" id="piyasalar">
          <div className="container">
            <Reveal>
              <p className="eyebrow">
                <em>{t("nav.markets")}</em>
              </p>
              <h2 className="section-title">{t("home.marketsTitle")}</h2>
              <p className="section-sub">{t("home.marketsSub")}</p>
            </Reveal>

            <div className="grid-4">
              {AKTIF_MARKET_IDS.map((id, index) => (
                <Reveal key={id} delay={index * 70}>
                  <SpotlightCard>
                    <Link href={yol(`/piyasa/${MARKETS[id].slug}`)} className="market-card">
                      <span className={`market-dot market-dot-${id}`} aria-hidden />
                      <h3>{t(`market.${id}` as "market.kripto")}</h3>
                      <p>{t(`market.${id}.desc` as "market.kripto.desc")}</p>
                      <span className="market-card-link">{t("common.details")} →</span>
                    </Link>
                  </SpotlightCard>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Neden ────────────────────────────────────────── */}
      <section className="section" id="ozellikler">
        <div className="container">
          <div className="split-hero">
            <Reveal>
              <p className="eyebrow" style={{ textAlign: "start" }}>
                <em>{t("home.whyEyebrow")}</em>
              </p>
              <h2 className="section-title" style={{ textAlign: "start" }}>
                {t("home.whyTitle")}
              </h2>
              <p className="muted" style={{ fontSize: 15 }}>
                {t("home.whyLead")}
              </p>
            </Reveal>

            <div className="feature-grid">
              {[
                ["📊", "home.feature.indicators", "home.feature.indicators.desc"],
                ["🌍", "home.feature.markets", "home.feature.markets.desc"],
                ["🧭", "home.feature.timeframes", "home.feature.timeframes.desc"],
                ["🗣️", "home.feature.comment", "home.feature.comment.desc"],
                ["🎯", "home.feature.plan", "home.feature.plan.desc"],
                ["🔎", "home.feature.scanner", "home.feature.scanner.desc"],
              ].map(([icon, title, desc], index) => (
                <Reveal key={title} delay={index * 60}>
                  <div className="feature">
                    <span className="feature-icon">{icon}</span>
                    <div>
                      <strong>{t(title as "home.feature.plan")}</strong>
                      <span>{t(desc as "home.feature.plan.desc")}</span>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── İstatistikler ────────────────────────────────── */}
      <section className="section-tight">
        <div className="container">
          <div className="stat-grid">
            {[
              ["16", "home.stat.indicators"],
              ["8", "home.stat.timeframes"],
              ["8", "home.stat.languages"],
              ["7/24", "home.stat.always"],
            ].map(([value, key], index) => (
              <Reveal key={key} delay={index * 60}>
                <div className="stat">
                  <b>{value}</b>
                  <span>{t(key as "home.stat.markets")}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Nasıl çalışır ────────────────────────────────── */}
      <section className="section" id="nasil">
        <div className="container">
          <Reveal>
            <p className="eyebrow">
              <em>{t("home.howEyebrow")}</em>
            </p>
            <h2 className="section-title">{t("home.howTitle")}</h2>
            <p className="section-sub">{t("home.howSub")}</p>
          </Reveal>

          <div className="grid-3">
            {[
              ["home.how.1", "home.how.1.title", "home.how.1.desc"],
              ["home.how.2", "home.how.2.title", "home.how.2.desc"],
              ["home.how.3", "home.how.3.title", "home.how.3.desc"],
            ].map(([step, title, desc], index) => (
              <Reveal key={step} delay={index * 90}>
                <SpotlightCard className="card">
                  <div className="pill pill-accent" style={{ marginBottom: 14 }}>
                    {t(step as "home.how.1")}
                  </div>
                  <h3 style={{ fontSize: 18, marginBottom: 8 }}>{t(title as "home.how.1.title")}</h3>
                  <p className="muted" style={{ fontSize: 14 }}>
                    {t(desc as "home.how.1.desc")}
                  </p>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Göstergeler ──────────────────────────────────── */}
      <section className="section" id="gostergeler">
        <div className="container">
          <Reveal>
            <p className="eyebrow">
              <em>{t("home.indicatorsEyebrow")}</em>
            </p>
            <h2 className="section-title">{t("home.indicatorsTitle")}</h2>
            <p className="section-sub">{t("home.indicatorsSub")}</p>
          </Reveal>

          <div className="grid-4">
            {indicatorGroups.map((group, index) => (
              <Reveal key={group.key} delay={index * 60}>
                <div className="card">
                  <div className="card-title">{t(group.key)}</div>
                  <ul className="bullet-list">
                    {group.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Planlar ──────────────────────────────────────── */}
      <section className="section" id="planlar">
        <div className="container">
          <Reveal>
            <p className="eyebrow">
              <em>{t("nav.plans")}</em>
            </p>
            <h2 className="section-title">{t("plans.title")}</h2>
            <p className="section-sub">{t("plans.sub")}</p>
          </Reveal>

          <Reveal delay={80}>
            <PlanCards kayitHref={yol("/kayit")} />
          </Reveal>

          <Reveal delay={140}>
            <p className="section-sub" style={{ marginTop: 22 }}>
              <Link href={yol("/planlar")} style={{ color: "var(--accent)" }}>
                {t("plans.detailLink")} →
              </Link>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── SSS ──────────────────────────────────────────── */}
      <section className="section" id="sss">
        <div className="container">
          <Reveal>
            <p className="eyebrow">
              <em>{t("home.faqEyebrow")}</em>
            </p>
            <h2 className="section-title">{t("home.faqTitle")}</h2>
          </Reveal>

          <div className="faq" style={{ marginTop: 30 }}>
            {sss.map((madde, index) => (
              <Reveal key={madde.soru} delay={index * 50}>
                <details>
                  <summary>{madde.soru}</summary>
                  <p>{madde.cevap}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="section-tight">
        <div className="container">
          <Reveal>
            <div className="cta">
              <h2 style={{ fontSize: "clamp(24px, 3.4vw, 34px)", marginBottom: 12 }}>
                {t("home.ctaTitle")}
              </h2>
              <p className="muted" style={{ maxWidth: 520, margin: "0 auto 24px" }}>
                {t("home.ctaSub")}
              </p>
              <Link href={yol("/kayit")} className="btn btn-primary">
                {t("nav.register")}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <div className="footer-inner">
            <div className="logo">
              <LogoWord />
            </div>
            <nav className="footer-links">
              {AKTIF_MARKET_IDS.map((id) => (
                <Link key={id} href={yol(`/piyasa/${MARKETS[id].slug}`)}>
                  {t(`market.${id}` as "market.kripto")}
                </Link>
              ))}
              <Link href={yol("/planlar")}>{t("nav.plans")}</Link>
              <a href="#nasil">{t("nav.how")}</a>
              <a href="#sss">{t("nav.faq")}</a>
              <Link href={yol("/giris")}>{t("nav.login")}</Link>
            </nav>
          </div>
          <p className="disclaimer">
            <strong>{t("footer.legalTitle")}</strong> {t("footer.legal")}
          </p>
        </div>
      </footer>
    </>
  );
}

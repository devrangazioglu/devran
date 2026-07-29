import Link from "next/link";

import SiteNav from "@/components/SiteNav";
import { CoinAvatar, ScoreGauge, SignalBadge } from "@/components/ui";
import { analyze, type Analysis } from "@/lib/analysis";
import { fetchCandles, fetchMarkets, type Ticker } from "@/lib/binance";
import { formatCompact, formatPercent, formatPrice } from "@/lib/format";

// Tanıtım sayfası dakikada bir yeniden üretilir (Binance'e sürekli istek atmadan
// güncel fiyat göstermek için).
export const revalidate = 60;

type Highlight = { label: string; ticker: Ticker };

async function getHighlights(): Promise<Highlight[]> {
  try {
    const { tickers } = await fetchMarkets("USDT");
    if (tickers.length === 0) return [];

    const byVolume = [...tickers];
    const byGain = [...tickers]
      .filter((t) => t.quoteVolume > 5_000_000)
      .sort((a, b) => b.priceChangePercent - a.priceChangePercent);
    const byLoss = [...byGain].reverse();
    const byTrades = [...tickers].sort((a, b) => b.trades - a.trades);

    const candidates = [
      { label: "En yüksek hacim", ticker: byVolume[0] },
      { label: "Günün yükseleni", ticker: byGain[0] },
      { label: "Günün düşeni", ticker: byLoss[0] },
      { label: "En çok işlem", ticker: byTrades[0] },
      { label: "İkinci hacim", ticker: byVolume[1] },
      { label: "İkinci yükselen", ticker: byGain[1] },
      { label: "Üçüncü hacim", ticker: byVolume[2] },
      { label: "İkinci düşen", ticker: byLoss[1] },
      { label: "Dördüncü hacim", ticker: byVolume[3] },
    ];

    // Aynı coin iki kartta görünmesin; boşlukları sıradaki adayla doldur.
    const seen = new Set<string>();
    const picks: Highlight[] = [];
    for (const candidate of candidates) {
      if (picks.length === 6) break;
      if (!candidate.ticker || seen.has(candidate.ticker.symbol)) continue;
      seen.add(candidate.ticker.symbol);
      picks.push(candidate as Highlight);
    }
    return picks;
  } catch {
    return [];
  }
}

async function getShowcase(): Promise<Analysis | null> {
  try {
    const { candles, source } = await fetchCandles("BTCUSDT", "4h", 300);
    return analyze("BTCUSDT", "4h", candles, source);
  } catch {
    return null;
  }
}

export default async function LandingPage() {
  const [highlights, showcase] = await Promise.all([getHighlights(), getShowcase()]);

  return (
    <>
      <SiteNav />

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="pill pill-accent">Binance verisiyle teknik analiz</span>
            <h1>
              Coinleri analiz et,
              <br />
              al–sat sinyalini gör
            </h1>
            <p className="lead">
              Binance&apos;in canlı mum verisini çekiyoruz, 16 teknik göstergeyi hesaplıyoruz
              ve sonucu ağırlıklı bir skora çevirip <strong>AL / SAT / BEKLE</strong> sinyali
              üretiyoruz — üstelik neden öyle olduğunu Türkçe olarak açıklıyoruz.
            </p>
            <div className="hero-actions">
              <Link href="/kayit" className="btn btn-primary">
                Ücretsiz hesap aç
              </Link>
              <a href="#nasil" className="btn btn-ghost">
                Nasıl çalışır?
              </a>
            </div>
            <p className="disclaimer" style={{ maxWidth: 460 }}>
              Kriptosinyal bir teknik analiz aracıdır. Ürettiği sinyaller yatırım tavsiyesi
              değildir; kararlarınızın sorumluluğu size aittir.
            </p>
          </div>

          {/* Canlı analiz kartı — hero görseli */}
          <div className="hero-visual">
            <div className="card" style={{ padding: 20 }}>
              {showcase ? (
                <>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 16,
                    }}
                  >
                    <div className="coin-cell">
                      <CoinAvatar base={showcase.base} size={34} />
                      <div>
                        <strong>
                          {showcase.base}/{showcase.quote}
                        </strong>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {showcase.intervalLabel} · canlı analiz
                        </div>
                      </div>
                    </div>
                    <SignalBadge signal={showcase.signal} />
                  </div>

                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <ScoreGauge score={showcase.score} signal={showcase.signal} size={190} />
                  </div>

                  <div className="grid-3" style={{ gap: 10, marginTop: 8 }}>
                    <div className="card-soft" style={{ padding: 12, textAlign: "center" }}>
                      <div className="dim" style={{ fontSize: 11 }}>
                        FİYAT
                      </div>
                      <strong className="mono">{formatPrice(showcase.price)}</strong>
                    </div>
                    <div className="card-soft" style={{ padding: 12, textAlign: "center" }}>
                      <div className="dim" style={{ fontSize: 11 }}>
                        RSI
                      </div>
                      <strong className="mono">
                        {showcase.indicators.rsi?.toFixed(1) ?? "—"}
                      </strong>
                    </div>
                    <div className="card-soft" style={{ padding: 12, textAlign: "center" }}>
                      <div className="dim" style={{ fontSize: 11 }}>
                        GÜVEN
                      </div>
                      <strong className="mono">%{showcase.confidence}</strong>
                    </div>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    {showcase.checks.slice(0, 4).map((check) => (
                      <div
                        key={check.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 0",
                          borderBottom: "1px solid var(--border-soft)",
                          fontSize: 13,
                        }}
                      >
                        <span className="muted">{check.name}</span>
                        <span
                          className={
                            check.verdict === "AL"
                              ? "up"
                              : check.verdict === "SAT"
                                ? "down"
                                : "muted"
                          }
                        >
                          {check.verdict}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "40px 10px" }}>
                  <div className="pill" style={{ marginBottom: 14 }}>
                    Canlı veri şu an alınamıyor
                  </div>
                  <p className="muted" style={{ fontSize: 14 }}>
                    Binance API&apos;sine bu sunucudan erişilemedi. Uygulamayı kendi
                    ortamınızda çalıştırdığınızda analiz kartı canlı veriyle dolar.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Veri kaynağı şeridi ──────────────────────────── */}
      <section className="section-tight">
        <div className="container">
          <p className="eyebrow">
            Tüm veriler doğrudan <em>Binance Spot API</em> üzerinden
          </p>
          <div className="logo-strip">
            <span>Klines</span>
            <span>24h Ticker</span>
            <span>Spot Market</span>
            <span>REST v3</span>
            <span>USDT Pariteleri</span>
          </div>
        </div>
      </section>

      {/* ── Öne çıkan coinler ────────────────────────────── */}
      <section className="section" id="piyasa">
        <div className="container">
          <p className="eyebrow">
            Öne çıkan <em>kripto paralar</em>
          </p>
          <h2 className="section-title">Piyasadan canlı görünüm</h2>
          <p className="section-sub">
            Binance&apos;teki USDT paritelerinden hacim, yükseliş ve işlem sayısına göre
            seçilen başlıklar — sayfa her dakika güncellenir.
          </p>

          {highlights.length > 0 ? (
            <div className="coin-row">
              {highlights.map((item) => (
                <Link
                  key={item.label}
                  href={`/coin/${item.ticker.symbol}`}
                  className="coin-card"
                >
                  <div className="label">{item.label}</div>
                  <CoinAvatar base={item.ticker.base} size={26} />
                  <div className="name" style={{ marginTop: 10 }}>
                    {item.ticker.base}
                  </div>
                  <div className="price">{formatPrice(item.ticker.lastPrice)}</div>
                  <div
                    style={{ fontSize: 13, marginTop: 4 }}
                    className={item.ticker.priceChangePercent >= 0 ? "up" : "down"}
                  >
                    {formatPercent(item.ticker.priceChangePercent)}
                  </div>
                  <div className="dim" style={{ fontSize: 11, marginTop: 6 }}>
                    Hacim {formatCompact(item.ticker.quoteVolume)} $
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="section-sub">
              Piyasa verisi şu anda alınamadı. Uygulamayı kendi sunucunuzda
              çalıştırdığınızda bu alan canlı fiyatlarla dolar.
            </p>
          )}
        </div>
      </section>

      {/* ── Özellikler ───────────────────────────────────── */}
      <section className="section" id="ozellikler">
        <div className="container">
          <div className="hero-grid">
            <div>
              <p className="eyebrow" style={{ textAlign: "left" }}>
                Neden <em>Kriptosinyal</em>
              </p>
              <h2 style={{ fontSize: "clamp(26px, 3.6vw, 38px)", marginBottom: 14 }}>
                Grafiği okumak zorunda kalmadan
                <br />
                teknik analizi görün
              </h2>
              <p className="muted" style={{ fontSize: 15 }}>
                Her gösterge ayrı ayrı hesaplanır, ağırlıklandırılır ve tek bir skorda
                birleşir. Sonuç sadece bir rozet değil: hangi göstergenin neden o yönde oy
                verdiğini cümle cümle okuyabilirsiniz.
              </p>

              <div className="feature-grid">
                <div className="feature">
                  <span className="feature-icon">📊</span>
                  <div>
                    <strong>16 teknik gösterge</strong>
                    <span>RSI, MACD, Bollinger, ADX, Supertrend, OBV ve dahası</span>
                  </div>
                </div>
                <div className="feature">
                  <span className="feature-icon">🧭</span>
                  <div>
                    <strong>Çoklu zaman dilimi</strong>
                    <span>1 dakikadan haftalığa kadar 8 periyot ve trend uyumu</span>
                  </div>
                </div>
                <div className="feature">
                  <span className="feature-icon">🗣️</span>
                  <div>
                    <strong>Türkçe yorum</strong>
                    <span>Sinyalin gerekçesi, riskleri ve seviyeleri düz metin olarak</span>
                  </div>
                </div>
                <div className="feature">
                  <span className="feature-icon">🎯</span>
                  <div>
                    <strong>İşlem planı</strong>
                    <span>ATR tabanlı zarar durdur, hedefler ve risk/ödül oranı</span>
                  </div>
                </div>
                <div className="feature">
                  <span className="feature-icon">🔎</span>
                  <div>
                    <strong>Sinyal tarayıcı</strong>
                    <span>Onlarca coini tek seferde tarayıp en güçlü sinyalleri sıralar</span>
                  </div>
                </div>
                <div className="feature">
                  <span className="feature-icon">⭐</span>
                  <div>
                    <strong>Takip listesi</strong>
                    <span>Hesabınıza kayıtlı coinler, her girişte hazır</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sinyal listesi önizlemesi */}
            <div className="card">
              <div className="card-title">
                <span>Piyasa önizleme</span>
                <span className="pill" style={{ fontSize: 12 }}>
                  24 saat
                </span>
              </div>
              {highlights.length > 0 ? (
                highlights.slice(0, 5).map((item) => (
                  <div
                    key={item.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 0",
                      borderBottom: "1px solid var(--border-soft)",
                    }}
                  >
                    <div className="coin-cell">
                      <CoinAvatar base={item.ticker.base} />
                      <div>
                        <div style={{ fontSize: 14 }}>{item.ticker.base}</div>
                        <div className="dim" style={{ fontSize: 12 }}>
                          {item.ticker.base}/{item.ticker.quote}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="mono" style={{ fontSize: 14 }}>
                        {formatPrice(item.ticker.lastPrice)}
                      </div>
                      <div
                        style={{ fontSize: 12 }}
                        className={item.ticker.priceChangePercent >= 0 ? "up" : "down"}
                      >
                        {formatPercent(item.ticker.priceChangePercent)}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted" style={{ fontSize: 14 }}>
                  Tarayıcı, seçtiğiniz zaman diliminde en yüksek hacimli 60 pariteye kadar
                  analiz yapar ve skorlarına göre sıralar.
                </p>
              )}
              <Link
                href="/tarayici"
                className="btn btn-primary btn-block"
                style={{ marginTop: 18 }}
              >
                Sinyal tarayıcıyı aç
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── İstatistikler ────────────────────────────────── */}
      <section className="section-tight">
        <div className="container">
          <div className="stat-grid">
            <div className="stat">
              <b>16</b>
              <span>Teknik gösterge</span>
            </div>
            <div className="stat">
              <b>8</b>
              <span>Zaman dilimi</span>
            </div>
            <div className="stat">
              <b>400+</b>
              <span>USDT paritesi</span>
            </div>
            <div className="stat">
              <b>7/24</b>
              <span>Canlı piyasa verisi</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Nasıl çalışır ────────────────────────────────── */}
      <section className="section" id="nasil">
        <div className="container">
          <p className="eyebrow">
            Üç adımda <em>sinyal</em>
          </p>
          <h2 className="section-title">Nasıl çalışır?</h2>
          <p className="section-sub">
            Kara kutu yok: veriden sinyale giden yolun her adımı görünür.
          </p>

          <div className="grid-3">
            <div className="card">
              <div className="pill pill-accent" style={{ marginBottom: 14 }}>
                1. Veri
              </div>
              <h3 style={{ fontSize: 18, marginBottom: 8 }}>Binance&apos;ten mum verisi</h3>
              <p className="muted" style={{ fontSize: 14 }}>
                Seçtiğiniz parite ve zaman dilimi için son 300 mum (OHLCV) doğrudan Binance
                Spot API&apos;sinden çekilir. API anahtarı gerekmez, veriler önbelleğe
                alınır.
              </p>
            </div>
            <div className="card">
              <div className="pill pill-accent" style={{ marginBottom: 14 }}>
                2. Analiz
              </div>
              <h3 style={{ fontSize: 18, marginBottom: 8 }}>16 gösterge, ağırlıklı oy</h3>
              <p className="muted" style={{ fontSize: 14 }}>
                Her gösterge −1 ile +1 arasında bir yön üretir; önem ağırlığıyla çarpılıp
                toplanır. Sonuç −100 ile +100 arasında tek bir skora dönüşür.
              </p>
            </div>
            <div className="card">
              <div className="pill pill-accent" style={{ marginBottom: 14 }}>
                3. Yorum
              </div>
              <h3 style={{ fontSize: 18, marginBottom: 8 }}>Sinyal ve gerekçesi</h3>
              <p className="muted" style={{ fontSize: 14 }}>
                Skor AL / SAT / BEKLE sinyaline çevrilir; destek-direnç seviyeleri,
                formasyonlar, riskler ve ATR tabanlı işlem planı Türkçe olarak yazılır.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Göstergeler ──────────────────────────────────── */}
      <section className="section" id="gostergeler">
        <div className="container">
          <p className="eyebrow">
            Motorun <em>içindekiler</em>
          </p>
          <h2 className="section-title">Hesaplanan göstergeler</h2>
          <p className="section-sub">
            Tümü uygulama içinde, harici bir analiz servisi kullanılmadan hesaplanır.
          </p>

          <div className="grid-4">
            {[
              {
                group: "Trend",
                items: [
                  "EMA 9 / 21",
                  "EMA 50 / 200",
                  "Fiyat / EMA 200",
                  "Supertrend",
                  "ADX + DI",
                  "VWAP",
                ],
              },
              {
                group: "Momentum",
                items: [
                  "RSI (14)",
                  "MACD (12, 26, 9)",
                  "Stokastik",
                  "CCI (20)",
                  "Williams %R",
                  "ROC (10)",
                ],
              },
              {
                group: "Volatilite",
                items: ["Bollinger %B", "Bant genişliği", "ATR (14)", "Sıkışma tespiti"],
              },
              {
                group: "Hacim",
                items: ["OBV eğimi", "Para akış endeksi", "Hacim patlaması", "Hacim oranı"],
              },
            ].map((column) => (
              <div key={column.group} className="card">
                <div className="card-title">{column.group}</div>
                <ul className="bullet-list">
                  {column.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SSS ──────────────────────────────────────────── */}
      <section className="section" id="sss">
        <div className="container">
          <p className="eyebrow">
            Sık sorulan <em>sorular</em>
          </p>
          <h2 className="section-title">Merak edilenler</h2>
          <div className="faq" style={{ marginTop: 30 }}>
            <details>
              <summary>Binance hesabı veya API anahtarı gerekiyor mu?</summary>
              <p>
                Hayır. Uygulama yalnızca Binance&apos;in herkese açık piyasa verilerini okur;
                bakiyenize erişmez, sizin adınıza emir göndermez. API anahtarı istenmez.
              </p>
            </details>
            <details>
              <summary>Sinyaller yatırım tavsiyesi mi?</summary>
              <p>
                Hayır. Üretilen çıktı, kural tabanlı bir teknik analiz özetidir. Teknik
                göstergeler geçmiş fiyat hareketine bakar ve geleceği garanti etmez. Kripto
                piyasaları yüksek risklidir.
              </p>
            </details>
            <details>
              <summary>Skor nasıl hesaplanıyor?</summary>
              <p>
                Her gösterge kendi kuralına göre −1 (güçlü satış) ile +1 (güçlü alış)
                arasında bir yön üretir. Bu yönler göstergenin ağırlığıyla çarpılır,
                toplanır ve toplam ağırlığa bölünerek −100…+100 aralığına ölçeklenir. 45 ve
                üzeri &quot;güçlü al&quot;, −45 ve altı &quot;güçlü sat&quot; sayılır.
              </p>
            </details>
            <details>
              <summary>Hangi zaman dilimini seçmeliyim?</summary>
              <p>
                Kısa vadeli işlemler için 15 dakika–1 saat, swing işlemler için 4 saat–1 gün
                yaygın tercihlerdir. Detay sayfasında seçtiğiniz periyodun yanı sıra üst
                zaman dilimlerinin sinyallerini de görürsünüz; uyum arttıkça sinyal daha
                güvenilir sayılır.
              </p>
            </details>
            <details>
              <summary>Veriler ne sıklıkla güncelleniyor?</summary>
              <p>
                Mum verisi seçilen periyodun yaklaşık yirmide biri kadar süreyle önbelleğe
                alınır (en az 10 saniye), piyasa özeti 20 saniyede bir tazelenir. Panelde
                &quot;Yenile&quot; düğmesiyle her an güncelleyebilirsiniz.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="section-tight">
        <div className="container">
          <div className="cta">
            <h2 style={{ fontSize: "clamp(24px, 3.4vw, 34px)", marginBottom: 12 }}>
              Hesabınızı açın, ilk analizinizi bir dakikada alın
            </h2>
            <p className="muted" style={{ maxWidth: 520, margin: "0 auto 24px" }}>
              E-posta ile kayıt olun ya da Google hesabınızla girin; takip listeniz ve
              tercihleriniz hesabınıza kaydedilsin.
            </p>
            <Link href="/kayit" className="btn btn-primary">
              Ücretsiz başla
            </Link>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <div className="footer-inner">
            <div className="logo">
              <span className="logo-mark">₿</span>
              <span>
                Kripto<em>sinyal</em>
              </span>
            </div>
            <nav style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <a href="#ozellikler">Özellikler</a>
              <a href="#nasil">Nasıl çalışır</a>
              <a href="#sss">SSS</a>
              <Link href="/giris">Giriş</Link>
              <Link href="/kayit">Kayıt</Link>
            </nav>
          </div>
          <p className="disclaimer">
            <strong>Yasal uyarı:</strong> Kriptosinyal bir teknik analiz aracıdır, yatırım
            danışmanlığı hizmeti değildir. Sitede yer alan sinyaller, skorlar, seviyeler ve
            yorumlar geçmiş fiyat verisine dayanan otomatik hesaplamalardır ve alım-satım
            tavsiyesi niteliği taşımaz. Kripto varlıklar yüksek volatiliteye sahiptir;
            yatırdığınız tutarın tamamını kaybedebilirsiniz. Piyasa verileri Binance Spot
            API&apos;sinden alınır; gecikmeli ya da eksik olabilir.
          </p>
        </div>
      </footer>
    </>
  );
}

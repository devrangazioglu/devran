/**
 * App Store sayfasının metinleri — tek kaynak.
 *
 * `magaza-sayfasi.mjs` bunları App Store Connect'e yazar. Bir metni
 * değiştirmek için burayı düzenleyip "Mağaza sayfası" iş akışını yeniden
 * çalıştırmak yeterli. Sınırlar: ad ve alt başlık 30, promosyon metni 170,
 * anahtar kelimeler 100, açıklama 4000 karakter.
 */

export const SITE = "https://www.fibonex360.com";

/** Ad alınmışsa sıradaki denenir. */
export const AD_ADAYLARI = ["Fibonex360", "Fibonex360: Teknik Analiz", "Fibonex360 Borsa Analiz"];

export const ADRESLER = {
  gizlilik: `${SITE}/gizlilik`,
  destek: `${SITE}/destek`,
  pazarlama: SITE,
};

export const TELIF = "2026 Fibonex360";

export const DILLER = {
  tr: {
    altBaslik: "Borsa ve kripto teknik analiz",
    promosyon:
      "Yeni üyelere 30 analiz kredisi hediye. Kripto, ABD, Borsa İstanbul ve 11 dünya borsası için 20+ göstergeyle teknik analiz ve 360° bakış.",
    anahtarKelimeler:
      "teknik analiz,borsa,bist,kripto,bitcoin,hisse,grafik,rsi,macd,döviz,altın,nasdaq,endeks,trend",
    aciklama: `Fibonex360, piyasaya 360 derece bakmanızı sağlayan teknik analiz uygulamasıdır. Kripto paralar, Amerikan borsası, Borsa İstanbul, 11 büyük dünya borsası, döviz ve emtia için 20'den fazla teknik göstergeyi tek bir skorda birleştirir ve sonucu herkesin anlayacağı sade bir dille anlatır.

NELER VAR
• Yükseliş / düşüş / nötr teknik görünüm ve −100…+100 arası tek skor
• 360° Bakış: trend, momentum, yapı, hacim, oynaklık, zaman dilimleri, göreli güç ve temel analiz tek halkada
• "Kısaca" özeti: teknik analiz bilmeyenler için tek paragrafta ne olduğu
• Destek ve direnç seviyeleri, teknik seviyeler ve formasyonlar
• RSI, MACD, Bollinger, ADX, Stokastik, Ichimoku, OBV ve daha fazlası
• 1 dakikadan haftalığa 8 zaman dilimi (canlı piyasalarda)
• Teknik tarayıcı: bir piyasanın teknik görünümü tek ekranda
• Takip listesi ve tek dokunuşla toplu analiz
• Doğruluk sayfası: geçmiş analizlerin gerçek sonuçları herkese açık

PİYASALAR
Kripto (canlı) · ABD hisseleri (canlı) · Borsa İstanbul · Almanya · İngiltere · Fransa · Japonya · Çin · Hong Kong · Hindistan · Kanada · Güney Kore · Tayvan · Suudi Arabistan · Döviz (canlı) · Altın, gümüş, petrol ve diğer emtialar

ÜCRETSİZ BAŞLAYIN
Yeni üyelere 30 analiz kredisi hediye, kart gerekmez. Ücretsiz planda ayrıca her ay 10 analiz. Arkadaşınızı davet edin, ikiniz de ek kredi kazanın.

GİZLİLİK
Borsa hesabınıza bağlanmayız, emir göndermeyiz, verinizi satmayız. Hesabınızı uygulamanın içinden tek dokunuşla silebilirsiniz.

ÖNEMLİ
Fibonex360 bir teknik analiz aracıdır; burada yer alan bilgi, yorum ve görünümler yatırım danışmanlığı kapsamında değildir. Analizler geçmiş fiyatlardan otomatik hesaplanır, herkese aynı gösterilir ve kâr garantisi vermez. Bazı borsaların fiyatları borsa kuralı gereği 15–20 dakika gecikmelidir.

Kullanım koşulları: ${SITE}/kosullar
Gizlilik: ${SITE}/gizlilik`,
  },
  "en-US": {
    altBaslik: "Stock & crypto chart analysis",
    promosyon:
      "New members get 30 free analysis credits. Technical analysis with 20+ indicators and a 360° view for crypto, US stocks, Borsa Istanbul and 11 world exchanges.",
    anahtarKelimeler:
      "technical analysis,stocks,crypto,bitcoin,chart,rsi,macd,forex,gold,nasdaq,indicator,trend,market",
    aciklama: `Fibonex360 gives you a 360° view of the market. It combines 20+ technical indicators into a single score for crypto, US stocks, Borsa Istanbul, 11 major world exchanges, FX and commodities, and explains the result in plain language.

FEATURES
• Bullish / bearish / neutral technical outlook and a single −100…+100 score
• 360° View: trend, momentum, structure, volume, volatility, timeframes, relative strength and fundamentals in one ring
• Plain-language summary for people new to technical analysis
• Support and resistance levels, technical levels and chart patterns
• RSI, MACD, Bollinger Bands, ADX, Stochastic, Ichimoku, OBV and more
• 8 timeframes from 1 minute to weekly (on live markets)
• Technical scanner: a whole market's technical outlook on one screen
• Watchlist with one-tap batch analysis
• Accuracy page: the real outcome of past analyses, published openly

START FREE
New members get 30 free analysis credits, no card required, plus 10 analyses every month on the free plan.

PRIVACY
We never connect to your brokerage account, never place orders and never sell your data. Delete your account from inside the app at any time.

IMPORTANT
Fibonex360 is a technical analysis tool, not investment advice. Analyses are calculated automatically from past prices, are identical for every user and do not guarantee profit. Some exchanges are delayed by 15–20 minutes under exchange rules.

Terms: ${SITE}/kosullar
Privacy: ${SITE}/gizlilik`,
  },
};

/** App Review ekibine not (İngilizce). Demo hesap bilgisi ayrı alanlara yazılır. */
export const INCELEME_NOTU = `Fibonex360 is a technical analysis app for stocks, crypto, FX and commodities. It does not provide personalised investment advice, does not connect to brokerage accounts and does not execute trades. Technical outlooks (bullish / bearish / neutral) are calculated algorithmically from public market data, are identical for all users and are shown with a standard investment-advice disclaimer (Turkish Capital Markets Board wording).

The demo account in the Sign-In Information fields is a regular member account with enough analysis credits to review every feature.

How to test:
1. Sign in with the demo account (email + password; the Google button is hidden inside the app).
2. Panel: market overview. Tap any asset (or use the search icon at the top) for the full analysis: score, 360° View, indicators, support/resistance levels.
3. Bottom tab "Scanner" scans a whole market; "Watchlist" analyses saved assets in one tap.
4. Settings → Account → "Delete account" permanently deletes the account (guideline 5.1.1(v)).

In-app purchases: this version sells nothing inside the iOS app. The free plan and a free 7-day trial (no payment) are available; purchase buttons are hidden on iOS. In-app purchase will be added in a later version.

Support: ${SITE}/destek`;

/** Ekran görüntüleri: sayfa, başlık ve kısa açıklama. */
export const EKRANLAR = [
  {
    ad: "01-analiz",
    yol: "/varlik/abd/AAPL?interval=1d",
    baslik: "Tek skorda\nteknik görünüm",
    alt: "20+ gösterge, −100…+100 arası tek skor ve sade bir özet",
  },
  {
    ad: "02-360",
    yol: "/varlik/abd/NVDA?interval=1d",
    kaydir: ".b360-kart",
    baslik: "360° Bakış",
    alt: "Trend, momentum, hacim, oynaklık ve temel analiz tek halkada",
  },
  {
    ad: "03-panel",
    yol: "/panel",
    baslik: "Bütün piyasalar\ntek ekranda",
    alt: "Kripto, ABD, Borsa İstanbul, 11 dünya borsası, döviz ve emtia",
  },
  {
    ad: "04-kripto",
    yol: "/varlik/kripto/BTCUSDT?interval=4h",
    baslik: "Canlı fiyat,\n8 zaman dilimi",
    alt: "1 dakikadan haftalığa; destek ve direnç seviyeleriyle",
  },
  {
    ad: "05-tarayici",
    yol: "/tarayici",
    baslik: "Teknik tarayıcı",
    alt: "Bir piyasanın tamamını saniyeler içinde tarayın",
  },
  {
    ad: "06-dogruluk",
    yol: "/dogruluk",
    baslik: "Sonuçlar\nherkese açık",
    alt: "Geçmiş analizlerin gerçekte ne olduğunu kendiniz görün",
  },
];

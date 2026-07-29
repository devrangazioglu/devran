# Kriptosinyal

Binance'in **herkese açık** piyasa verisini çekip coinlere teknik analiz yapan, sonucu
ağırlıklı bir skora çevirerek **AL / SAT / BEKLE** sinyali üreten ve bu sinyali **Türkçe
olarak yorumlayan** üyelik girişli web uygulaması.

> ⚠️ **Yasal uyarı:** Bu uygulama bir teknik analiz aracıdır, yatırım danışmanlığı hizmeti
> değildir. Üretilen sinyaller geçmiş fiyat verisine dayanan otomatik hesaplamalardır ve
> alım-satım tavsiyesi niteliği taşımaz. Kripto varlıklar yüksek volatiliteye sahiptir.

## Özellikler

- 🔐 **Üyelik sistemi** — e-posta + parola (scrypt ile hash'lenir) ve isteğe bağlı Google ile giriş
- 📈 **Binance Spot API** — mum verisi (klines) ve 24 saatlik özet; **API anahtarı gerekmez**
- 📊 **16 teknik gösterge** — RSI, MACD, EMA 9/21/50/200, Bollinger, Stokastik, ATR, ADX+DI,
  Supertrend, OBV, MFI, CCI, Williams %R, ROC, VWAP, hacim oranı
- 🧮 **Ağırlıklı skor motoru** — her gösterge −1…+1 yön üretir, ağırlıklandırılır ve −100…+100
  arası tek skora indirgenir; skor sinyale çevrilir
- 🗣️ **Türkçe yorum** — trend, momentum, hacim, volatilite, seviyeler ve riskler paragraf paragraf
- 🕯️ **Formasyon tespiti** — yutan mumlar, çekiç, kayan yıldız, doji, sabah/akşam yıldızı,
  golden/death cross, MACD kesişimi, RSI uyumsuzluğu, Bollinger sıkışması
- 🎯 **İşlem planı** — ATR ve swing noktalarına göre giriş, zarar durdur, 3 hedef, risk/ödül
- 🧭 **Destek / direnç** — pivot kümeleme ile seviyeler ve dokunuş sayısına göre güç
- 🔎 **Sinyal tarayıcı** — en yüksek hacimli 60 pariteye kadar tarama, filtreleme ve sıralama
- ⭐ **Takip listesi** — hesaba kayıtlı pariteler, tek ekranda analiz
- 📉 **Bağımlılıksız grafikler** — canvas ile mum grafiği (EMA + Bollinger + hacim), RSI ve MACD panelleri
- ⏱️ **8 zaman dilimi** — 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w + üst periyot uyumu

## Kurulum

```bash
npm install
cp .env.example .env.local
# .env.local içine AUTH_SECRET yazın:  openssl rand -base64 32
npm run dev
```

Tarayıcıda [http://localhost:3000](http://localhost:3000) adresini açın, `/kayit`
sayfasından hesap oluşturun.

### Ortam değişkenleri

| Değişken | Zorunlu | Açıklama |
|---|---|---|
| `AUTH_SECRET` | ✅ | Oturum çerezlerini imzalar. `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | — | Google ile giriş. Boşsa yalnızca e-posta + parola görünür |
| `USERS_FILE` | — | Kullanıcı deposu yolu (varsayılan `data/users.json`) |
| `DEMO_DATA` | — | `1` ise Binance'e erişilemediğinde sentetik demo veri üretilir (geliştirme için) |

Binance için **API anahtarı gerekmez**; yalnızca herkese açık uç noktalar okunur, emir
gönderilmez, hesabınıza erişilmez.

## Komutlar

```bash
npm run dev        # geliştirme sunucusu
npm run build      # üretim derlemesi
npm start          # üretim sunucusu
npm test           # gösterge ve sinyal motoru testleri (25 test)
npm run typecheck  # tsc --noEmit
```

## Dosya yapısı

```
app/
  page.tsx                     tanıtım (landing) sayfası
  giris/, kayit/               giriş ve kayıt sayfaları
  (uye)/                       oturum gerektiren alan
    layout.tsx                 oturum kontrolü + üst menü
    panel/                     piyasa özeti, güçlü sinyaller, piyasa tablosu
    coin/[symbol]/             detay: grafik, göstergeler, yorum, plan, seviyeler
    tarayici/                  sinyal tarayıcı (filtre + sıralama)
    takip/                     takip listesi
    ayarlar/                   tercihler ve hesap bilgisi
  api/
    analyze/                   tek parite için tam analiz + yorum + grafik serileri
    scan/                      çoklu parite taraması
    markets/                   24 saatlik piyasa özeti
    register/, watchlist/, settings/, auth/
lib/
  binance.ts                   Binance istemcisi (çok uç noktalı, önbellekli, demo yedekli)
  indicators.ts                saf gösterge fonksiyonları
  analysis.ts                  skor motoru, formasyonlar, seviyeler, işlem planı
  commentary.ts                Türkçe yorum üretici
  users.ts                     dosya tabanlı kullanıcı deposu (scrypt)
  format.ts, api-types.ts      biçimlendirme ve paylaşılan API tipleri
components/
  CandleChart.tsx              canvas mum grafiği
  IndicatorChart.tsx           RSI / MACD panelleri
  ui.tsx                       skor göstergesi, rozetler, coin ikonları
tests/                         node:test birim testleri
```

## Skor motoru nasıl çalışır?

1. Seçilen parite ve periyot için Binance'ten son **300 mum** çekilir (`/api/v3/klines`).
2. 16 gösterge hesaplanır. Her biri kendi kuralına göre bir **yön** (−1 … +1) ve bir
   **ağırlık** (0,6 … 1,5) üretir. Örnek: RSI ≤ 30 → +0,85 (aşırı satım, alış lehine);
   EMA 50 < EMA 200 → negatif yön (ana trend aşağı).
3. Skor = Σ(yön × ağırlık) ÷ Σ(ağırlık) × 100 → **−100 … +100**.
4. Eşikler: `≥ +45` GÜÇLÜ AL, `≥ +18` AL, `−18 … +18` BEKLE, `≤ −18` SAT, `≤ −45` GÜÇLÜ SAT.
5. **Güven** (%) skorun büyüklüğü, göstergelerin uyum oranı ve ADX'in trend gücünden üretilir.
6. Zarar durdur, son 12 mumun swing noktası ile 1,5 × ATR'den **daha uzak** olanına göre
   belirlenir; ilk hedef mümkünse en yakın anlamlı direnç/destek, sonraki hedefler 1,618 ve
   2,618 R seviyeleridir.

## Üretime alırken

- **Kullanıcı deposu:** varsayılan olarak `data/users.json` dosyası kullanılır. Vercel gibi
  sunucusuz ortamlarda disk kalıcı olmadığı için `lib/users.ts` içindeki okuma/yazma
  fonksiyonlarını bir veritabanına (Postgres, SQLite, Redis…) taşıyın — dosyanın geri kalanı
  ve tüm çağrı noktaları aynı kalır.
- **İstek limiti:** Binance IP başına ağırlık limiti uygular. Tarama sayısını yükseltirken
  (`ayarlar` → coin sayısı) dikkatli olun; yanıtlar bellek içinde önbelleğe alınır ve tarama
  en fazla 6 eşzamanlı istek yapar.
- **Coğrafi kısıtlar:** bazı ağlarda `api.binance.com` engellidir. İstemci sırayla
  `api-gcp`, `api1`, `api2` ve `data-api.binance.vision` uç noktalarını dener.

## Teknoloji

Next.js 15 (App Router) · React 19 · TypeScript · Auth.js (next-auth v5) · harici çalışma
zamanı bağımlılığı olmayan kendi gösterge/grafik kodu.

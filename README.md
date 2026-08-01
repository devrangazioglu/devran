# Fibonex

Dört piyasadan **herkese açık** fiyat verisi çekip teknik analiz yapan, sonucu ağırlıklı bir
skora çevirerek **AL / SAT / BEKLE** sinyali üreten ve bu sinyali **kullanıcının dilinde
yorumlayan** üyelik girişli web uygulaması.

| Piyasa | Kapsam | Sayfa |
|---|---|---|
| Kripto | Hacme göre ilk 60 parite (BTC, ETH, SOL…) | `/piyasa/kripto` |
| Amerikan borsası | 46 hisse ve endeks (AAPL, NVDA, S&P 500, Nasdaq…) · günlük/haftalık | `/piyasa/abd-borsasi` |
| Türkiye borsası | 43 BIST hissesi ve endeksi (THYAO, ASELS, BIST 100…) · günlük/haftalık | `/piyasa/turkiye-borsasi` |
| Dövizler ve emtia | Altın, gümüş, petrol, doğal gaz, USD/TRY, EUR/USD… · günlük/haftalık | `/piyasa/dovizler` |

> ⚠️ **Yasal uyarı:** Bu uygulama bir teknik analiz aracıdır, yatırım danışmanlığı hizmeti
> değildir. Üretilen sinyaller geçmiş fiyat verisine dayanan otomatik hesaplamalardır ve
> alım-satım tavsiyesi niteliği taşımaz.

## Özellikler

- 🔐 **Üyelik sistemi** — e-posta + parola (scrypt ile hash'lenir) ve isteğe bağlı Google ile giriş
- 🌍 **Dört piyasa, tek motor** — analiz kodu varlık türünü bilmez; aynı göstergeler hisseye,
  endekse, altına ve coine uygulanır
- 🔎 **Birleşik arama** — ana sayfada ve üye menüsünde tüm piyasalarda arama; aksan duyarsız
  ("altin" → Altın) ve çok dilli eş anlamlılarla ("gold", "oil", "borsa istanbul")
- 📊 **16 teknik gösterge** — RSI, MACD, EMA 9/21/50/200, Bollinger, Stokastik, ATR, ADX+DI,
  Supertrend, OBV, MFI, CCI, Williams %R, ROC, VWAP, hacim oranı
- 🧮 **Ağırlıklı skor motoru** — her gösterge −1…+1 yön üretir, ağırlıklandırılır ve −100…+100
  arası tek skora indirgenir; skor sinyale çevrilir
- 🏆 **Top 10 AL** — panelde seçili piyasa ve periyot için en güçlü alış sinyalleri sıralı liste
- 🗣️ **Çok dilli yorum** — trend, momentum, hacim, volatilite, seviyeler ve riskler paragraf paragraf
- 🕯️ **Formasyon tespiti** — yutan mumlar, çekiç, kayan yıldız, doji, sabah/akşam yıldızı,
  golden/death cross, MACD kesişimi, RSI uyumsuzluğu, Bollinger sıkışması
- 🎯 **İşlem planı** — ATR ve swing noktalarına göre giriş, zarar durdur, 3 hedef, risk/ödül
- 🧭 **Destek / direnç** — pivot kümeleme ile seviyeler ve dokunuş sayısına göre güç
- 🔦 **Sinyal tarayıcı** — piyasa genelinde tarama, filtreleme ve sıralama
- ⭐ **Takip listesi** — piyasalar arası karışık liste (`kripto:BTCUSDT`, `bist:THYAO.IS`…)
- 📉 **Bağımlılıksız grafikler** — canvas ile mum grafiği (EMA + Bollinger + hacim), RSI ve MACD
- ✨ **Hareketli arayüz** — fareyi izleyen arka plan, kaydırdıkça beliren kartlar, ışık efekti;
  `prefers-reduced-motion` ve dokunmatik cihazlarda kapanır
- 📱 **Ayrı mobil düzen** — dar ekranda tablolar kart listesine dönüşür, çekmece menü ve alt sekme çubuğu

## Diller

Sekiz dil desteklenir: **Türkçe, İngilizce, İspanyolca, Almanca, Fransızca, Rusça, Arapça
(sağdan sola), Çince.** Dil seçimi `dil` çerezinde saklanır.

Arayüz metinleri sekiz dilde de tamdır. **Analiz yorumları yalnızca Türkçe ve İngilizce
yazılmıştır**; diğer altı dilde bu bölüm İngilizceye düşer ve arayüz bunu açıkça belirtir.
Yeni dil eklemek için `lib/i18n/dictionaries/` altına bir sözlük yazıp
`lib/i18n/config.ts` listesine eklemek yeterlidir; eksik anahtarlar önce İngilizceye,
sonra Türkçeye düşer.

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
| `AUTH_SECRET` | ✅ | Oturum çerezlerini imzalar. `openssl rand -base64 32`. **Üretimde tanımlanmazsa giriş çalışmaz** (yedek anahtar yalnızca geliştirmede devreye girer) |
| `DATABASE_URL` | üretimde ✅ | Postgres bağlantı dizesi. Tanımlıysa kullanıcılar veritabanında saklanır; tanımsızsa dosya deposuna düşülür (yalnızca yerel geliştirme). `POSTGRES_URL` de kabul edilir |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | — | Google ile giriş. Boşsa yalnızca e-posta + parola görünür |
| `USERS_FILE` | — | Dosya deposu yolu (varsayılan `data/users.json`, git'e girmez) |
| `PGPOOL_MAX` | — | Postgres havuzundaki en fazla bağlantı (varsayılan 3) |
| `TWELVEDATA_API_KEY` | hisse/emtia için ✅ | ABD borsası, Türkiye borsası ve emtia verisi bu anahtarla gelir. [twelvedata.com](https://twelvedata.com/pricing) ücretsiz katman. Tanımsızsa bu üç piyasa boş kalır; kripto ve dövizler etkilenmez |
| `DEMO_DATA` | — | `1` ise piyasa verisine erişilemediğinde sentetik demo veri üretilir (geliştirme için) |

Eksik yapılandırma sessiz kalmaz: `AUTH_SECRET` yoksa ya da üretimde kalıcı bir
veritabanı tanımlı değilse giriş/kayıt sayfalarında ne yapılması gerektiğini
söyleyen bir uyarı görünür.

Piyasa verisi için **API anahtarı gerekmez**; yalnızca herkese açık uç noktalar okunur,
emir gönderilmez, hesabınıza erişilmez.

## Komutlar

```bash
npm run dev        # geliştirme sunucusu
npm run build      # üretim derlemesi
npm start          # üretim sunucusu
npm test           # piyasa katmanı, dil katmanı, sinyal motoru ve kullanıcı deposu testleri
npm run typecheck  # tsc --noEmit
```

Depo testleri varsayılan olarak dosya arka ucunda çalışır. Aynı testleri gerçek bir
Postgres'e karşı da çalıştırmak için:

```bash
TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres npm test
```

## Dosya yapısı

```
app/
  page.tsx                     tanıtım sayfası (arama kutusu, canlı şerit, piyasa kartları)
  piyasa/[slug]/               herkese açık piyasa sayfaları (dört piyasa)
  giris/, kayit/               giriş ve kayıt sayfaları
  (uye)/                       oturum gerektiren alan
    layout.tsx                 oturum kontrolü + üst menü + alt sekme çubuğu
    panel/                     piyasa özeti, Top 10 AL, güçlü satışlar, piyasa tablosu
    varlik/[market]/[symbol]/  detay: grafik, göstergeler, yorum, plan, seviyeler
    tarayici/                  sinyal tarayıcı (filtre + sıralama)
    takip/                     takip listesi (aramayla ekleme)
    ayarlar/                   tercihler, varsayılan piyasa, dil
  api/
    analyze/                   tek varlık için tam analiz + yorum + grafik serileri
    scan/                      piyasa taraması ya da takip listesi taraması
    markets/                   piyasa fiyat listesi
    search/                    dört piyasada birden arama
    register/, watchlist/, settings/, auth/
lib/
  markets/
    types.ts                   ortak Candle/Instrument tipleri, piyasa kayıtları, mum toplama
    twelvedata.ts              hisse/endeks/emtia/BIST için birincil kaynak (anahtarlı)
    frankfurter.ts             dövizler için anahtarsız kaynak (ECB)
    stooq.ts                   yedek kaynak (CSV, anahtarsız)
    instruments.ts             hisse, endeks, emtia ve döviz listeleri + arama eş anlamlıları
    provider.ts                tek giriş noktası: sembol çözümleme, fiyat, mum, arama
    yahoo.ts                   hisse/emtia/döviz veri istemcisi
    demo.ts                    deterministik sentetik veri (DEMO_DATA)
  binance.ts                   kripto veri istemcisi
  indicators.ts                saf gösterge fonksiyonları
  analysis.ts                  varlıktan bağımsız skor motoru, formasyonlar, seviyeler, plan
  analysis-text.ts             gösterge açıklamalarının dile çevrilmesi
  commentary.ts                yorum üretici (dil sözlüklerinden)
  i18n/                        sekiz dilin sözlükleri, çeviri ve yedek dil zinciri
  next-path.ts                 giriş sonrası dönüş yolunun doğrulanması
  users*.ts, db.ts             kullanıcı deposu (Postgres / dosya) ve şema
  rate-limit.ts                bellek içi istek sınırlayıcı
  format.ts, api-types.ts      dile duyarlı biçimlendirme ve paylaşılan API tipleri
components/
  AssetSearch.tsx              gecikmeli arama kutusu (klavye ile gezinme)
  LanguageSwitcher.tsx         dil seçici
  motion/                      fareyi izleyen arka plan, beliren kartlar, ışık efekti
  MobileMenu.tsx, MobileTabBar.tsx   mobil çekmece ve alt sekme çubuğu
  CandleChart.tsx              canvas mum grafiği
  IndicatorChart.tsx           RSI / MACD panelleri
  ui.tsx                       skor göstergesi, rozetler, varlık ikonları
middleware.ts                  istenen yolu başlığa yazar (giriş sonrası geri dönüş için)
tests/                         node:test birim testleri
```

## Skor motoru nasıl çalışır?

1. Seçilen varlık ve periyot için son **300 mum** çekilir. Sağlayıcı 4 saatlik veri
   sunmuyorsa 4 adet 60 dakikalık mum birleştirilerek üretilir.
2. 16 gösterge hesaplanır. Her biri kendi kuralına göre bir **yön** (−1 … +1) ve bir
   **ağırlık** (0,6 … 1,5) üretir. Örnek: RSI ≤ 30 → +0,85 (aşırı satım, alış lehine);
   EMA 50 < EMA 200 → negatif yön (ana trend aşağı).
3. Skor = Σ(yön × ağırlık) ÷ Σ(ağırlık) × 100 → **−100 … +100**.
4. Eşikler: `≥ +45` GÜÇLÜ AL, `≥ +18` AL, `−18 … +18` BEKLE, `≤ −18` SAT, `≤ −45` GÜÇLÜ SAT.
5. **Güven** (%) skorun büyüklüğü, göstergelerin uyum oranı ve ADX'in trend gücünden üretilir.
6. Zarar durdur, son 12 mumun swing noktası ile 1,5 × ATR'den **daha uzak** olanına göre
   belirlenir; ilk hedef mümkünse en yakın anlamlı direnç/destek, sonraki hedefler 1,618 ve
   2,618 R seviyeleridir.

Motor yalnızca `Candle` dizisi ile çalışır; bir hisseyi, endeksi, altını ve coini
birbirinden ayırt etmez. Piyasaya özgü tek fark yorumdaki uyarılardır: 7/24 açık olmayan
piyasalarda "seans kapalı olabilir" riski eklenir.

## Veri kaynakları

- **Kripto:** borsanın herkese açık spot uç noktaları (mum verisi ve 24 saatlik özet).
  Coğrafi kısıt olan ağlar için birden çok alan adı sırayla denenir.
- **Dövizler (USD/TRY, EUR/USD…):** **Frankfurter** — Avrupa Merkez Bankası günlük
  referans kurları, anahtar gerektirmez. Yalnızca kapanış değeri yayımlandığı için mumlar
  kapanıştan türetilir; gün içi aralığa dayanan göstergeler (ATR, Stokastik, Williams %R)
  burada dar kalır, kapanışa dayananlar (RSI, MACD, EMA, Bollinger) tam çalışır.

- **Hisse, endeks, emtia, BIST:** **Twelve Data** (`TWELVEDATA_API_KEY`). Anahtar
  gerektirmesi bilinçli bir tercih değil, ölçülmüş bir zorunluluk: anahtarsız sağlayıcılar
  çağıranı IP'sine göre değerlendiriyor ve veri merkezi aralıklarını engelliyor. Uygulamanın
  çalıştığı sunucudan yapılan ölçümde Yahoo tüm isteklere **429**, Stooq ise CSV yerine
  **HTML engel sayfası** döndürdü. Anahtarlı sağlayıcı çağıranı anahtarına göre tanıdığı için
  aynı sunucudan sorunsuz yanıt veriyor. Bu ölçümü `/tani` sayfasından kendiniz de
  tekrarlayabilirsiniz.

- **Yedekler:** Twelve Data yanıt vermezse sırayla Stooq ve Yahoo denenir. İkisi de
  engelliyse hata mesajı hangi kaynağın neden düştüğünü söyler.

- **Ücretsiz katmanın kotasıyla yaşamak:** Twelve Data'nın ücretsiz katmanı dakikada
  yaklaşık 8, günde 800 "kredi" verir ve her sembol bir kredi harcar. ABD listesinde 46,
  BIST'te 43 sembol olduğu için hepsini bir anda istemek kotayı ilk saniyede tüketiyor ve
  piyasanın tamamını hataya çeviriyordu. Uygulama bunu üç şekilde çözer:

  1. **Kısa hazır liste:** panel ve piyasa sayfaları her piyasadan yalnızca ilk birkaç
     enstrümanı gösterir (`MARKETS[...].listSize`: ABD 12, BIST 12, döviz/emtia 20). Listede
     olmayan varlıklar kaybolmaz — arama kutusundan bulunur ve açıldığında o an analiz edilir
     (tek sembol = tek kredi). 46 sembollük bir liste kotaya sığmıyordu ve ekran tümüyle boş
     kalıyordu; 12 sembol iki turda dolar.
  2. **Paylaşımlı kredi sayacı:** kredi bütçesi veritabanında, atomik olarak tutulur
     (`piyasa_kota` tablosu, `lib/markets/kota.ts`). Sunucusuz ortamda aynı anda birkaç örnek
     çalışıyor; her biri kendi belleğinde "8 kredim var" diye sayınca sağlayıcıya sınırın katı
     kadar istek gidiyor ve hepsi 429 dönüyordu. Sayaç paylaşılınca toplam sınır aşılmaz.
     Sağlayıcı yine de kotayı reddederse blok da paylaşılır: bir örneğin öğrendiği geri
     çekilmeyi hepsi uygular. Kendi bütçemizin bitmesi ise sağlayıcı hatası sayılmaz, yoksa
     uygulama kendi kendini aç bırakırdı.
  3. **Piyasa başına pay:** tek bir piyasa bütçenin tamamını yiyemez; üç piyasa da her turda
     ilerler ve birkaç dakikada dolar.
  4. **Bütçe:** her dakika yalnızca bütçe kadar YENİ sembol istenir, gerisi bir sonraki tura
     bırakılır (`TWELVEDATA_CREDITS_PER_MIN`). Yarım liste, boş listeden iyidir.
  5. **Tek kredi, iki iş:** liste ayrı bir fiyat isteği atmaz; tam mum serisi çekilir, fiyat
     son iki mumdan türetilir. Aynı kredi hem tabloyu hem grafiği/analizi doldurur.
  6. **Günlük bütçe:** asıl duvar dakikalık değil günlük sınır (800 kredi). Ölçüldü: bir günde
     1508 kredi harcanmış ve site bütün gün boş kalmıştı. Günlük harcama da paylaşımlı sayaçta
     tutulur (`TWELVEDATA_CREDITS_PER_DAY`); sınırın son %15'i yalnızca kullanıcının tıkladığı
     varlıklara ayrılır. Sağlayıcı "günlük kota bitti" derse uygulama bir dakika değil, kotanın
     sıfırlanacağı ana (UTC gece yarısı) kadar susar ve kullanıcıya kalan süreyi söyler.
  7. **Bayat veri, boş sayfadan iyidir:** kota bittiğinde önbellekteki kayıt silinmez. Tazelik
     süresi geçse bile gösterilir ve satırdaki "güncellendi" bilgisi verinin gerçek yaşını
     söyler; böylece kullanıcı yanıltılmadan sayfa dolu kalır.
  8. **Paylaşımlı önbellek:** mumlar Postgres'te (`piyasa_onbellek` tablosu) dört saat
     saklanır. Sunucusuz örnekler birbirinin belleğini görmediği ve soğuk başlangıçta bellek
     silindiği için tek başına bellek içi önbellek kotayı boşa harcıyordu; paylaşımlı
     önbellekle bir ziyaretçinin doldurduğu semboller herkese açık hâle gelir.

  Sonuç: piyasa sayfası ilk açılışta kısmi gelir, panel dakikada bir kendiliğinden tazeler ve
  liste birkaç dakikada tamamlanıp öyle kalır.
- **Demo veri:** `DEMO_DATA=1` iken sağlayıcıya erişilemezse tohumlanmış (deterministik)
  sentetik seriler üretilir ve arayüzde açıkça "demo veri" olarak işaretlenir.

## Piyasa verisi nereden geliyor?

Kripto dışı veriyi web sunucusundan çekmek iki duvara çarpıyordu: anahtarsız
kaynaklar (Yahoo, Stooq) bulut sağlayıcısının IP aralığını engelliyor (ölçüldü:
429 ve CSV yerine HTML engel sayfası), anahtarlı kaynak ise ücretsiz katmanda
günde 800 kredi veriyor ve bir günde bitiyor — 800 sınıra karşı 1508 kredi
harcandığı ve sitenin bütün gün boş kaldığı ölçüldü.

Bu yüzden veri **uygulamanın çalıştığı yerden çekilmiyor**. Günde bir çalışan bir
GitHub Actions işi (`.github/workflows/piyasa-verisi.yml`) veriyi kendi
makinesinden çekip doğrudan paylaşımlı önbelleğe yazıyor (`scripts/besle.ts`).
Site zaten önce oraya baktığı için hiçbir sağlayıcıya gitmiyor: ABD, BIST ve
emtia listelerinin tamamı, taramalar ve analizler **sıfır** sağlayıcı isteğiyle
geliyor — ölçüldü.

**Veri kaynağı çalışıyor mu?** Kurulumdan bağımsız ölçmek için: **Actions → Veri
kaynağı testi → Run workflow**. Veritabanı ya da secret gerektirmez, hiçbir yere
yazmaz; altı sembol çekip sonucu basar. Beslemenin iki ayağı (veriyi alabilmek ve
yazabilmek) böylece ayrı ayrı doğrulanabilir.

**Kurulum (bir kez):**

1. GitHub deposunda **Settings → Secrets and variables → Actions → New repository
   secret** yolundan `DATABASE_URL` adında bir secret ekleyin; değeri Vercel'deki
   Postgres bağlantı dizesinin aynısı olsun.
2. **Actions → Piyasa verisi → Run workflow** ile bir kez elle çalıştırın. Kütükte
   her piyasa için kaç sembolün yazıldığı görünür.

Sonrasında iş her gün 22:20 UTC'de (TSİ 01:20) kendiliğinden çalışır; ABD seansı
kapandıktan sonrasına denk gelir. Bir piyasadan hiç veri gelmezse iş başarısız
sayılır ve GitHub bildirim gönderir — sessizce boş dönen bir besleme, sitenin
günlerce eski veriyle kalması demek olurdu.

**Yedek yol:** besleme çalışmazsa site eski davranışına döner (Twelve Data +
kredi bütçesi + bayat önbellek), yani hiçbir şey görünmez hâle gelmez; yalnızca
liste daha yavaş dolar.

## Arama motoru görünürlüğü (SEO)

- **Her dilin kendi adresi var.** Dil önce yalnızca çerezle seçiliyordu; arama motorları çerez
  göndermediği için Türkçe dışındaki yedi dil arama sonuçlarında hiç yoktu. Artık varsayılan dil
  öneksiz (`/piyasa/kripto`), diğerleri önekli yayımlanır (`/en/piyasa/kripto`) ve her sayfa
  sekiz dilin tamamını `hreflang` ile birbirine bağlar (`x-default` Türkçe'yi gösterir).
- **Kanonik adresler mutlaktır.** `NEXT_PUBLIC_SITE_URL` tanımlıysa o, yoksa Vercel'in ürettiği
  üretim adresi kullanılır. Kendi alan adınızı aldığınızda bu değişkeni tanımlayın — yoksa
  kanonik bağlantılar ve site haritası yanlış alan adını gösterir.
- **`/robots.txt` ve `/sitemap.xml` üretilir.** Site haritasında herkese açık her sayfa, her dilde
  ve dil alternatifleriyle birlikte listelenir. Üye alanı, API uçları, `/tani` ve `/ara` dizine
  girmez; bu sayfalar ayrıca `noindex` etiketi taşır.
- **Yapılandırılmış veri (JSON-LD):** ana sayfada `WebSite` (site içi arama kutusu),
  `Organization` ve `FAQPage`; piyasa sayfalarında `BreadcrumbList`, `ItemList` ve piyasaya özel
  `FAQPage`. SSS içeriği sayfada gösterilen metinle aynı kaynaktan gelir, dolayısıyla arama
  sonucundaki cevap sayfadakinden şaşmaz.
- **Paylaşım görseli** (`/opengraph-image`) çalışma anında üretilir; depoda ikili dosya tutulmaz.
- **Metin içerik:** piyasa sayfalarında tablonun altında o piyasayı anlatan bir bölüm ve üç
  soruluk SSS bulunur. Yalnızca sayı dolu bir tablo, arama motoruna sayfanın neyle ilgili
  olduğunu söylemez.

**Kodun yapamayacağı kısım:** teknik altyapı sıralamanın yalnızca bir ayağıdır. Üst sıralar için
ayrıca kendi alan adı, düzenli yayımlanan içerik ve dış bağlantılar gerekir; bunlar dağıtım
sonrası yapılacak işlerdir.

## Vercel'e kurulum

1. **Postgres bağlayın:** Vercel panelinde proje → **Storage** → **Postgres (Neon)** →
   *Connect*. Bu işlem `DATABASE_URL` değişkenini projeye otomatik ekler. Ayrı bir göç
   (migration) adımı yoktur: `users` tablosu ilk istekte oluşturulur.
2. **`AUTH_SECRET` ekleyin:** Settings → Environment Variables → `AUTH_SECRET` =
   `openssl rand -base64 32` çıktısı. Bu değişken olmadan oturum açma çalışmaz.
3. İsterseniz `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` ekleyip Google girişini açın
   (yönlendirme adresi: `https://SITENIZ/api/auth/callback/google`).
4. Yeniden dağıtın. `DEMO_DATA` **tanımlanmasın** — üretimde gerçek piyasa verisi kullanılır.

Kalıcı diski olan bir platformda (VPS, Railway, Fly.io) çalıştırıyorsanız Postgres zorunlu
değildir; `DATABASE_URL` boş bırakıldığında dosya deposu kullanılır.

## Üretime alırken

- **Kullanıcı deposu:** iki arka uç aynı sözleşmeyi (`UserStore`) uygular —
  `lib/users-postgres.ts` (üretim) ve `lib/users-file.ts` (yerel geliştirme).
  `lib/users.ts` `DATABASE_URL` değişkenine göre aralarında seçim yapar, çağrı noktaları
  hiç değişmez.
- **Eşzamanlılık:** Postgres arka ucunda takip listesi/ayar güncellemeleri
  `select … for update` ile aynı işlem (transaction) içinde yapılır; aynı anda gelen
  istekler birbirinin yazdığını ezmez (testlerle doğrulanır).
- **İstek limiti:** sağlayıcılar IP başına limit uygular. Tarama sayısını yükseltirken
  (`ayarlar` → varlık sayısı) dikkatli olun; yanıtlar bellek içinde önbelleğe alınır ve
  tarama en fazla 6 eşzamanlı istek yapar. Kayıt, analiz ve tarama uç noktalarının kendi
  hız sınırları vardır.
- **Piyasa saatleri:** kripto dışındaki piyasalar seans dışında sabit fiyat döndürür;
  analiz yine çalışır ama yorum bölümünde bu durum uyarı olarak belirtilir.

## Teknoloji

Next.js 15 (App Router) · React 19 · TypeScript · Auth.js (next-auth v5) · Postgres (`pg`) ·
harici çalışma zamanı bağımlılığı olmayan kendi gösterge/grafik/dil kodu.

# Fibonex360 mobil uygulama (iOS + Android)

Bu klasör, yayındaki Fibonex360 sitesini yerel bir uygulama kabuğunda açan
Capacitor projesidir. Site güncellendikçe uygulama da kendiliğinden güncel
kalır; mağazaya yeniden göndermek yalnızca kabuk (ikon, ad, ayar) değişince
gerekir.

| | |
|---|---|
| Paket kimliği | iOS: `com.devrangaziolu.fibonex` (App Store Connect'teki uygulama bu kimlikle açıldı) · Android: `com.fibonex360.app` |
| Uygulama adı | Fibonex360 |
| Açılış adresi | `https://www.fibonex360.com/panel` |
| iOS | iPhone, iOS 15+, yalnızca dikey |
| Android | Android 7+ (API 24), hedef API 36, yalnızca dikey |

## Alan adı

`https://www.fibonex360.com` (çıplak `fibonex360.com` buraya yönlenir).
Adres değişirse şu üç yeri güncelleyin, sonra `npm run esitle`:

- `capacitor.config.ts` → `SITE`
- `www/hata.html` → `ADRES`
- Vercel → Ortam değişkenleri → `NEXT_PUBLIC_SITE_URL`

## Kurulum

```bash
cd mobil
npm install
npm run esitle      # ayarları ve ikonları iOS/Android projelerine kopyalar
```

## Mac olmadan iOS (GitHub Actions)

`.github/workflows/ios-yukle.yml`, uygulamayı GitHub'ın bulut Mac'inde derler,
Apple'ın bulut sertifikasıyla imzalar ve App Store Connect'e (TestFlight)
yükler. Sertifika ya da profil dosyası tutmak gerekmez.

**Bir kerelik hazırlık**

1. **Team ID:** iş akışında hazır (`NM3HFXD52H`); başka bir ekip kullanılacaksa `APPLE_TEAM_ID` secret'ı girin.
2. **API anahtarı:** appstoreconnect.apple.com → Kullanıcılar ve Erişim → Entegrasyonlar →
   App Store Connect API → Ekip Anahtarları → **+**. Ad: `GitHub`, Erişim: **Admin**.
   *Issuer ID* ve *Key ID*'yi not edin, `.p8` dosyasını indirin (yalnızca bir kez indirilebilir).
3. **GitHub Secrets** (depo → Settings → Secrets and variables → Actions → New repository secret):

   | Ad | Değer |
   |---|---|
   | `ASC_KEY_ID` | Key ID |
   | `ASC_ISSUER_ID` | Issuer ID |
   | `ASC_KEY_P8` | `.p8` dosyasının tüm içeriği (BEGIN/END satırları dahil) |

4. İş akışını bir kez çalıştırın: paket kimliğini kaydeder ve App Store Connect'te uygulama
   yoksa durup nasıl oluşturulacağını yazar. Uygulamayı oluşturduktan sonra yeniden çalıştırın.

**Her yüklemede:** Actions → *iOS — App Store'a yükle* → Run workflow → sürüm numarası.
Derleme numarası otomatik artar. 10–30 dakika sonra derleme TestFlight'ta görünür.

## iOS'u Mac'te derlemek (isteğe bağlı)

1. `npm run ios` → Xcode açılır.
2. *Signing & Capabilities* → Team: Apple Developer hesabınız. Bundle ID `com.devrangaziolu.fibonex`.
3. Üst menü: *Product → Archive* → *Distribute App → App Store Connect → Upload*.

## Android'i derleyip göndermek (Android Studio)

1. `npm run android` → Android Studio açılır.
2. *Build → Generate Signed App Bundle* → yeni bir yükleme anahtarı (keystore) oluşturun.
   **Anahtarı ve parolasını kaybetmeyin; depoya koymayın** (`.gitignore` bunu engelliyor).
3. Oluşan `.aab` dosyasını Google Play Console'a yükleyin (geliştirici hesabı tek seferlik 25 $).

## İkonları yeniden üretmek

Kaynak görseller `assets/` klasöründe (1024 px ikon, 2732 px açılış ekranı).
Logoyu değiştirirseniz:

```bash
npm run ikonlar && npm run esitle
```

## Uygulamaya özel davranışlar (sitede)

Site, uygulamanın içinde açıldığını anlar (`components/UygulamaKabugu.tsx`) ve:

- çentik / ana çubuk boşluklarını ayarlar,
- **iOS'ta ücretli plan satın alma düğmelerini gizler**: Apple, dijital
  abonelikte yalnızca kendi uygulama içi satın almasına izin veriyor (kural 3.1.1).
  Uygulama içi satın alma, Apple hesabı açıldıktan sonra bağlanacak,
- Google ile giriş düğmesini gizler (Google, uygulama içi tarayıcıda girişi engelliyor),
- bağlantı yoksa `www/hata.html` ekranını gösterir.

# Fibonex360 mobil uygulama (iOS + Android)

Bu klasör, yayındaki Fibonex360 sitesini yerel bir uygulama kabuğunda açan
Capacitor projesidir. Site güncellendikçe uygulama da kendiliğinden güncel
kalır; mağazaya yeniden göndermek yalnızca kabuk (ikon, ad, ayar) değişince
gerekir.

| | |
|---|---|
| Paket kimliği | `com.fibonex360.app` (iOS ve Android aynı) |
| Uygulama adı | Fibonex360 |
| Açılış adresi | `https://analiz-brown.vercel.app/panel` (alan adı alınınca değişecek) |
| iOS | iPhone, iOS 15+, yalnızca dikey |
| Android | Android 7+ (API 24), hedef API 36, yalnızca dikey |

## Kalan iki adım

1. **Alan adı.** Aldığınızda şu üç yeri yeni adresle güncelleyin, sonra `npm run esitle`:
   - `capacitor.config.ts` → `SITE`
   - `www/hata.html` → `ADRES`
   - Vercel → Ortam değişkenleri → `NEXT_PUBLIC_SITE_URL`
2. **Apple Developer hesabı** (yıllık 99 $). Açıldıktan sonra aşağıdaki "iOS'u derleyip göndermek" adımları.

## Kurulum

```bash
cd mobil
npm install
npm run esitle      # ayarları ve ikonları iOS/Android projelerine kopyalar
```

## iOS'u derleyip göndermek (Mac + Xcode gerekir)

1. `npm run ios` → Xcode açılır.
2. *Signing & Capabilities* → Team: Apple Developer hesabınız. Bundle ID `com.fibonex360.app`.
3. (Apple ile giriş açılacaksa) *+ Capability* → **Sign in with Apple**.
4. Üst menü: *Product → Archive* → *Distribute App → App Store Connect → Upload*.
5. App Store Connect'te uygulamayı oluşturun ve `MAGAZA.md`'deki metinleri yapıştırın.

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

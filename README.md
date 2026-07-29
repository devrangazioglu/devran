# Transivo

Bir PDF'teki veya görüntüdeki **tüm metni** çıkarıp seçtiğiniz dile **gramere uygun** şekilde çeviren web uygulaması. Arayüz, mobil çeviri uygulaması temasıyla tasarlanmıştır: açık gri zemin, beyaz yuvarlak kartlar, siyah hap butonlar ve fıstık yeşili vurgu rengi.

## Özellikler

- 📄 **PDF ve görüntü desteği** — PDF, PNG, JPEG, WebP, GIF (en fazla 20 MB)
- 🗂️ **Dosya olarak çeviri** — belge sayfa sayfa işlenir (ilerleme çubuğuyla) ve düzeni korunmuş, yalnızca metni çevrilmiş bir **PDF/PNG çıktısı** indirilir
- ⚡ **Metin olarak çeviri** — istenirse çeviri canlı akışla düz metin olarak da alınabilir
- 🌐 **Otomatik dil algılama** veya kaynak dili elle seçme; 16 hedef dil
- ✍️ **Gramere uygun çeviri** — kelime kelime değil, hedef dilde doğal ve akıcı metin
- 🕘 **Geçmiş** — çevrilen dosyalar cihazda (IndexedDB) saklanır, Ayarlar'dan tekrar indirilebilir
- 🌍 **Uygulama dili** — arayüz Türkçe/İngilizce
- 👤 **Google ile giriş** (isteğe bağlı) + misafir modu
- 🖱️ Sürükle-bırak ile dosya yükleme

## Kurulum

```bash
npm install
cp .env.example .env
npm run dev
```

`.env` dosyasına iki anahtardan **birini** girin:

| Sağlayıcı | Anahtar | Ücret |
|---|---|---|
| **Google Gemini** (önerilen) | `GEMINI_API_KEY` — [aistudio.google.com/apikey](https://aistudio.google.com/apikey) adresinden **ücretsiz**, kredi kartı gerekmez | Ücretsiz katman |
| Claude | `ANTHROPIC_API_KEY` — [platform.claude.com](https://platform.claude.com) | Kullandıkça öde |

`GEMINI_API_KEY` tanımlıysa Gemini kullanılır; boşsa `ANTHROPIC_API_KEY` ile Claude'a düşer.

Tarayıcıda [http://localhost:3000](http://localhost:3000) adresini açın.

## Kullanım

1. **From / To** alanlarından kaynak ve hedef dili seçin (kaynak için "Auto Detect" kullanılabilir).
2. PDF veya görüntüyü sürükleyip bırakın ya da tıklayarak seçin.
3. **Translate** butonuna basın — çeviri "Activity" bölümünde canlı olarak akar.

## Teknik Detaylar

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- İki model desteği: **Gemini 2.5 Flash** (ücretsiz katman, `GEMINI_MODEL` ile değiştirilebilir) veya **Claude Opus 5**
- PDF'ler ve görüntüler doğrudan modele gönderilir (Gemini: `inlineData`, Claude: `document`/`image` bloğu); ayrı bir OCR adımı gerekmez
- Çeviri, `/api/translate` route handler'ından tarayıcıya **stream** edilir
- API anahtarı yalnızca sunucu tarafında kullanılır, tarayıcıya asla gönderilmez

## Dosya Olarak Çeviri Nasıl Çalışır?

1. PDF, tarayıcıda **pdf.js** ile sayfa sayfa görüntüye çevrilir (görseller doğrudan kullanılır).
2. Her sayfa `/api/translate-page` üzerinden Gemini'ye gönderilir; model her metin **satırını** konum kutusu (bounding box), çevirisi ve rengiyle birlikte döndürür.
3. Tarayıcıda orijinal sayfanın üzerinde yalnızca metin bölgeleri, çevresinden örneklenen zemin rengiyle kapatılır ve çeviri aynı konuma, kutuya sığacak boyutta yazılır.
4. Sayfalar **pdf-lib** ile tek bir PDF'te birleştirilir ve indirme kartı görünür. Görsel girdilerde çıktı PNG olur.

## Google ile Giriş (isteğe bağlı)

1. [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials) adresinden bir **OAuth Client ID** (Web application) oluşturun.
2. Authorized redirect URI olarak `https://SITENIZ/api/auth/callback/google` (yerelde `http://localhost:3000/api/auth/callback/google`) ekleyin.
3. `.env` dosyasına `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` ve `AUTH_SECRET` (`openssl rand -base64 32`) girin.

Bu değişkenler tanımlı değilse uygulama giriş ekranını atlar ve doğrudan misafir modunda açılır. Apple ile giriş (Apple Developer hesabı gerektirir) ve e-posta/şifre üyeliği (veritabanı gerektirir) için altyapı hazırdır, henüz etkin değildir.

## Sınırlar

- Dosya boyutu: 20 MB (istemci tarafında denetlenir)
- Dosya modu, karmaşık/desenli zeminlerde metin kapatma yamalarında iz bırakabilir; düz zeminli belgelerde en iyi sonucu verir
- Metin modunda çok uzun belgelerde çıktı 64K token ile sınırlıdır

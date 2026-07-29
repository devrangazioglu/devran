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

`.env` dosyasına anahtarlardan **birini** girin:

| Sağlayıcı | Anahtar | Ücret | Uzun PDF'ler |
|---|---|---|---|
| **OpenAI** | `OPENAI_API_KEY` — [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | Kullandıkça öde | Yüksek istek limiti |
| **Google Gemini** | `GEMINI_API_KEY` — [aistudio.google.com/apikey](https://aistudio.google.com/apikey), kredi kartı gerekmez | Ücretsiz katman | Günlük istek sınırı düşük |
| Claude | `ANTHROPIC_API_KEY` — [platform.claude.com](https://platform.claude.com) | Kullandıkça öde | Yalnızca metin modu |

Sıra: `OPENAI_API_KEY` → `GEMINI_API_KEY` → `ANTHROPIC_API_KEY`. İkisi birden tanımlıysa OpenAI kullanılır, bir sorun çıkarsa otomatik olarak Gemini'ye düşülür.

Tarayıcıda [http://localhost:3000](http://localhost:3000) adresini açın.

## Kullanım

1. **From / To** alanlarından kaynak ve hedef dili seçin (kaynak için "Auto Detect" kullanılabilir).
2. PDF veya görüntüyü sürükleyip bırakın ya da tıklayarak seçin.
3. **Translate** butonuna basın — çeviri "Activity" bölümünde canlı olarak akar.

## Teknik Detaylar

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- Üç sağlayıcı desteği: **OpenAI** (`OPENAI_MODEL`, varsayılan `gpt-4.1-mini`), **Gemini** (`GEMINI_MODEL`) veya **Claude**. Her sağlayıcının model yedekleme zinciri vardır: bir model kotası dolduğunda ya da erişilemediğinde sıradaki denenir.
- PDF'ler ve görüntüler doğrudan modele gönderilir (OpenAI: `image_url`, Gemini: `inlineData`, Claude: `document`/`image` bloğu); ayrı bir OCR adımı gerekmez
- Çeviri, `/api/translate` route handler'ından tarayıcıya **stream** edilir
- API anahtarı yalnızca sunucu tarafında kullanılır, tarayıcıya asla gönderilmez

## Dosya Olarak Çeviri Nasıl Çalışır?

1. PDF, tarayıcıda **pdf.js** ile sayfa sayfa görüntüye çevrilir (görseller doğrudan kullanılır).
2. Sayfalar `/api/translate-page` üzerinden birkaçı bir arada modele gönderilir; model her metin **satırını** konum kutusu (bounding box), orijinal metni, çevirisi, rengi ve kalınlığıyla birlikte döndürür. Yarım kalan ya da boş dönen sayfalar tek tek yeniden istenir.
3. Tarayıcıda yalnızca metin satırları kapatılır: her satırın soluyla sağı arasındaki zemin satır satır örneklenip aradaki alan bu renklerle doldurulur, böylece düz zeminler kadar degrade ve renkli bloklar da korunur. Çeviri aynı konuma, kutuya sığacak boyutta ve gerekiyorsa kalın olarak yazılır. Çevirisi orijinaliyle aynı olan satırlara (sayılar, özel adlar, adresler) hiç dokunulmaz.
4. Sayfalar **pdf-lib** ile tek bir PDF'te birleştirilir ve indirme kartı görünür. Görsel girdilerde çıktı PNG olur.

## Google ile Giriş (isteğe bağlı)

1. [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials) adresinden bir **OAuth Client ID** (Web application) oluşturun.
2. Authorized redirect URI olarak `https://SITENIZ/api/auth/callback/google` (yerelde `http://localhost:3000/api/auth/callback/google`) ekleyin.
3. `.env` dosyasına `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` ve `AUTH_SECRET` (`openssl rand -base64 32`) girin.

Bu değişkenler tanımlı değilse uygulama giriş ekranını atlar ve doğrudan misafir modunda açılır. Apple ile giriş (Apple Developer hesabı gerektirir) ve e-posta/şifre üyeliği (veritabanı gerektirir) için altyapı hazırdır, henüz etkin değildir.

## Sınırlar

- Dosya boyutu: 20 MB (istemci tarafında denetlenir)
- **Ücretsiz katman kotası:** Gemini'nin ücretsiz katmanı model başına günde sınırlı sayıda istek verir. Bu yüzden sayfalar tek tek değil, istek başına birkaç sayfa halinde gruplanarak gönderilir ve kota dolduğunda sıradaki modele geçilir. Yine de çok sayıda uzun belgeyi aynı gün çevirmek kotayı tüketebilir; kota ertesi gün sıfırlanır.
- Dosya modu, karmaşık/desenli zeminlerde metin kapatma yamalarında iz bırakabilir; düz zeminli belgelerde en iyi sonucu verir
- Metin modunda çok uzun belgelerde çıktı 64K token ile sınırlıdır

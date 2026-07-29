# Transivo

Bir PDF'teki veya görüntüdeki **tüm metni** çıkarıp seçtiğiniz dile **gramere uygun** şekilde çeviren web uygulaması. Arayüz, mobil çeviri uygulaması temasıyla tasarlanmıştır: açık gri zemin, beyaz yuvarlak kartlar, siyah hap butonlar ve fıstık yeşili vurgu rengi.

## Özellikler

- 📄 **PDF ve görüntü desteği** — PDF, PNG, JPEG, WebP, GIF (en fazla 20 MB)
- 🌐 **Otomatik dil algılama** veya kaynak dili elle seçme
- ✍️ **Gramere uygun çeviri** — kelime kelime değil, hedef dilde doğal ve akıcı metin
- 🧾 **Yapı korunur** — başlıklar, paragraflar, listeler ve tablo içerikleri sırasıyla çevrilir
- ⚡ **Canlı akış** — çeviri, üretilirken ekranda kelime kelime belirir
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

## Sınırlar

- Dosya boyutu: 20 MB (istemci tarafında denetlenir)
- Çok uzun belgelerde çıktı 64K token ile sınırlıdır; belge bölünerek çevrilmelidir

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
# .env dosyasına Anthropic API anahtarınızı girin:
# ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```

Tarayıcıda [http://localhost:3000](http://localhost:3000) adresini açın.

## Kullanım

1. **From / To** alanlarından kaynak ve hedef dili seçin (kaynak için "Auto Detect" kullanılabilir).
2. PDF veya görüntüyü sürükleyip bırakın ya da tıklayarak seçin.
3. **Translate** butonuna basın — çeviri "Activity" bölümünde canlı olarak akar.

## Teknik Detaylar

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Claude Opus 5** (`claude-opus-5`) — PDF'ler `document` bloğu, görüntüler `image` bloğu olarak doğrudan modele gönderilir; ayrı bir OCR adımı gerekmez
- Çeviri, `/api/translate` route handler'ından tarayıcıya **stream** edilir
- API anahtarı yalnızca sunucu tarafında kullanılır, tarayıcıya asla gönderilmez

## Sınırlar

- Dosya boyutu: 20 MB (istemci tarafında denetlenir)
- Çok uzun belgelerde çıktı 64K token ile sınırlıdır; belge bölünerek çevrilmelidir

/** Türkçe sözlük — anahtarların kaynağı. Diğer diller bu listeyi izler. */

export const tr = {
  /* ── Genel ────────────────────────────────────────────── */
  "app.tagline": "Teknik analiz ve al–sat sinyalleri",
  "common.loading": "Yükleniyor…",
  "common.refresh": "Yenile",
  "common.search": "Ara",
  "common.searchPlaceholder": "Coin, hisse, döviz veya emtia ara (BTC, AAPL, THYAO, altın…)",
  "common.searchHint": "En az 2 karakter yazın",
  "common.noResults": "Sonuç bulunamadı",
  "common.all": "Tümü",
  "common.details": "Detay",
  "common.analyze": "Analiz",
  "common.price": "Fiyat",
  "common.change": "Değişim",
  "common.change24h": "24s değişim",
  "common.volume": "Hacim",
  "common.high": "En yüksek",
  "common.low": "En düşük",
  "common.updated": "güncellendi",
  "common.demoData": "DEMO VERİ",
  "common.demoNotice":
    "Piyasa verisine ulaşılamadığı için demo veri gösteriliyor. Rakamlar gerçek piyasayı yansıtmaz.",
  "common.error": "Bir hata oluştu",
  "common.pair": "Parite",
  "common.asset": "Varlık",
  "common.signal": "Sinyal",
  "common.score": "Skor",
  "common.confidence": "Güven",
  "common.trend": "Trend",
  "common.pattern": "Formasyon",
  "common.none": "—",
  "common.language": "Dil",
  "common.close": "Kapat",
  "common.openMenu": "Menüyü aç",
  "common.trades": "İşlem",
  "common.indicatorCount": "{count} gösterge",

  /* ── Menü ─────────────────────────────────────────────── */
  "nav.features": "Özellikler",
  "nav.how": "Nasıl çalışır",
  "nav.indicators": "Göstergeler",
  "nav.faq": "SSS",
  "nav.login": "Giriş yap",
  "nav.register": "Ücretsiz başla",
  "nav.panel": "Panel",
  "nav.goPanel": "Panele git",
  "nav.scanner": "Sinyal tarayıcı",
  "nav.watchlist": "Takip listem",
  "nav.settings": "Ayarlar",
  "nav.logout": "Çıkış",
  "nav.markets": "Piyasalar",

  /* ── Piyasalar ────────────────────────────────────────── */
  "market.kripto": "Kripto",
  "market.abd": "Amerikan borsası",
  "market.bist": "Türkiye borsası",
  "market.emtia": "Dövizler ve emtia",
  "market.kripto.desc": "Bitcoin, Ethereum ve yüzlerce altcoin — 7/24",
  "market.abd.desc": "S&P 500, Nasdaq ve en çok işlem gören ABD hisseleri",
  "market.bist.desc": "BIST 100 endeksi ve öne çıkan Borsa İstanbul hisseleri",
  "market.emtia.desc": "Altın, gümüş, petrol, dolar/TL ve büyük pariteler",
  "market.closedNote": "Bu piyasa seans saatleri dışında kapalıdır; son kapanış verisi gösterilir.",

  /* ── Zaman dilimleri ──────────────────────────────────── */
  "interval.1m": "1 dakika",
  "interval.5m": "5 dakika",
  "interval.15m": "15 dakika",
  "interval.30m": "30 dakika",
  "interval.1h": "1 saat",
  "interval.4h": "4 saat",
  "interval.1d": "1 gün",
  "interval.1w": "1 hafta",

  /* ── Sinyaller ────────────────────────────────────────── */
  "signal.STRONG_BUY": "GÜÇLÜ AL",
  "signal.BUY": "AL",
  "signal.WAIT": "BEKLE",
  "signal.SELL": "SAT",
  "signal.STRONG_SELL": "GÜÇLÜ SAT",
  "verdict.BUY": "AL",
  "verdict.SELL": "SAT",
  "verdict.NEUTRAL": "NÖTR",
  "category.trend": "Trend",
  "category.momentum": "Momentum",
  "category.volatility": "Volatilite",
  "category.volume": "Hacim",

  /* ── Ana sayfa ────────────────────────────────────────── */
  "home.badge": "Dört piyasa, tek analiz motoru",
  "home.title": "Analiz et,\nal–sat sinyalini gör",
  "home.lead":
    "Kripto, Amerikan borsası, Borsa İstanbul, döviz ve emtia verisini çekiyoruz; 16 teknik göstergeyi hesaplayıp ağırlıklı bir skora çeviriyoruz ve {signals} sinyali üretiyoruz — üstelik neden öyle olduğunu anlatıyoruz.",
  "home.ctaPrimary": "Ücretsiz hesap aç",
  "home.ctaSecondary": "Nasıl çalışır?",
  "home.disclaimerShort":
    "Bu bir teknik analiz aracıdır. Ürettiği sinyaller yatırım tavsiyesi değildir; kararlarınızın sorumluluğu size aittir.",
  "home.searchTitle": "Ne analiz etmek istiyorsun?",
  "home.searchSub": "Adını ya da sembolünü yaz; dört piyasada birden arıyoruz.",
  "home.marketsTitle": "Dört piyasa, aynı motor",
  "home.marketsSub": "Aynı gösterge seti ve aynı skorlama her piyasada çalışır.",
  "home.highlightsEyebrow": "Piyasadan canlı görünüm",
  "home.highlightsTitle": "Öne çıkanlar",
  "home.highlightsSub": "Hacim, yükseliş ve düşüşe göre seçilen başlıklar — sayfa her dakika güncellenir.",
  "home.highlightsEmpty":
    "Piyasa verisi şu anda alınamadı. Uygulamayı kendi sunucunuzda çalıştırdığınızda bu alan canlı fiyatlarla dolar.",
  "home.whyEyebrow": "Neden bu araç",
  "home.whyTitle": "Grafiği okumak zorunda kalmadan\nteknik analizi görün",
  "home.whyLead":
    "Her gösterge ayrı ayrı hesaplanır, ağırlıklandırılır ve tek bir skorda birleşir. Sonuç sadece bir rozet değil: hangi göstergenin neden o yönde oy verdiğini cümle cümle okuyabilirsiniz.",
  "home.feature.indicators": "16 teknik gösterge",
  "home.feature.indicators.desc": "RSI, MACD, Bollinger, ADX, Supertrend, OBV ve dahası",
  "home.feature.markets": "Dört piyasa",
  "home.feature.markets.desc": "Kripto, ABD borsası, Borsa İstanbul, döviz ve emtia",
  "home.feature.timeframes": "Çoklu zaman dilimi",
  "home.feature.timeframes.desc": "1 dakikadan haftalığa kadar periyotlar ve trend uyumu",
  "home.feature.comment": "Sade dille yorum",
  "home.feature.comment.desc": "Sinyalin gerekçesi, riskleri ve seviyeleri düz metin olarak",
  "home.feature.plan": "İşlem planı",
  "home.feature.plan.desc": "ATR tabanlı zarar durdur, hedefler ve risk/ödül oranı",
  "home.feature.scanner": "Sinyal tarayıcı",
  "home.feature.scanner.desc": "Onlarca varlığı tek seferde tarayıp en güçlü sinyalleri sıralar",
  "home.stat.indicators": "Teknik gösterge",
  "home.stat.markets": "Piyasa",
  "home.stat.timeframes": "Zaman dilimi",
  "home.stat.always": "Canlı piyasa verisi",
  "home.howEyebrow": "Üç adımda sinyal",
  "home.howTitle": "Nasıl çalışır?",
  "home.howSub": "Kara kutu yok: veriden sinyale giden yolun her adımı görünür.",
  "home.how.1": "1. Veri",
  "home.how.1.title": "Piyasa verisi",
  "home.how.1.desc":
    "Seçtiğiniz varlık ve zaman dilimi için son 300 mum (açılış, en yüksek, en düşük, kapanış, hacim) çekilir ve önbelleğe alınır.",
  "home.how.2": "2. Analiz",
  "home.how.2.title": "16 gösterge, ağırlıklı oy",
  "home.how.2.desc":
    "Her gösterge −1 ile +1 arasında bir yön üretir; önem ağırlığıyla çarpılıp toplanır. Sonuç −100 ile +100 arasında tek bir skora dönüşür.",
  "home.how.3": "3. Yorum",
  "home.how.3.title": "Sinyal ve gerekçesi",
  "home.how.3.desc":
    "Skor AL / SAT / BEKLE sinyaline çevrilir; destek-direnç seviyeleri, formasyonlar, riskler ve ATR tabanlı işlem planı yazıya dökülür.",
  "home.indicatorsEyebrow": "Motorun içindekiler",
  "home.indicatorsTitle": "Hesaplanan göstergeler",
  "home.indicatorsSub": "Tümü uygulama içinde, harici bir analiz servisi kullanılmadan hesaplanır.",
  "home.ctaTitle": "Hesabınızı açın, ilk analizinizi bir dakikada alın",
  "home.ctaSub":
    "E-posta ile kayıt olun ya da Google hesabınızla girin; takip listeniz ve tercihleriniz hesabınıza kaydedilsin.",
  "home.faqTitle": "Merak edilenler",
  "home.faqEyebrow": "Sık sorulan sorular",
  "faq.q1": "Bu araç hangi piyasaları kapsıyor?",
  "faq.a1":
    "Kripto pariteleri, Amerikan borsası hisseleri ve endeksleri, Borsa İstanbul hisseleri ve BIST endeksleri, ayrıca altın, gümüş, petrol gibi emtialar ile başlıca döviz pariteleri.",
  "faq.q2": "Sinyaller yatırım tavsiyesi mi?",
  "faq.a2":
    "Hayır. Üretilen çıktı, kural tabanlı bir teknik analiz özetidir. Teknik göstergeler geçmiş fiyat hareketine bakar ve geleceği garanti etmez. Piyasalar risklidir.",
  "faq.q3": "Skor nasıl hesaplanıyor?",
  "faq.a3":
    "Her gösterge kendi kuralına göre −1 (güçlü satış) ile +1 (güçlü alış) arasında bir yön üretir. Bu yönler göstergenin ağırlığıyla çarpılır, toplanır ve toplam ağırlığa bölünerek −100…+100 aralığına ölçeklenir. 45 ve üzeri güçlü al, −45 ve altı güçlü sat sayılır.",
  "faq.q4": "Hangi zaman dilimini seçmeliyim?",
  "faq.a4":
    "Kısa vadeli işlemler için 15 dakika–1 saat, swing işlemler için 4 saat–1 gün yaygın tercihlerdir. Detay sayfasında seçtiğiniz periyodun yanı sıra üst zaman dilimlerinin sinyallerini de görürsünüz; uyum arttıkça sinyal daha güvenilir sayılır.",
  "faq.q5": "Veriler ne sıklıkla güncelleniyor?",
  "faq.a5":
    "Kripto verisi 20 saniyede, hisse ve emtia verisi dakikada bir tazelenir. Panelde Yenile düğmesiyle her an güncelleyebilirsiniz. Borsa seansı kapalıyken son kapanış verisi gösterilir.",
  "footer.legalTitle": "Yasal uyarı:",
  "footer.legal":
    "Bu site bir teknik analiz aracıdır, yatırım danışmanlığı hizmeti değildir. Sitede yer alan sinyaller, skorlar, seviyeler ve yorumlar geçmiş fiyat verisine dayanan otomatik hesaplamalardır ve alım-satım tavsiyesi niteliği taşımaz. Piyasalar yüksek volatiliteye sahiptir; yatırdığınız tutarın tamamını kaybedebilirsiniz. Fiyatlar gecikmeli ya da eksik olabilir.",
  "footer.disclaimerShort":
    "Buradaki sinyaller, skorlar ve seviyeler geçmiş fiyat verisinden otomatik olarak hesaplanır; yatırım tavsiyesi değildir. Fiyatlar gecikmeli olabilir.",

  /* ── Kimlik doğrulama ─────────────────────────────────── */
  "auth.loginTitle": "Tekrar hoş geldiniz",
  "auth.loginSub": "Analiz paneline erişmek için giriş yapın.",
  "auth.registerTitle": "Ücretsiz hesap açın",
  "auth.registerSub": "Takip listeniz ve analiz tercihleriniz hesabınıza kaydedilir.",
  "auth.email": "E-posta",
  "auth.password": "Parola",
  "auth.name": "Ad (isteğe bağlı)",
  "auth.namePlaceholder": "Adınız",
  "auth.passwordPlaceholder": "En az 8 karakter",
  "auth.login": "Giriş yap",
  "auth.loggingIn": "Giriş yapılıyor…",
  "auth.register": "Hesap oluştur",
  "auth.registering": "Hesap oluşturuluyor…",
  "auth.or": "veya",
  "auth.google": "Google ile devam et",
  "auth.googleRegister": "Google ile kayıt ol",
  "auth.noAccount": "Hesabınız yok mu?",
  "auth.registerLink": "Ücretsiz kayıt olun",
  "auth.haveAccount": "Zaten üye misiniz?",
  "auth.loginLink": "Giriş yapın",
  "auth.badCredentials": "E-posta veya parola hatalı.",
  "auth.serverProblem": "Giriş yapılamadı: sunucu tarafında bir sorun oluştu ({code}).",
  "auth.shortPassword": "Parola en az 8 karakter olmalı.",
  "auth.registerFailed": "Kayıt tamamlanamadı.",
  "auth.registerTerms":
    "Kayıt olarak, uygulamanın yatırım tavsiyesi vermediğini ve üretilen sinyallerin yalnızca teknik analiz amaçlı olduğunu kabul etmiş olursunuz.",
  "auth.autoLoginFailed":
    "Hesap oluşturuldu ancak otomatik giriş yapılamadı. Giriş sayfasını deneyin.",
  "auth.networkError": "Sunucuya ulaşılamadı; bağlantınızı kontrol edip tekrar deneyin.",

  /* ── Panel ────────────────────────────────────────────── */
  "panel.greeting": "Merhaba {name}",
  "panel.sub": "Piyasa verisi {time} {updated}.",
  "panel.loadingMarkets": "Piyasa verisi yükleniyor…",
  "panel.topBuyTitle": "En çok AL sinyali verenler — Top 10",
  "panel.topBuySub": "Seçili piyasa ve periyotta en yüksek alış skoruna sahip 10 varlık.",
  "panel.topSellTitle": "En güçlü satış sinyalleri",
  "panel.noBuy": "Bu periyotta alış sinyali veren varlık bulunamadı.",
  "panel.noSell": "Bu periyotta satış sinyali veren varlık bulunamadı.",
  "panel.breadth": "Piyasa genişliği",
  "panel.breadthSub": "yükselen / düşen",
  "panel.totalVolume": "Toplam hacim",
  "panel.marketTable": "Piyasa",
  "panel.marketTableSub": "Analiz için bir satıra tıklayın.",
  "panel.watchlistShortcut": "Takip listem",
  "panel.analyzeAll": "Tümünü analiz et",

  /* ── Tarayıcı ─────────────────────────────────────────── */
  "scan.title": "Sinyal tarayıcı",
  "scan.sub": "{market} piyasasında {count} varlığı {interval} periyodunda tarar, skora göre sıralar.",
  "scan.scanned": "{count} varlık tarandı",
  "scan.rescan": "Yeniden tara",
  "scan.scanning": "Taranıyor…",
  "scan.buyCount": "Alış sinyali",
  "scan.sellCount": "Satış sinyali",
  "scan.waitCount": "Bekle",
  "scan.bias": "Piyasa eğilimi",
  "scan.biasBull": "Alıcı ağırlıklı",
  "scan.biasBear": "Satıcı ağırlıklı",
  "scan.biasMixed": "Kararsız",
  "scan.filterBuy": "Alış",
  "scan.filterSell": "Satış",
  "scan.filterWatch": "Takip listem",
  "scan.sortScore": "Skora göre",
  "scan.sortConfidence": "Güvene göre",
  "scan.sortChange": "Değişime göre",
  "scan.sortVolume": "Hacme göre",
  "scan.sortRsi": "RSI'ye göre",
  "scan.onlyStrong": "Yalnızca güçlü sinyaller",
  "scan.empty": "Bu filtrelerle eşleşen varlık yok.",
  "scan.assetCount": "{count} varlık",
  "scan.footnote":
    "Skorlar seçilen periyottaki son kapanışa göre hesaplanır; mum kapanmadan önce değişebilir.",

  /* ── Takip listesi ────────────────────────────────────── */
  "watch.title": "Takip listem",
  "watch.sub": "Listenizdeki {count} varlık {interval} periyodunda analiz edilir.",
  "watch.add": "Varlık ekle",
  "watch.addPlaceholder": "Ara ve listeye ekle",
  "watch.addButton": "Listeye ekle",
  "watch.remove": "Çıkar",
  "watch.empty":
    "Takip listeniz boş. Bir varlık sayfasında Takibe al diyebilir ya da yukarıdaki aramayı kullanabilirsiniz.",
  "watch.already": "{symbol} zaten listenizde.",
  "watch.follow": "Takibe al",
  "watch.unfollow": "Takipten çıkar",

  /* ── Ayarlar ──────────────────────────────────────────── */
  "settings.title": "Ayarlar",
  "settings.sub": "Analiz tercihlerinizi ve hesap bilgilerinizi yönetin.",
  "settings.prefs": "Analiz tercihleri",
  "settings.defaultInterval": "Varsayılan zaman dilimi",
  "settings.defaultMarket": "Varsayılan piyasa",
  "settings.scanLimit": "Tarayıcıda taranacak varlık sayısı",
  "settings.scanLimitHint": "Daha yüksek sayı daha uzun sürer.",
  "settings.onlyStrong": "Tarayıcıda varsayılan olarak yalnızca güçlü sinyalleri göster",
  "settings.save": "Kaydet",
  "settings.saved": "Ayarlar kaydedildi.",
  "settings.saveFailed": "Ayarlar kaydedilemedi.",
  "settings.account": "Hesap",
  "settings.registeredAt": "Kayıt tarihi",
  "settings.loginMethod": "Giriş yöntemi",
  "settings.loginPassword": "E-posta + parola",
  "settings.loginGoogle": "Google",
  "settings.watchlistCount": "{count} varlık",
  "settings.privacy": "Veri ve gizlilik",
  "settings.privacy.1":
    "Piyasa verisi yalnızca herkese açık uç noktalardan okunur; borsa hesabınıza erişilmez, sizin adınıza emir gönderilmez.",
  "settings.privacy.2":
    "Parolanız scrypt ile, kullanıcıya özel tuzla saklanır; düz metin olarak hiçbir yere yazılmaz.",
  "settings.privacy.3": "Takip listeniz ve tercihleriniz veritabanında tutulur.",

  /* ── Varlık detayı ────────────────────────────────────── */
  "asset.analysisComment": "Analiz yorumu",
  "asset.highlights": "Öne çıkanlar",
  "asset.risks": "Riskler ve uyarılar",
  "asset.plan": "İşlem planı",
  "asset.planLong": "UZUN / ALIŞ",
  "asset.planShort": "KISA / SATIŞ",
  "asset.planAdvisory": "Sinyal BEKLE olduğu için bu plan yalnızca senaryodur.",
  "asset.entry": "Giriş",
  "asset.stopLoss": "Zarar durdur",
  "asset.target": "Hedef {n}",
  "asset.risk": "Risk",
  "asset.riskReward": "Risk / ödül",
  "asset.atr": "ATR (14)",
  "asset.levels": "Destek ve direnç",
  "asset.resistance": "Direnç",
  "asset.support": "Destek",
  "asset.current": "Güncel",
  "asset.noLevels": "Bu veri aralığında belirgin bir pivot seviyesi bulunamadı.",
  "asset.patterns": "Formasyonlar",
  "asset.noPatterns": "Son mumlarda tanımlı bir formasyon tespit edilmedi.",
  "asset.dayStats": "Gün içi",
  "asset.otherTimeframes": "DİĞER PERİYOTLAR",
  "asset.buyVotes": "ALIŞ OYU",
  "asset.sellVotes": "SATIŞ OYU",
  "asset.tally":
    "{buy} gösterge alış, {sell} gösterge satış, {neutral} gösterge nötr yönde. Trend gücü: {trend} · Volatilite: {volatility}",
  "asset.volatilityRegime": "Volatilite rejimi",
  "asset.bandwidth": "Bollinger bant genişliği",
  "asset.squeeze": "Bant sıkışması",
  "asset.squeezeYes": "var (kırılım beklentisi)",
  "asset.squeezeNo": "yok",
  "asset.analysisLangNote":
    "Analiz metinleri şu an yalnızca Türkçe ve İngilizce hazır; bu dilde İngilizce gösteriliyor.",
  "asset.notFound": "Varlık bulunamadı.",
  "asset.backToPanel": "Panele dön",

  /* ── Trend gücü ve volatilite ─────────────────────────── */
  "trend.veryStrong": "çok güçlü",
  "trend.strong": "güçlü",
  "trend.developing": "gelişiyor",
  "trend.weak": "zayıf / yatay",
  "trend.unknown": "belirsiz",
  "vol.low": "düşük",
  "vol.normal": "normal",
  "vol.high": "yüksek",

  /* ── Gösterge adları ──────────────────────────────────── */
  "ind.emaCross": "EMA 9 / EMA 21",
  "ind.ema50200": "EMA 50 / EMA 200",
  "ind.priceEma200": "Fiyat / EMA 200",
  "ind.supertrend": "Supertrend (10, 3)",
  "ind.adx": "ADX / DI",
  "ind.vwap": "VWAP (20)",
  "ind.rsi": "RSI (14)",
  "ind.macd": "MACD (12, 26, 9)",
  "ind.stoch": "Stokastik (14, 3, 3)",
  "ind.cci": "CCI (20)",
  "ind.williams": "Williams %R (14)",
  "ind.roc": "Momentum (ROC 10)",
  "ind.bollinger": "Bollinger %B (20, 2)",
  "ind.obv": "OBV eğimi",
  "ind.mfi": "Para akış endeksi (14)",
  "ind.volume": "Hacim / 20 mum ort.",

  /* ── Gösterge yorumları ───────────────────────────────── */
  "note.emaCross.up":
    "Kısa vadeli ortalama, orta vadelinin %{spread} üzerinde — kısa vadeli yön yukarı.",
  "note.emaCross.down":
    "Kısa vadeli ortalama, orta vadelinin %{spread} altında — kısa vadeli yön aşağı.",
  "note.ema50200.golden":
    "EMA 50, EMA 200'ün üzerinde: ana trend yukarı yönlü (golden cross bölgesi).",
  "note.ema50200.death":
    "EMA 50, EMA 200'ün altında: ana trend aşağı yönlü (death cross bölgesi).",
  "note.priceEma200.above":
    "Fiyat 200 periyotluk ortalamanın üzerinde; uzun vadeli görünüm alıcı tarafında.",
  "note.priceEma200.below":
    "Fiyat 200 periyotluk ortalamanın altında; uzun vadeli görünüm satıcı tarafında.",
  "note.supertrend.up":
    "Supertrend alıcı tarafta; {level} takip eden destek gibi çalışıyor.",
  "note.supertrend.down":
    "Supertrend satıcı tarafta; {level} takip eden direnç gibi çalışıyor.",
  "note.adx.weak": "ADX 20'nin altında: trend zayıf, fiyat yatay bantta sıkışmış olabilir.",
  "note.adx.up": "ADX {adx} ile trend güçlü ve +DI önde: yükseliş trendi hakim.",
  "note.adx.down": "ADX {adx} ile trend güçlü ve -DI önde: düşüş trendi hakim.",
  "note.vwap.above":
    "Fiyat hacim ağırlıklı ortalamanın üzerinde; alıcılar ortalama maliyetin üstünde işlem yapıyor.",
  "note.vwap.below":
    "Fiyat hacim ağırlıklı ortalamanın altında; satıcı baskısı ortalama maliyetin altında.",
  "note.rsi.oversold": "RSI {rsi} ile aşırı satım bölgesinde — tepki alımı ihtimali yüksek.",
  "note.rsi.overbought": "RSI {rsi} ile aşırı alım bölgesinde — kâr satışı riski var.",
  "note.rsi.bull": "RSI {rsi}: momentum alıcı tarafta, aşırı bölge yok.",
  "note.rsi.bear": "RSI {rsi}: momentum satıcı tarafta, aşırı bölge yok.",
  "note.macd.aboveRising":
    "MACD sinyal çizgisinin üzerinde ve histogram genişliyor — alıcı momentum güçleniyor.",
  "note.macd.aboveFalling":
    "MACD sinyal çizgisinin üzerinde ama histogram daralıyor — alıcı momentum zayıflıyor.",
  "note.macd.belowRising":
    "MACD sinyal çizgisinin altında ama histogram daralıyor — satıcı momentum zayıflıyor.",
  "note.macd.belowFalling":
    "MACD sinyal çizgisinin altında ve histogram genişliyor — satıcı momentum güçleniyor.",
  "note.stoch.low": "Stokastik {k} ile dip bölgede; aşırı satım sonrası dönüş aranır.",
  "note.stoch.high": "Stokastik {k} ile tepe bölgede; aşırı alım sonrası dönüş riski var.",
  "note.stoch.mid": "Stokastik {k}: orta bantta, belirgin bir uç yok.",
  "note.cci.high": "CCI +100 üzerinde: güçlü yukarı momentum, ancak aşırı ısınma da olabilir.",
  "note.cci.low": "CCI -100 altında: güçlü aşağı momentum veya aşırı satım.",
  "note.cci.mid": "CCI normal bantta; belirgin bir momentum baskısı yok.",
  "note.williams.oversold": "Williams %R aşırı satım bölgesinde.",
  "note.williams.overbought": "Williams %R aşırı alım bölgesinde.",
  "note.williams.neutral": "Williams %R nötr bölgede.",
  "note.roc.value": "Son 10 mumda fiyat %{roc} değişti.",
  "note.bb.lower": "Fiyat alt Bollinger bandına yapıştı — aşırı satım / tepki bölgesi.",
  "note.bb.upper": "Fiyat üst Bollinger bandını zorluyor — aşırı alım / kâr satışı bölgesi.",
  "note.bb.mid": "Fiyat bantların %{percent} seviyesinde.",
  "note.obv.up": "Bakiye hacim yükseliyor: alımlar satışlardan daha yüksek hacimle geliyor.",
  "note.obv.down": "Bakiye hacim düşüyor: satışlar daha yüksek hacimle geliyor.",
  "note.mfi.low": "Para akışı aşırı satım bölgesinde; para çıkışı tükenmiş olabilir.",
  "note.mfi.high": "Para akışı aşırı alım bölgesinde; giriş hızı sürdürülemez olabilir.",
  "note.mfi.mid": "Para akışı {mfi}: net giriş-çıkış dengeli görünüyor.",
  "note.volume.surge":
    "Hacim ortalamanın {ratio} katı ve mum {direction} — hareket katılımla destekleniyor.",
  "note.volume.normal": "Hacim ortalamaya yakın; hareketin arkasında güçlü bir katılım yok.",
  "note.volume.up": "yeşil",
  "note.volume.down": "kırmızı",

  /* ── Formasyonlar ─────────────────────────────────────── */
  "pattern.bullish-engulfing.name": "Boğa yutan formasyonu",
  "pattern.bullish-engulfing.note":
    "Son mum, önceki kırmızı mumun gövdesini tamamen yuttu — alıcılar kontrolü aldı.",
  "pattern.bearish-engulfing.name": "Ayı yutan formasyonu",
  "pattern.bearish-engulfing.note":
    "Son mum, önceki yeşil mumun gövdesini tamamen yuttu — satıcılar kontrolü aldı.",
  "pattern.hammer.name": "Çekiç",
  "pattern.hammer.note": "Uzun alt fitil: fiyat aşağı sarkıtıldı ama alıcılar geri aldı.",
  "pattern.shooting-star.name": "Kayan yıldız",
  "pattern.shooting-star.note": "Uzun üst fitil: yukarı denemeler satışla karşılandı.",
  "pattern.doji.name": "Doji",
  "pattern.doji.note":
    "Açılış ve kapanış neredeyse aynı — kararsızlık, trend değişimi öncesi görülebilir.",
  "pattern.morning-star.name": "Sabah yıldızı",
  "pattern.morning-star.note": "Üç mumluk dip dönüş formasyonu tamamlandı.",
  "pattern.evening-star.name": "Akşam yıldızı",
  "pattern.evening-star.note": "Üç mumluk tepe dönüş formasyonu tamamlandı.",
  "pattern.golden-cross.name": "Golden cross",
  "pattern.golden-cross.note":
    "EMA 50 yakın zamanda EMA 200'ü yukarı kesti — orta vadeli trend dönüşü.",
  "pattern.death-cross.name": "Death cross",
  "pattern.death-cross.note":
    "EMA 50 yakın zamanda EMA 200'ü aşağı kesti — orta vadeli trend dönüşü.",
  "pattern.macd-cross-up.name": "MACD yukarı kesişim",
  "pattern.macd-cross-up.note": "MACD sinyal çizgisini son mumlarda yukarı kesti.",
  "pattern.macd-cross-down.name": "MACD aşağı kesişim",
  "pattern.macd-cross-down.note": "MACD sinyal çizgisini son mumlarda aşağı kesti.",
  "pattern.bullish-divergence.name": "Pozitif uyumsuzluk",
  "pattern.bullish-divergence.note":
    "Fiyat yeni dip yaparken RSI daha yüksek dip yaptı — düşüş momentumu zayıflıyor.",
  "pattern.bearish-divergence.name": "Negatif uyumsuzluk",
  "pattern.bearish-divergence.note":
    "Fiyat yeni zirve denerken RSI daha düşük zirve yaptı — yükseliş momentumu zayıflıyor.",
  "pattern.bb-squeeze.name": "Bollinger sıkışması",
  "pattern.bb-squeeze.note":
    "Bantlar son 60 mumun en dar seviyesinde — sert bir hareket öncesi enerji birikimi.",

  /* ── Yorum metni ──────────────────────────────────────── */
  "commentary.headline":
    "{asset} {interval} grafiğinde {signal} sinyali veriyor (skor {score}, güven %{confidence}).",
  "commentary.overview":
    "{asset} şu anda {price} {currency} seviyesinde ve son mumda %{change} değişim gösterdi. {interval} zaman diliminde {summary}: {buy} gösterge alış, {sell} gösterge satış, {neutral} gösterge nötr yönde oy kullandı. Ağırlıklı skor {score} (−100 ile +100 arasında) ve modelin bu sinyale güveni %{confidence}.",
  "commentary.summary.STRONG_BUY": "göstergelerin büyük çoğunluğu alış yönünde birleşiyor",
  "commentary.summary.BUY": "göstergeler alış tarafına eğilimli",
  "commentary.summary.WAIT": "göstergeler net bir yön vermiyor",
  "commentary.summary.SELL": "göstergeler satış tarafına eğilimli",
  "commentary.summary.STRONG_SELL": "göstergelerin büyük çoğunluğu satış yönünde birleşiyor",
  "commentary.trend": "Trend tarafında: {parts}.",
  "commentary.trend.emaUp":
    "EMA 50 ({ema50}) EMA 200'ün ({ema200}) üzerinde, yani ana trend yukarı yönlü",
  "commentary.trend.emaDown":
    "EMA 50 ({ema50}) EMA 200'ün ({ema200}) altında, yani ana trend aşağı yönlü",
  "commentary.trend.stUp":
    "Supertrend alış tarafında ve {level} seviyesini takip eden destek olarak kullanıyor",
  "commentary.trend.stDown":
    "Supertrend satış tarafında ve {level} seviyesi takip eden direnç görevi görüyor",
  "commentary.trend.adx": "ADX {adx} ile trendin gücü “{label}”",
  "commentary.momentum": "Momentum tarafında: {parts}.",
  "commentary.momentum.rsiOverbought":
    "RSI {rsi} ile aşırı alım bölgesinde — yükseliş sürse bile geri çekilme riski artıyor",
  "commentary.momentum.rsiOversold":
    "RSI {rsi} ile aşırı satım bölgesinde — tepki alımları için zemin oluşuyor",
  "commentary.momentum.rsiBull": "RSI {rsi} ile orta bandın üzerinde, alıcılar hafif önde",
  "commentary.momentum.rsiBear": "RSI {rsi} ile orta bandın altında, satıcılar hafif önde",
  "commentary.momentum.macdUp": "MACD sinyal çizgisinin üzerinde seyrediyor (pozitif momentum)",
  "commentary.momentum.macdDown": "MACD sinyal çizgisinin altında seyrediyor (negatif momentum)",
  "commentary.momentum.stoch": "Stokastik %K {k} seviyesinde",
  "commentary.volatility":
    "Volatilite {regime} seviyede: ATR, fiyatın %{atrPercent} kadarı; yani {interval} bir mumda ortalama {atr} {currency} hareket bekleniyor.",
  "commentary.volatility.squeeze":
    " Bollinger bantları son 60 mumun en dar aralığında; sıkışma sonrası sert bir yön hareketi görülebilir.",
  "commentary.levels":
    "En yakın destek {support} (%{supportDistance} aşağıda, {supportTouches} dokunuşla test edilmiş), en yakın direnç {resistance} (%{resistanceDistance} yukarıda, {resistanceTouches} dokunuş). Bu seviyelerin kapanış bazında kırılması, mevcut sinyali doğrulayan ya da geçersiz kılan ilk teknik referans olur.",
  "commentary.levels.supportOnly":
    "En yakın destek {support} (%{supportDistance} aşağıda, {supportTouches} dokunuş). Yukarıda belirgin bir pivot direnci görünmüyor.",
  "commentary.levels.resistanceOnly":
    "En yakın direnç {resistance} (%{resistanceDistance} yukarıda, {resistanceTouches} dokunuş). Aşağıda belirgin bir pivot desteği görünmüyor.",
  "commentary.plan":
    "Skorun yönüne göre {side} senaryosunda giriş {entry}, zarar durdur {stop} (%{riskPercent} risk) ve ilk hedef {target} olarak hesaplanıyor; bu, yaklaşık {rr}:1 risk/ödül oranına karşılık geliyor. Zarar durdur seviyesi son 12 mumun swing noktası ile 1,5×ATR'den daha uzak olanına göre belirlendi.",
  "commentary.plan.advisory":
    "Sinyal BEKLE olduğu için aşağıdaki plan yalnızca senaryo niteliğindedir; net bir tetikleyici oluşana kadar pozisyon almamak da bir tercihtir. ",
  "commentary.plan.long": "uzun (alış)",
  "commentary.plan.short": "kısa (satış)",

  /* ── Riskler ──────────────────────────────────────────── */
  "risk.weakTrend":
    "ADX 20'nin altında: trend zayıf, yatay piyasada kesişim sinyalleri sık yanıltır.",
  "risk.lowConfidence": "Göstergeler arasında uyum düşük; sinyalin kalıcılığı sınırlı olabilir.",
  "risk.overboughtBuy": "Alış sinyali aşırı alım bölgesinde üretildi; geç giriş riski var.",
  "risk.oversoldSell": "Satış sinyali aşırı satım bölgesinde üretildi; sert tepki yükselişi gelebilir.",
  "risk.highVolatility":
    "Volatilite yüksek (ATR %{atrPercent}); pozisyon boyutu küçültülmeli ve stop mesafesi buna göre ayarlanmalı.",
  "risk.conflictingPattern": "{pattern} formasyonu genel sinyalin tersi yönde uyarı veriyor.",
  "risk.demoData":
    "Bu analiz DEMO veriyle üretildi (piyasa verisine ulaşılamadı); rakamlar gerçek piyasayı yansıtmaz.",
  "risk.closedMarket":
    "Bu piyasa şu an kapalı olabilir; son kapanış verisiyle üretilen sinyal seans açılışında değişebilir.",
  "risk.none":
    "Belirgin bir teknik çelişki tespit edilmedi; yine de risk yönetimi olmadan işlem açmayın.",
} as const;

export type DictionaryKey = keyof typeof tr;
export type Dictionary = Record<DictionaryKey, string>;

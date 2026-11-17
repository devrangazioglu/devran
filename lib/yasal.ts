/**
 * Yasal metinler: gizlilik politikası, kullanım koşulları ve destek SSS'si.
 *
 * App Store ve Google Play, uygulama kaydında bir gizlilik politikası ve
 * destek adresi ister; uygulama içinden hesap silme de zorunludur. Metinler
 * sözlükte değil burada, çünkü uzunlar ve paragraf yapıları var; arayüz
 * sözlüğü kısa etiketler için.
 *
 * Türkçe ve İngilizce yazıldı; diğer diller İngilizceye düşer (sözlükteki
 * yedek zinciriyle aynı kural).
 *
 * Kimlik bilgileri ortam değişkeninden gelir, çünkü alan adı ve şirket
 * bilgisi henüz kesinleşmedi:
 *   YASAL_UNVAN      — veri sorumlusunun adı/unvanı (şahıs ya da şirket)
 *   YASAL_ADRES      — tebligat adresi (isteğe bağlı)
 *   DESTEK_EPOSTA    — destek ve KVKK başvuruları için e-posta
 *
 * ÖNEMLİ: Bu metinler bir başlangıç şablonudur. Yayın öncesinde bir hukukçuya
 * okutun; özellikle sermaye piyasası mevzuatı (SPK) açısından "yatırım
 * danışmanlığı" sayılmamak için kullanım koşullarındaki uyarılar önemli.
 */

import type { Locale } from "./i18n";

export type YasalBolum = { baslik: string; paragraflar: string[] };

export type YasalBelge = {
  baslik: string;
  ozet: string;
  guncelleme: string;
  bolumler: YasalBolum[];
};

/** Metinlerin son güncellendiği tarih (ISO). Metin değişince güncelleyin. */
export const YASAL_GUNCELLEME = "2026-11-17";

export type YasalKimlik = { unvan: string; eposta: string | null; adres: string | null };

export function yasalKimlik(): YasalKimlik {
  return {
    unvan: process.env.YASAL_UNVAN?.trim() || "Fibonex360",
    eposta: process.env.DESTEK_EPOSTA?.trim() || null,
    adres: process.env.YASAL_ADRES?.trim() || null,
  };
}

type Dil = "tr" | "en";
const dil = (locale: Locale): Dil => (locale === "tr" ? "tr" : "en");

function iletisim(k: YasalKimlik, d: Dil): string {
  if (k.eposta) {
    return d === "tr"
      ? `Bize ${k.eposta} adresinden ulaşabilirsiniz.`
      : `You can reach us at ${k.eposta}.`;
  }
  return d === "tr"
    ? "Bize uygulamadaki Destek sayfasından ulaşabilirsiniz."
    : "You can reach us through the Support page in the app.";
}

/* ────────────────────────── Gizlilik politikası ────────────────────────── */

export function gizlilikPolitikasi(locale: Locale, k = yasalKimlik()): YasalBelge {
  const d = dil(locale);
  const adres = k.adres ? (d === "tr" ? ` Adres: ${k.adres}.` : ` Address: ${k.adres}.`) : "";

  if (d === "tr") {
    return {
      baslik: "Gizlilik Politikası ve KVKK Aydınlatma Metni",
      ozet:
        "Kısaca: yalnızca hesabınızı çalıştırmak için gereken bilgileri tutarız, reklam için izleme yapmayız, verinizi satmayız ve hesabınızı istediğiniz an uygulamanın içinden silebilirsiniz.",
      guncelleme: YASAL_GUNCELLEME,
      bolumler: [
        {
          baslik: "1. Veri sorumlusu",
          paragraflar: [
            `6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında veri sorumlusu ${k.unvan}'dir.${adres} ${iletisim(k, d)}`,
          ],
        },
        {
          baslik: "2. Hangi verileri topluyoruz",
          paragraflar: [
            "Hesap bilgileri: e-posta adresiniz, isteğe bağlı olarak adınız ve parolanızın geri döndürülemez özeti (scrypt). Parolanızın kendisi hiçbir yerde saklanmaz.",
            "Google veya Apple ile girişte: sağlayıcının bize ilettiği e-posta adresi ve ad. Apple'ın “e-postamı gizle” seçeneğini kullanırsanız yalnızca Apple'ın verdiği yönlendirme adresini görürüz.",
            "Uygulama kullanımı: takip listeniz, ayarlarınız (varsayılan piyasa, zaman dilimi, dil), planınız ve aylık analiz kredisi sayacınız.",
            "Teknik veriler: oturumunuzu açık tutan çerez ve dil tercihinizi hatırlayan çerez. Kötüye kullanımı önlemek için istek sayısı kısa süreli olarak IP adresine göre sınırlanır; IP adresleri kalıcı olarak saklanmaz.",
            "Toplamadıklarımız: konumunuz, rehberiniz, fotoğraflarınız, borsa veya banka hesaplarınız. Uygulama hiçbir borsa hesabına bağlanmaz ve sizin adınıza emir göndermez.",
          ],
        },
        {
          baslik: "3. Verileri hangi amaçla ve hangi hukuki sebeple işliyoruz",
          paragraflar: [
            "Hesabınızı oluşturmak ve oturum açmanızı sağlamak, takip listenizi ve ayarlarınızı saklamak, planınızı ve kredi hakkınızı yönetmek (KVKK m.5/2-c: sözleşmenin kurulması ve ifası).",
            "Hizmetin güvenliğini sağlamak, kötüye kullanımı ve aşırı yüklenmeyi önlemek (KVKK m.5/2-f: meşru menfaat).",
            "Yasal yükümlülüklerimizi yerine getirmek (KVKK m.5/2-ç).",
            "Verilerinizi reklam, profil çıkarma veya üçüncü taraf izleme amacıyla kullanmayız ve satmayız.",
          ],
        },
        {
          baslik: "4. Verilerin aktarıldığı taraflar",
          paragraflar: [
            "Hizmeti çalıştırmak için yalnızca altyapı sağlayıcılarıyla çalışırız: barındırma (Vercel Inc.), veritabanı (Neon Inc.) ve giriş seçeneğini kullanırsanız Google LLC veya Apple Inc. Bu sağlayıcıların sunucuları yurt dışında (ağırlıklı olarak ABD ve AB) bulunabilir; aktarım KVKK m.9 kapsamında hizmetin ifası için zorunlu olduğu ölçüde yapılır.",
            "Piyasa fiyatlarını aldığımız veri kaynaklarına kişisel veriniz gönderilmez; bu isteklerde yalnızca sembol adı bulunur.",
            "Yasal olarak zorunlu tutulduğumuzda yetkili kamu kurumlarıyla paylaşabiliriz.",
          ],
        },
        {
          baslik: "5. Saklama süresi",
          paragraflar: [
            "Hesap verileriniz hesabınız açık kaldığı sürece saklanır. Hesabınızı Ayarlar → Hesabı sil adımıyla sildiğinizde kaydınız, takip listeniz, ayarlarınız ve kredi geçmişiniz derhal ve geri dönüşsüz olarak silinir. Yedeklerdeki kopyalar en geç 30 gün içinde döngüyle silinir.",
          ],
        },
        {
          baslik: "6. Haklarınız",
          paragraflar: [
            "KVKK m.11 uyarınca verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, amacına uygun kullanılıp kullanılmadığını öğrenme, aktarıldığı tarafları bilme, düzeltilmesini veya silinmesini isteme, itiraz etme ve zararın giderilmesini talep etme haklarına sahipsiniz. Avrupa Birliği'ndeyseniz GDPR kapsamındaki erişim, taşınabilirlik ve itiraz haklarınız da geçerlidir.",
            `Başvurularınızı yanıtlarız; en geç 30 gün içinde dönüş yapılır. ${iletisim(k, d)}`,
          ],
        },
        {
          baslik: "7. Çerezler",
          paragraflar: [
            "Yalnızca zorunlu çerezler kullanılır: oturum çerezi (giriş yapmış kalmanız için) ve dil çerezi. Reklam veya analiz çerezi kullanılmaz; bu yüzden ayrıca çerez onayı istenmez.",
          ],
        },
        {
          baslik: "8. Çocuklar",
          paragraflar: [
            "Hizmet 18 yaşından küçükler için tasarlanmamıştır ve bilerek 18 yaş altı kullanıcılardan veri toplamayız.",
          ],
        },
        {
          baslik: "9. Değişiklikler",
          paragraflar: [
            "Bu metni güncellediğimizde sayfanın başındaki tarihi değiştiririz. Önemli değişiklikleri uygulama içinde ayrıca duyururuz.",
          ],
        },
      ],
    };
  }

  return {
    baslik: "Privacy Policy",
    ozet:
      "In short: we keep only what is needed to run your account, we do not track you for advertising, we never sell your data and you can delete your account from inside the app at any time.",
    guncelleme: YASAL_GUNCELLEME,
    bolumler: [
      {
        baslik: "1. Data controller",
        paragraflar: [`The data controller is ${k.unvan}.${adres} ${iletisim(k, d)}`],
      },
      {
        baslik: "2. What we collect",
        paragraflar: [
          "Account data: your email address, optionally your name, and an irreversible hash of your password (scrypt). Your password itself is never stored.",
          "Sign in with Google or Apple: the email address and name the provider shares with us. If you use Apple's “Hide My Email”, we only see the relay address Apple provides.",
          "App usage: your watchlist, settings (default market, timeframe, language), your plan and your monthly analysis credit counter.",
          "Technical data: a cookie that keeps you signed in and a cookie that remembers your language. To prevent abuse, request rates are briefly limited per IP address; IP addresses are not stored permanently.",
          "We do not collect your location, contacts, photos, or any brokerage or bank account. The app never connects to a brokerage account and never places orders on your behalf.",
        ],
      },
      {
        baslik: "3. Why we process it",
        paragraflar: [
          "To create your account and sign you in, store your watchlist and settings, and manage your plan and credits (performance of a contract).",
          "To keep the service secure and prevent abuse and overload (legitimate interest).",
          "To comply with legal obligations.",
          "We do not use your data for advertising, profiling or third-party tracking, and we never sell it.",
        ],
      },
      {
        baslik: "4. Who we share it with",
        paragraflar: [
          "Only infrastructure providers needed to run the service: hosting (Vercel Inc.), database (Neon Inc.) and, if you use them, Google LLC or Apple Inc. for sign-in. Their servers may be located outside your country (mainly the US and the EU).",
          "No personal data is sent to the market data sources we use; those requests contain only a ticker symbol.",
          "We may disclose data to public authorities when legally required.",
        ],
      },
      {
        baslik: "5. Retention",
        paragraflar: [
          "Account data is kept while your account is open. When you delete your account (Settings → Delete account), your record, watchlist, settings and credit history are deleted immediately and irreversibly. Copies in backups are rotated out within 30 days.",
        ],
      },
      {
        baslik: "6. Your rights",
        paragraflar: [
          "You can ask to access, correct, export or delete your data, and object to processing. Residents of the EU/EEA have the rights granted by the GDPR; residents of Türkiye have the rights granted by the KVKK (Law No. 6698).",
          `We respond within 30 days. ${iletisim(k, d)}`,
        ],
      },
      {
        baslik: "7. Cookies",
        paragraflar: [
          "We only use strictly necessary cookies: a session cookie and a language cookie. No advertising or analytics cookies are used.",
        ],
      },
      {
        baslik: "8. Children",
        paragraflar: [
          "The service is not intended for anyone under 18 and we do not knowingly collect data from minors.",
        ],
      },
      {
        baslik: "9. Changes",
        paragraflar: [
          "When we update this policy we change the date at the top. Material changes are also announced in the app.",
        ],
      },
    ],
  };
}

/* ────────────────────────── Kullanım koşulları ────────────────────────── */

export function kullanimKosullari(locale: Locale, k = yasalKimlik()): YasalBelge {
  const d = dil(locale);

  if (d === "tr") {
    return {
      baslik: "Kullanım Koşulları",
      ozet:
        "Fibonex360 bir teknik analiz aracıdır; yatırım danışmanlığı değildir. Sinyaller geçmiş fiyatlardan otomatik hesaplanır ve kâr garantisi vermez. Yatırım kararlarınızın sorumluluğu size aittir.",
      guncelleme: YASAL_GUNCELLEME,
      bolumler: [
        {
          baslik: "1. Taraflar ve kabul",
          paragraflar: [
            `Bu koşullar, ${k.unvan} tarafından sunulan Fibonex360 web sitesi ve mobil uygulamasının (“Hizmet”) kullanımını düzenler. Hesap oluşturarak veya Hizmet'i kullanarak bu koşulları ve Gizlilik Politikası'nı kabul etmiş olursunuz.`,
          ],
        },
        {
          baslik: "2. Yatırım tavsiyesi değildir",
          paragraflar: [
            "Hizmet'teki AL / SAT / BEKLE sinyalleri, skorlar, hedef ve destek/direnç seviyeleri, olasılıklar ve yorumlar; geçmiş fiyat ve hacim verisine uygulanan matematiksel göstergelerden yazılım tarafından otomatik ve herkes için aynı şekilde üretilir. Kişisel mali durumunuz, risk tercihiniz veya yatırım amacınız dikkate alınmaz.",
            "Bu içerikler 6362 sayılı Sermaye Piyasası Kanunu ve ilgili mevzuat kapsamında yatırım danışmanlığı veya yatırım tavsiyesi değildir. Yatırım danışmanlığı hizmeti; aracı kurumlar, portföy yönetim şirketleri ve yetkili kuruluşlarla imzalanacak sözleşme çerçevesinde sunulur.",
            "Geçmiş performans gelecekteki sonuçların göstergesi değildir. Kaldıraçlı ürünler ve kripto varlıklar yüksek risk taşır; yatırdığınız paranın tamamını kaybedebilirsiniz. Karar vermeden önce kendi araştırmanızı yapın ve gerekirse yetkili bir danışmana başvurun.",
          ],
        },
        {
          baslik: "3. Veri doğruluğu",
          paragraflar: [
            "Fiyatlar herkese açık üçüncü taraf kaynaklardan alınır. Bazı piyasalar borsanın kuralı gereği 10–20 dakika gecikmelidir; gecikmeli olanlar arayüzde belirtilir. Veriler kesintiye uğrayabilir, eksik veya hatalı olabilir. Fiyatın gerçek zamanlı ve doğru olduğunu garanti etmeyiz.",
          ],
        },
        {
          baslik: "4. Hesap",
          paragraflar: [
            "Hizmet'i kullanmak için 18 yaşından büyük olmalısınız. Hesap bilgilerinizin doğruluğundan ve parolanızın gizliliğinden siz sorumlusunuz. Hesabınızı dilediğiniz an Ayarlar → Hesabı sil adımıyla kapatabilirsiniz.",
          ],
        },
        {
          baslik: "5. Planlar, krediler ve ödemeler",
          paragraflar: [
            "Ücretsiz planda aylık sınırlı sayıda analiz kredisi bulunur. Ücretli planlar daha fazla kredi, tarama ve takip hakkı verir. Krediler her dönem yenilenir ve devretmez.",
            "Mobil uygulamada satın alınan abonelikler Apple App Store veya Google Play üzerinden tahsil edilir; yenileme, iptal ve iade bu mağazaların kurallarına tabidir ve mağaza hesabınızın abonelik ayarlarından yönetilir. Abonelik, dönem sonundan en az 24 saat önce iptal edilmezse otomatik yenilenir.",
            "Fiyat değişiklikleri yürürlüğe girmeden önce duyurulur ve mevcut dönemi etkilemez.",
          ],
        },
        {
          baslik: "6. Kabul edilemez kullanım",
          paragraflar: [
            "Hizmet'i otomatik araçlarla toplu veri çekmek, sinyalleri ticari olarak yeniden yayımlamak veya satmak, sistemin güvenliğini aşmaya çalışmak, başkasının hesabını kullanmak ve yasalara aykırı amaçlarla kullanmak yasaktır. Bu durumlarda hesabı askıya alma veya kapatma hakkımız saklıdır.",
          ],
        },
        {
          baslik: "7. Fikri mülkiyet",
          paragraflar: [
            "Hizmet'in yazılımı, tasarımı, analiz yöntemleri ve metinleri bize aittir. Size Hizmet'i kişisel ve ticari olmayan amaçla kullanmanız için devredilemez ve sınırlı bir kullanım hakkı verilir.",
          ],
        },
        {
          baslik: "8. Sorumluluğun sınırlandırılması",
          paragraflar: [
            "Hizmet “olduğu gibi” sunulur. Yürürlükteki mevzuatın izin verdiği ölçüde; Hizmet'teki bilgilere dayanarak verilen yatırım kararlarından, veri gecikmesi veya hatasından, hizmet kesintisinden doğan doğrudan veya dolaylı zararlardan sorumlu değiliz. Tüketici mevzuatından doğan haklarınız saklıdır.",
          ],
        },
        {
          baslik: "9. Değişiklik ve fesih",
          paragraflar: [
            "Bu koşulları güncelleyebiliriz; güncel metin bu sayfada yayımlanır ve önemli değişiklikler uygulama içinde duyurulur. Hizmet'i kullanmaya devam etmeniz güncel koşulları kabul ettiğiniz anlamına gelir.",
          ],
        },
        {
          baslik: "10. Uygulanacak hukuk",
          paragraflar: [
            `Bu koşullar Türkiye Cumhuriyeti hukukuna tabidir. Tüketici işlemlerinde tüketici hakem heyetleri ve tüketici mahkemeleri yetkilidir. ${iletisim(k, d)}`,
          ],
        },
      ],
    };
  }

  return {
    baslik: "Terms of Use",
    ozet:
      "Fibonex360 is a technical analysis tool, not investment advice. Signals are calculated automatically from past prices and do not guarantee profit. You are responsible for your own investment decisions.",
    guncelleme: YASAL_GUNCELLEME,
    bolumler: [
      {
        baslik: "1. Agreement",
        paragraflar: [
          `These terms govern your use of the Fibonex360 website and mobile app (the “Service”) provided by ${k.unvan}. By creating an account or using the Service you accept these terms and the Privacy Policy.`,
        ],
      },
      {
        baslik: "2. Not investment advice",
        paragraflar: [
          "BUY / SELL / HOLD signals, scores, targets, support and resistance levels, probabilities and commentary in the Service are generated automatically by software from historical price and volume data, identically for every user. Your personal financial situation, risk tolerance and objectives are not taken into account.",
          "Nothing in the Service is investment advice or a recommendation to buy or sell any instrument. Past performance does not indicate future results. Leveraged products and crypto assets are high risk and you may lose all of your capital. Do your own research and consult a licensed adviser if needed.",
        ],
      },
      {
        baslik: "3. Data accuracy",
        paragraflar: [
          "Prices come from public third-party sources. Some markets are delayed by 10–20 minutes under exchange rules; delayed markets are labelled in the app. Data may be interrupted, incomplete or wrong, and we do not guarantee it is real-time or accurate.",
        ],
      },
      {
        baslik: "4. Account",
        paragraflar: [
          "You must be at least 18 to use the Service. You are responsible for the accuracy of your account details and for keeping your password secret. You can close your account at any time under Settings → Delete account.",
        ],
      },
      {
        baslik: "5. Plans, credits and payments",
        paragraflar: [
          "The free plan includes a limited number of analysis credits per month. Paid plans give more credits, scans and watchlist slots. Credits renew every period and do not roll over.",
          "Subscriptions bought in the mobile app are charged through the Apple App Store or Google Play; renewal, cancellation and refunds follow the store's rules and are managed in your store account's subscription settings. A subscription renews automatically unless cancelled at least 24 hours before the end of the current period.",
          "Price changes are announced before they take effect and do not affect the current period.",
        ],
      },
      {
        baslik: "6. Acceptable use",
        paragraflar: [
          "You may not scrape the Service with automated tools, republish or sell its signals commercially, attempt to breach its security, use someone else's account, or use it for unlawful purposes. We may suspend or close accounts that do.",
        ],
      },
      {
        baslik: "7. Intellectual property",
        paragraflar: [
          "The software, design, analysis methods and texts of the Service belong to us. You receive a limited, non-transferable right to use the Service for personal, non-commercial purposes.",
        ],
      },
      {
        baslik: "8. Limitation of liability",
        paragraflar: [
          "The Service is provided “as is”. To the extent permitted by law, we are not liable for losses arising from investment decisions based on the Service, data delays or errors, or service interruptions. Your statutory consumer rights are not affected.",
        ],
      },
      {
        baslik: "9. Changes and termination",
        paragraflar: [
          "We may update these terms; the current version is published on this page and material changes are announced in the app. Continuing to use the Service means you accept the updated terms.",
        ],
      },
      {
        baslik: "10. Governing law",
        paragraflar: [
          `These terms are governed by the laws of the Republic of Türkiye, without prejudice to mandatory consumer protection rules of your country of residence. ${iletisim(k, d)}`,
        ],
      },
    ],
  };
}

/* ────────────────────────── Destek SSS ────────────────────────── */

export type SssMaddesi = { soru: string; cevap: string };

export function destekSss(locale: Locale): SssMaddesi[] {
  if (dil(locale) === "tr") {
    return [
      {
        soru: "Sinyaller nasıl hesaplanıyor?",
        cevap:
          "Her varlık için trend, momentum, hacim, oynaklık ve yapı gruplarından 20'den fazla teknik gösterge hesaplanır; bunlar tek bir skorda birleştirilir. Skor yeterince güçlüyse AL veya SAT, değilse BEKLE çıkar. Kişiye özel değildir, herkes aynı sonucu görür.",
      },
      {
        soru: "Sinyaller ne kadar isabetli?",
        cevap:
          "Bunu saklamıyoruz: Doğruluk sayfasında her gün kaydedilen sinyallerin 10 işlem günü sonraki gerçek sonucu herkese açık olarak yayımlanır. Hiçbir sinyal kesin değildir; yatırım tavsiyesi değildir.",
      },
      {
        soru: "Fiyatlar canlı mı?",
        cevap:
          "Kripto, ABD hisseleri, döviz, büyük endeksler ve ana emtialar canlıdır ve “canlı” işaretiyle gösterilir. Borsa İstanbul ve bazı dünya borsaları borsa kuralı gereği 15–20 dakika gecikmelidir; bu piyasaların sayfasında gecikme yazılıdır.",
      },
      {
        soru: "Kredi nedir, ne zaman yenilenir?",
        cevap:
          "Bir varlığın ayrıntılı analizini açmak 1 kredi, sinyal tarayıcıyı bir kez çalıştırmak 1 kredi harcar. Aynı analizi 30 dakika içinde yeniden açmak ücretsizdir. Krediler planınızın dönemi dolunca yenilenir; kalan sayıyı Aboneliğim sayfasında görürsünüz.",
      },
      {
        soru: "Aboneliğimi nasıl iptal ederim?",
        cevap:
          "Uygulamadan aldıysanız: iPhone'da Ayarlar → adınız → Abonelikler, Android'de Google Play → Ödemeler ve abonelikler. Dönem sonuna kadar planınız açık kalır, sonra ücretsiz plana dönersiniz.",
      },
      {
        soru: "Hesabımı nasıl silerim?",
        cevap:
          "Ayarlar → Hesap → Hesabı sil. Kaydınız, takip listeniz ve ayarlarınız derhal ve geri dönüşsüz silinir. Uygulama mağazasından aldığınız aboneliği ayrıca mağaza ayarlarından iptal etmeyi unutmayın.",
      },
      {
        soru: "Borsa hesabıma erişiyor musunuz?",
        cevap:
          "Hayır. Fibonex360 hiçbir borsa veya banka hesabına bağlanmaz, emir göndermez, para tutmaz. Yalnızca herkese açık fiyat verisini analiz eder.",
      },
    ];
  }
  return [
    {
      soru: "How are signals calculated?",
      cevap:
        "For each asset we compute 20+ technical indicators across trend, momentum, volume, volatility and structure, and combine them into a single score. A strong score gives BUY or SELL, otherwise HOLD. Signals are not personalised; everyone sees the same result.",
    },
    {
      soru: "How accurate are the signals?",
      cevap:
        "We publish it: the Accuracy page shows the real outcome of signals recorded every day, 10 trading days later. No signal is certain and nothing here is investment advice.",
    },
    {
      soru: "Are prices real-time?",
      cevap:
        "Crypto, US stocks, FX, major indices and key commodities are live and marked “live”. Borsa Istanbul and some world exchanges are delayed by 15–20 minutes under exchange rules; the delay is shown on those markets.",
    },
    {
      soru: "What is a credit and when does it renew?",
      cevap:
        "Opening a detailed analysis costs 1 credit and running the scanner once costs 1 credit. Reopening the same analysis within 30 minutes is free. Credits renew at the end of your plan period; you can see the balance on My subscription.",
    },
    {
      soru: "How do I cancel my subscription?",
      cevap:
        "If you subscribed in the app: on iPhone go to Settings → your name → Subscriptions; on Android open Google Play → Payments & subscriptions. Your plan stays active until the end of the period.",
    },
    {
      soru: "How do I delete my account?",
      cevap:
        "Settings → Account → Delete account. Your record, watchlist and settings are deleted immediately and permanently. Remember to cancel any app store subscription in the store settings as well.",
    },
    {
      soru: "Do you access my brokerage account?",
      cevap:
        "No. Fibonex360 never connects to a brokerage or bank account, never places orders and never holds money. It only analyses public price data.",
    },
  ];
}

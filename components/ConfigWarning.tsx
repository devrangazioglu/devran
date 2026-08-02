import { postgresEnabled } from "@/lib/db";
import { AKTIF_MARKET_IDS } from "@/lib/markets/types";
import { twelveDataEnabled } from "@/lib/markets/twelvedata";

/**
 * Yapılandırma eksiklerini kullanıcıya (ve kuran kişiye) görünür kılar.
 * Sunucu bileşenidir; ortam değişkenleri tarayıcıya sızmaz, yalnızca
 * var/yok bilgisi mesaja dönüşür.
 */
export default function ConfigWarning() {
  const production = process.env.NODE_ENV === "production";
  const missingSecret = !process.env.AUTH_SECRET;
  const ephemeralStore = production && !postgresEnabled();
  // Anahtar uyarısı yalnızca o anahtarla beslenen bir piyasa **açıkken**
  // anlamlı; hepsi kapalıyken kullanıcıya çözemeyeceği bir eksik gösterilir.
  const anahtarliPiyasaAcik = AKTIF_MARKET_IDS.some((id) => id !== "kripto");
  const missingMarketKey = anahtarliPiyasaAcik && !twelveDataEnabled();

  if (!missingSecret && !ephemeralStore && !missingMarketKey) return null;

  return (
    <>
      {missingSecret && (
        <div className="notice notice-error" style={{ marginBottom: 14 }}>
          <strong>AUTH_SECRET tanımlı değil.</strong>{" "}
          {production
            ? "Bu sunucuda oturum açma çalışmayacak. Ortam değişkenlerine AUTH_SECRET ekleyin (openssl rand -base64 32) ve yeniden dağıtın."
            : "Geliştirmede geçici bir anahtar kullanılıyor; üretime çıkmadan önce AUTH_SECRET tanımlayın (openssl rand -base64 32)."}
        </div>
      )}
      {ephemeralStore && (
        <div className="notice notice-warn" style={{ marginBottom: 14 }}>
          <strong>Kalıcı veritabanı yapılandırılmadı.</strong> Kullanıcı kayıtları dosya
          sistemine yazılmaya çalışılacak; sunucusuz ortamlarda (Vercel vb.) bu kalıcı
          değildir ve kayıt işlemi başarısız olur. Vercel panelinde Storage → Postgres
          bağlayın; <code>DATABASE_URL</code> eklendiğinde tablo ilk istekte oluşturulur.
        </div>
      )}
      {missingMarketKey && (
        <div className="notice notice-warn" style={{ marginBottom: 14 }}>
          <strong>Hisse ve emtia verisi için anahtar tanımlı değil.</strong> Kripto ve
          dövizler anahtarsız çalışır; ABD borsası, Türkiye borsası ve emtia için ücretsiz
          bir <a href="https://twelvedata.com/pricing" target="_blank" rel="noreferrer">Twelve Data</a>{" "}
          anahtarı gerekir. Anahtarsız sağlayıcılar sunucu IP&apos;lerini engellediği için
          başka yolu yok. Anahtarı ortam değişkenlerine <code>TWELVEDATA_API_KEY</code>{" "}
          olarak ekleyip yeniden dağıtın.
        </div>
      )}
    </>
  );
}

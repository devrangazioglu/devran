import { postgresEnabled } from "@/lib/db";

/**
 * Yapılandırma eksiklerini kullanıcıya (ve kuran kişiye) görünür kılar.
 * Sunucu bileşenidir; ortam değişkenleri tarayıcıya sızmaz, yalnızca
 * var/yok bilgisi mesaja dönüşür.
 */
export default function ConfigWarning() {
  const production = process.env.NODE_ENV === "production";
  const missingSecret = !process.env.AUTH_SECRET;
  const ephemeralStore = production && !postgresEnabled();

  if (!missingSecret && !ephemeralStore) return null;

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
    </>
  );
}

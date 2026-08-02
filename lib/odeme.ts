/**
 * Ödeme sağlayıcısı bağlantısı.
 *
 * **Şu an bağlı değil.** Gerçek tahsilat için bir sağlayıcı hesabı (Stripe,
 * iyzico, Paddle …) ve anahtarları gerekiyor; bunlar olmadan "ödeme yapılmış"
 * gibi davranan bir akış kurmak kullanıcıyı yanıltır. Bu yüzden arayüz, ücretli
 * plan seçildiğinde sahte bir ödeme formu göstermek yerine sağlayıcının bağlı
 * olmadığını açıkça söyler.
 *
 * Bağlarken yapılacaklar:
 *   1. Sağlayıcıda üç fiyat (Basic/Premium/Ultimate) tanımlayın.
 *   2. `ODEME_SAGLAYICI_ANAHTARI` ve fiyat kimliklerini ortam değişkeni yapın.
 *   3. Ödeme başlatan uç noktayı yazın (kullanıcıyı sağlayıcının sayfasına
 *      gönderir).
 *   4. Sağlayıcının webhook'unda ödeme onaylanınca `planDegistir(email, plan)`
 *      çağırın — kredi defterinin plan değişimini bilmesi için tek gereken bu.
 */

/** Gerçek tahsilat yapılabiliyor mu? */
export function odemeAcik(): boolean {
  return Boolean(process.env.ODEME_SAGLAYICI_ANAHTARI?.trim());
}

/**
 * Ödemesiz plan değişimine izin veren sınama kipi.
 *
 * Yalnızca kendi ortamınızda planları denemek için; üretimde **kapalı**
 * olmalı, yoksa herkes kendini Ultimate yapar.
 */
export function odemeTestModu(): boolean {
  return process.env.ODEME_TEST_MODU === "1";
}

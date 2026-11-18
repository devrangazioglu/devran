/**
 * Yönetici hesapları.
 *
 * Yöneticiler kodda değil ortam değişkeninde tanımlanır: e-posta adresi
 * depoya (ve herkese açık olabilecek koda) yazılmaz, yönetici eklemek ya da
 * çıkarmak için yeni bir sürüm gerekmez.
 *
 *   ADMIN_EPOSTALAR=ornek@alanadi.com,ikinci@alanadi.com
 *
 * Yönetici: kredi harcamaz, en üst planın (Premium) bütün sınırlarına
 * sahiptir ve /yonetim sayfasını görür.
 */

import { normalizeEmail } from "./users-shared";

export function yoneticiEpostalari(): string[] {
  // Yazım hatalarına toleranslı: değere tırnak, boşluk ya da yanlışlıkla
  // "ADMIN_EPOSTALAR=" eklenmiş olsa da içindeki e-postalar ayıklanır.
  const ham = process.env.ADMIN_EPOSTALAR ?? "";
  return (ham.match(/[^\s,;"'`=<>]+@[^\s,;"'`=<>]+/g) ?? []).map((e) => normalizeEmail(e));
}

export function yoneticiMi(email: string | null | undefined): boolean {
  if (!email) return false;
  return yoneticiEpostalari().includes(normalizeEmail(email));
}

/**
 * Yönetici hesapları.
 *
 * Yöneticiler kodda değil ortam değişkeninde tanımlanır: e-posta adresi
 * depoya (ve herkese açık olabilecek koda) yazılmaz, yönetici eklemek ya da
 * çıkarmak için yeni bir sürüm gerekmez.
 *
 *   ADMIN_EPOSTALAR=ornek@alanadi.com,ikinci@alanadi.com
 *
 * Yönetici: kredi harcamaz, en üst planın (Ultimate) bütün sınırlarına
 * sahiptir ve /yonetim sayfasını görür.
 */

import { normalizeEmail } from "./users-shared";

export function yoneticiEpostalari(): string[] {
  return (process.env.ADMIN_EPOSTALAR ?? "")
    .split(/[,;\s]+/)
    .map((e) => normalizeEmail(e))
    .filter((e) => e.includes("@"));
}

export function yoneticiMi(email: string | null | undefined): boolean {
  if (!email) return false;
  return yoneticiEpostalari().includes(normalizeEmail(email));
}

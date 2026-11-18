/**
 * Yönetim paneli: üye listesi ve özet istatistikler.
 *
 * Yalnızca yönetici (bkz. lib/admin.ts) çağırır. Parola özeti ve iç
 * defter ayrıntıları (ücretsiz tekrar penceresi) dışarı verilmez.
 */

import { yoneticiMi } from "./admin";
import { kullanicidanDurum } from "./credits";
import type { PlanId } from "./plans";
import { store } from "./users";
import { davetKodu, normalizeSubscription, type User } from "./users-shared";

export type UyeSatiri = {
  email: string;
  ad: string;
  kayit: number;
  giris: "parola" | "google/apple";
  plan: PlanId;
  etkinPlan: PlanId;
  faturalama: string;
  kalan: number;
  harcanan: number;
  bonus: number;
  davetSayisi: number;
  davetle: boolean;
  takip: number;
  yonetici: boolean;
  kod: string;
};

export type YonetimOzeti = {
  toplam: number;
  son7Gun: number;
  son30Gun: number;
  planlar: Record<PlanId, number>;
  davetleGelen: number;
  toplamBonus: number;
  listeSiniri: number;
};

const LISTE_SINIRI = 2000;

function satir(user: User): UyeSatiri {
  const ab = normalizeSubscription(user.abonelik);
  const durum = kullanicidanDurum(user);
  return {
    email: user.email,
    ad: user.name,
    kayit: user.createdAt,
    giris: user.passwordHash ? "parola" : "google/apple",
    plan: ab.plan,
    etkinPlan: durum.plan.id,
    faturalama: ab.faturalama,
    kalan: durum.kalan,
    harcanan: durum.harcanan,
    bonus: ab.bonus,
    davetSayisi: ab.davetSayisi,
    davetle: Boolean(ab.davetEden),
    takip: user.watchlist.length,
    yonetici: yoneticiMi(user.email),
    kod: davetKodu(user.id),
  };
}

export async function yonetimVerisi(): Promise<{ ozet: YonetimOzeti; uyeler: UyeSatiri[] }> {
  const kullanicilar = await store().list(LISTE_SINIRI);
  const uyeler = kullanicilar.map(satir);
  const simdi = Date.now();
  const gun = 86_400_000;
  const planlar: Record<PlanId, number> = { ucretsiz: 0, basic: 0, premium: 0 };
  for (const u of uyeler) planlar[u.plan] += 1;

  return {
    ozet: {
      toplam: uyeler.length,
      son7Gun: uyeler.filter((u) => simdi - u.kayit < 7 * gun).length,
      son30Gun: uyeler.filter((u) => simdi - u.kayit < 30 * gun).length,
      planlar,
      davetleGelen: uyeler.filter((u) => u.davetle).length,
      toplamBonus: uyeler.reduce((t, u) => t + u.bonus, 0),
      listeSiniri: LISTE_SINIRI,
    },
    uyeler,
  };
}

/** Bir üyeye ek kredi verir (eksi değer geri alır, sıfırın altına inmez). */
export async function bonusVer(email: string, miktar: number): Promise<boolean> {
  const sonuc = await store().update(email, (user) => {
    const ab = normalizeSubscription(user.abonelik);
    user.abonelik = { ...ab, bonus: Math.max(ab.bonus + Math.trunc(miktar), 0) };
  });
  return sonuc !== null;
}

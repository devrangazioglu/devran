/**
 * Üyelik planları ve kredi kuralları.
 *
 * Kredi neyi ölçer: bir varlığın **ayrıntılı analizi**. Analiz, 20'den fazla göstergenin
 * hesaplanması, seviye/formasyon çıkarımı ve yorum üretimi demek; maliyeti de
 * değeri de burada. Liste ve tablo görüntülemek kredi harcamaz, yoksa kullanıcı
 * gezinmeye korkar.
 *
 * Kurallar:
 *   • Bir varlığın analizi: 1 kredi.
 *   • Aynı varlık + aynı periyot kısa süre içinde yeniden açılırsa: ücretsiz.
 *     Sayfayı yenilemek ya da geri gelmek kredi yakmamalı.
 *   • Sinyal tarayıcı bir çalıştırma: 1 kredi (kaç varlık taradığından bağımsız).
 *     Tarama, tek tek analizin yerini tutmayan bir "genel bakış"; plan farkı
 *     kredi değil, aynı anda taranabilen varlık sayısıyla verilir.
 *   • Krediler her ay yenilenir, devretmez.
 *
 * Fiyatlar ABD doları; Türkiye'de ayrıca Türk lirası fiyatı gösterilir
 * (App Store'daki ülke fiyatıyla aynı). Fiyatlar mağaza alışkanlığına uygun
 * olarak ",99" ile biter.
 */

import type { Interval } from "./markets/types";

export type PlanId = "ucretsiz" | "basic" | "premium" | "ultimate";

/**
 * Faturalama dönemi.
 *
 * Yıllık ödeyene iki ay bedava: hem yuvarlak bir rakam çıkıyor (9,99 → 99,99)
 * hem de anlatması kolay. Kredi hakkı ikisinde de aynı ve **her ay** yenilenir;
 * yıllık ödemek bir yıllık krediyi peşin vermek değil, aylık hakkı ucuza almak.
 */
export type Faturalama = "aylik" | "yillik";

export const FATURALAMA_SECENEKLERI: Faturalama[] = ["aylik", "yillik"];

export function isFaturalama(value: unknown): value is Faturalama {
  return value === "aylik" || value === "yillik";
}

/** Yıllık ödemede ücretsiz gelen ay sayısı (fiyatlar buna göre türetilir). */
export const YILLIK_BEDAVA_AY = 2;

export type Plan = {
  id: PlanId;
  /** Arayüzde görünen ad. */
  ad: string;
  /** Aylık ödemede aylık ücret (USD); ücretsiz planda 0. */
  ucret: number;
  /** Yıllık ödemede tek seferde ödenen ücret (USD). */
  yillikUcret: number;
  /** Türkiye fiyatları (TRY): aylık ve yıllık. */
  tl: { aylik: number; yillik: number };
  /** Her ay yenilenen analiz kredisi. */
  aylikKredi: number;
  /** Tarayıcının tek çalıştırmada bakabileceği en fazla varlık. */
  taramaSiniri: number;
  /** Takip listesine eklenebilecek en fazla varlık. */
  takipSiniri: number;
  /** Bu planda açık olan zaman dilimleri. */
  periyotlar: Interval[];
  /**
   * Karta eklenecek tek bir vurgu (çeviri anahtarı).
   *
   * Bilerek kısa: kartın gövdesi zaten gerçek sayıları (kredi, tarama, takip,
   * periyot) gösteriyor. Uygulamada karşılığı olmayan vaatler yazılmaz.
   */
  vurgu?: string;
};

/**
 * Bütün planlarda bütün periyotlar açık.
 *
 * Periyotlar bir dönem plana göre kilitliydi (ücretsiz planda 1 saatten kısa
 * periyot yoktu). Kaldırıldı: planlar kredi, tarama ve takip sınırıyla
 * ayrışıyor; kısa periyotlar daha çok istek harcar ama o da krediden düşer.
 * Hangi periyodun hangi piyasada bulunduğu ayrı bir konudur ve veri
 * kaynağına bağlıdır (bkz. `MARKETS[...].intervals`).
 */
const TUM_PERIYOTLAR: Interval[] = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"];

export const PLANS: Record<PlanId, Plan> = {
  ucretsiz: {
    id: "ucretsiz",
    ad: "Ücretsiz",
    ucret: 0,
    yillikUcret: 0,
    tl: { aylik: 0, yillik: 0 },
    // Uygulamayı açık tutacak kadar; asıl deneme kayıttaki hoş geldin kredisi
    // (bkz. credits.ts → HOSGELDIN_KREDISI).
    aylikKredi: 10,
    taramaSiniri: 10,
    takipSiniri: 10,
    periyotlar: TUM_PERIYOTLAR,
  },
  basic: {
    id: "basic",
    ad: "Basic",
    ucret: 9.99,
    yillikUcret: 99.99,
    tl: { aylik: 249.99, yillik: 2499.99 },
    aylikKredi: 600,
    taramaSiniri: 30,
    takipSiniri: 50,
    periyotlar: TUM_PERIYOTLAR,
  },
  premium: {
    id: "premium",
    ad: "Premium",
    ucret: 29.99,
    yillikUcret: 299.99,
    tl: { aylik: 749.99, yillik: 7499.99 },
    aylikKredi: 2500,
    taramaSiniri: 60,
    takipSiniri: 200,
    periyotlar: TUM_PERIYOTLAR,
  },
  ultimate: {
    id: "ultimate",
    ad: "Ultimate",
    ucret: 59.99,
    yillikUcret: 599.99,
    tl: { aylik: 1499.99, yillik: 14999.99 },
    aylikKredi: 7500,
    taramaSiniri: 100,
    takipSiniri: 500,
    periyotlar: TUM_PERIYOTLAR,
    vurgu: "plan.vurgu.oncelik",
  },
};

/** En üst plan: yönetici hesapları bunun sınırlarıyla çalışır. */
export const EN_UST_PLAN: PlanId = "ultimate";

export const PLAN_IDS: PlanId[] = ["ucretsiz", "basic", "premium", "ultimate"];

/** Satın alınabilir planlar (ücretsiz olan kartlarda ayrı gösterilir). */
export const UCRETLI_PLAN_IDS: PlanId[] = ["basic", "premium", "ultimate"];

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && (PLAN_IDS as string[]).includes(value);
}

export function plan(id: PlanId | string | undefined): Plan {
  return isPlanId(id) ? PLANS[id] : PLANS.ucretsiz;
}

export type ParaBirimi = "USD" | "TRY";

/** Türkçe arayüzde Türk lirası, diğer dillerde dolar gösterilir. */
export function paraBirimi(locale: string): ParaBirimi {
  return locale === "tr" ? "TRY" : "USD";
}

/** Seçilen faturalama dönemine göre ödenecek tutar. */
export function planUcreti(secilen: Plan, faturalama: Faturalama, para: ParaBirimi = "USD"): number {
  if (para === "TRY") return faturalama === "yillik" ? secilen.tl.yillik : secilen.tl.aylik;
  return faturalama === "yillik" ? secilen.yillikUcret : secilen.ucret;
}

/** Yıllık ödemede aya düşen tutar (karttaki "ayda ~X" satırı için). */
export function yillikAylikKarsiligi(secilen: Plan, para: ParaBirimi = "USD"): number {
  return planUcreti(secilen, "yillik", para) / 12;
}

/**
 * Yeni üyeye bir kez verilen ek kredi.
 *
 * Ek kredi ay sonunda silinmez; aylık hak bittiğinde buradan düşülür. Eski
 * 7 günlük Premium denemesinin yerini aldı: kart ya da süre yok, kullanıcı
 * uygulamayı kendi hızında dener.
 */
export const HOSGELDIN_KREDISI = 30;

/** Bir analizin maliyeti. Şimdilik sabit; ileride varlık türüne göre değişebilir. */
export const ANALIZ_KREDISI = 1;

/** Bir tarama çalıştırmasının maliyeti. */
export const TARAMA_KREDISI = 1;

/**
 * Aynı analiz için yeniden ücret alınmayan süre.
 *
 * Sayfayı yenilemek, geri gelmek ya da sekme değiştirmek kredi yakmamalı;
 * kullanıcı bir varlığı "bir kez" analiz ettiğini hisseder.
 */
export const TEKRAR_UCRETSIZ_MS = 30 * 60_000;

/** Bir dönemin uzunluğu (ay). Krediler bu sürede bir yenilenir. */
export const DONEM_MS = 30 * 24 * 60 * 60_000;

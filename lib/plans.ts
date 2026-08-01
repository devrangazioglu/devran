/**
 * Üyelik planları ve kredi kuralları.
 *
 * Kredi neyi ölçer: bir varlığın **ayrıntılı analizi**. Analiz, 16 göstergenin
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
 * Fiyatlar aylık ve ABD doları.
 */

import type { Interval } from "./markets/types";

export type PlanId = "ucretsiz" | "basic" | "premium" | "ultimate";

export type Plan = {
  id: PlanId;
  /** Arayüzde görünen ad. */
  ad: string;
  /** Aylık ücret (USD); ücretsiz planda 0. */
  ucret: number;
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

/** Kısa periyotlar daha çok istek ve daha çok gürültü demek; üst planlara ait. */
const TEMEL_PERIYOTLAR: Interval[] = ["1h", "4h", "1d", "1w"];
const ORTA_PERIYOTLAR: Interval[] = ["15m", "30m", ...TEMEL_PERIYOTLAR];
const TUM_PERIYOTLAR: Interval[] = ["1m", "5m", ...ORTA_PERIYOTLAR];

export const PLANS: Record<PlanId, Plan> = {
  ucretsiz: {
    id: "ucretsiz",
    ad: "Ücretsiz",
    ucret: 0,
    // Denemeye yetecek kadar: günde üç analiz.
    aylikKredi: 90,
    taramaSiniri: 10,
    takipSiniri: 10,
    periyotlar: TEMEL_PERIYOTLAR,
  },
  basic: {
    id: "basic",
    ad: "Basic",
    ucret: 9.99,
    aylikKredi: 600,
    taramaSiniri: 30,
    takipSiniri: 50,
    periyotlar: ORTA_PERIYOTLAR,
  },
  premium: {
    id: "premium",
    ad: "Premium",
    ucret: 29.99,
    aylikKredi: 2500,
    taramaSiniri: 60,
    takipSiniri: 200,
    periyotlar: TUM_PERIYOTLAR,
    vurgu: "plan.vurgu.dakikalik",
  },
  ultimate: {
    id: "ultimate",
    ad: "Ultimate",
    ucret: 59.99,
    aylikKredi: 7500,
    taramaSiniri: 100,
    takipSiniri: 500,
    periyotlar: TUM_PERIYOTLAR,
    vurgu: "plan.vurgu.oncelik",
  },
};

export const PLAN_IDS: PlanId[] = ["ucretsiz", "basic", "premium", "ultimate"];

/** Satın alınabilir planlar (ücretsiz olan kartlarda ayrı gösterilir). */
export const UCRETLI_PLAN_IDS: PlanId[] = ["basic", "premium", "ultimate"];

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && (PLAN_IDS as string[]).includes(value);
}

export function plan(id: PlanId | string | undefined): Plan {
  return isPlanId(id) ? PLANS[id] : PLANS.ucretsiz;
}

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

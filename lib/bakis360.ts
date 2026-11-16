/**
 * 360° Bakış: bir varlığa sekiz açıdan bakıp her açıyı −100 … +100 arası tek
 * bir değere indirger.
 *
 * Skor (−100 … +100) bütün göstergelerin ağırlıklı toplamı; tek sayı olduğu
 * için "neden" sorusunu yanıtlamıyor. Bu dosya aynı göstergeleri konularına
 * göre ayırıyor: trend alıcı ama momentum yorulmuş, hacim desteklemiyor gibi
 * bir tablo, tek skordan daha çok şey söyler. Yeni hesap yok — motorun zaten
 * ürettiği göstergeler ve bağlam yeniden gruplanıyor.
 *
 * Açılar:
 *   trend · momentum · fiyat yapısı · hacim · volatilite → gösterge grupları
 *   zaman uyumu → diğer periyotların skor ortalaması
 *   göreli güç  → endekse (hissede) ya da Bitcoin'e (alt coinde) göre güç
 *   temel       → şirketin mali puanı (yalnızca hisselerde)
 * Verisi olmayan açı `null` döner ve halkada gri gösterilir; uydurulmaz.
 */

import type { Analysis, IndicatorCheck } from "./analysis";
import type { Fundamentals } from "./fundamentals";

export type AciAnahtari =
  | "trend"
  | "momentum"
  | "structure"
  | "volume"
  | "volatility"
  | "timeframes"
  | "relative"
  | "fundamental";

export type Aci = { anahtar: AciAnahtari; deger: number | null };

export type Bakis360 = {
  acilar: Aci[];
  /** Sinyal yönüyle aynı tarafta duran açıların oranı (0–1); yön yoksa null. */
  uyum: number | null;
  alici: number;
  satici: number;
  notr: number;
  /** Değeri en yüksek ve en düşük açı (veri olanlar arasında). */
  enGuclu: Aci | null;
  enZayif: Aci | null;
};

/** Bu eşiğin altındaki açı nötr sayılır (±15 / 100). */
export const NOTR_ESIK = 15;

/** Göstergelerin ağırlıklı yön ortalaması, −100 … +100. */
function agirlikliYon(checks: IndicatorCheck[]): number | null {
  let toplam = 0;
  let agirlik = 0;
  for (const c of checks) {
    if (!(c.weight > 0) || !Number.isFinite(c.direction)) continue;
    toplam += c.direction * c.weight;
    agirlik += c.weight;
  }
  return agirlik > 0 ? Math.max(-100, Math.min(100, (toplam / agirlik) * 100)) : null;
}

export function bakis360(
  analysis: Analysis,
  baglam: { timeframes?: { score: number }[]; fundamentals?: Fundamentals | null } = {},
): Bakis360 {
  const grup = (kategori: IndicatorCheck["category"], haric: string[] = []) =>
    agirlikliYon(analysis.checks.filter((c) => c.category === kategori && !haric.includes(c.id)));

  const goreli = analysis.checks.find((c) => c.id === "rel-strength");
  const ustPeriyot = analysis.checks.find((c) => c.id === "higher-tf");

  // Zaman uyumu: diğer periyotların skor ortalaması; yoksa motorun kendi
  // türettiği üst periyot göstergesi.
  const periyotlar = baglam.timeframes ?? [];
  const zaman =
    periyotlar.length > 0
      ? periyotlar.reduce((t, p) => t + p.score, 0) / periyotlar.length
      : ustPeriyot
        ? ustPeriyot.direction * 100
        : null;

  const acilar: Aci[] = [
    { anahtar: "trend", deger: grup("trend") },
    { anahtar: "momentum", deger: grup("momentum") },
    // Üst periyot ve göreli güç ayrı açı; yapının içinde iki kez sayılmasın.
    { anahtar: "structure", deger: grup("structure", ["higher-tf", "rel-strength"]) },
    { anahtar: "volume", deger: grup("volume") },
    { anahtar: "volatility", deger: grup("volatility") },
    { anahtar: "timeframes", deger: zaman === null ? null : Math.max(-100, Math.min(100, zaman)) },
    { anahtar: "relative", deger: goreli ? goreli.direction * 100 : null },
    // Temel puan 0–100; 50 orta. −100 … +100'e taşınır.
    {
      anahtar: "fundamental",
      deger: baglam.fundamentals ? (baglam.fundamentals.score - 50) * 2 : null,
    },
  ];

  const dolu = acilar.filter((a): a is Aci & { deger: number } => a.deger !== null);
  const alici = dolu.filter((a) => a.deger >= NOTR_ESIK).length;
  const satici = dolu.filter((a) => a.deger <= -NOTR_ESIK).length;
  const yon = Math.sign(analysis.score);
  const uyum =
    yon === 0 || dolu.length === 0
      ? null
      : dolu.filter((a) => Math.sign(a.deger) === yon && Math.abs(a.deger) >= NOTR_ESIK).length / dolu.length;

  const sirali = [...dolu].sort((a, b) => b.deger - a.deger);
  return {
    acilar,
    uyum,
    alici,
    satici,
    notr: dolu.length - alici - satici,
    enGuclu: sirali[0] ?? null,
    enZayif: sirali.length > 1 ? sirali[sirali.length - 1] : null,
  };
}

/**
 * Değerli metaller için anahtarsız spot fiyat (gold-api.com).
 *
 * Neden ayrı bir kaynak: ölçümde (2026-11-16, `scripts/kaynak-tara.ts`) bu uç
 * nokta anahtar istemeden, engellenmeden ve **dakikası dakikasına** güncel
 * yanıt verdi — altın/gümüşte Yahoo'nun aktarıcı üzerinden gelen gecikmeli
 * verisinden daha tazesi. Tek metal için tek istek, dört metal için dört.
 *
 * Bir farkı açıkça söylemek gerekir: buradaki fiyat **spot** fiyattır
 * (XAU/ons), bizim emtia listemizdeki `GC=F` ise **vadeli** kontrattır. İkisi
 * birbirine yakın ama aynı değil (vade primi). Liste "Altın (ons)" dediği için
 * spot fiyat kullanıcının aradığı sayıya daha yakın; yine de iki fiyatı
 * karıştırmamak adına bu kaynak yalnızca Yahoo yolu veri veremediğinde
 * kullanılır, taze diye araya girmez.
 *
 * `METAL_KAPALI=1` ile devre dışı bırakılabilir.
 */

import { MarketDataError } from "./types";

const BASE = process.env.METAL_API_BASE ?? "https://api.gold-api.com";

/** Yahoo vadeli sembolü → gold-api spot sembolü. */
const ESLEME: Record<string, string> = {
  "GC=F": "XAU",
  "SI=F": "XAG",
  "PL=F": "XPT",
  "PA=F": "XPD",
};

export type MetalFiyati = {
  /** Uygulamadaki sembol ("GC=F"). */
  symbol: string;
  price: number;
  /** Kaynağın bildirdiği güncelleme zamanı (ms). */
  updatedAt: number;
};

export function metalAcik(): boolean {
  return process.env.METAL_KAPALI !== "1";
}

/** Bu sembol için spot fiyat kaynağı var mı? */
export function metalDestekliyor(symbol: string): boolean {
  return metalAcik() && ESLEME[symbol] !== undefined;
}

export function metalSembolleri(): string[] {
  return Object.keys(ESLEME);
}

type Yanit = { name?: string; price?: number; symbol?: string; updatedAt?: string };

/**
 * Verilen sembollerin spot fiyatlarını çeker.
 *
 * Bir metalin düşmesi diğerlerini düşürmez: kaynak tek tek sorgulandığı için
 * hangisi geldiyse o döner. Hiçbiri gelmezse hata atılır, çünkü o durumda
 * çağıranın başka bir kaynağa geçmesi gerekir.
 */
export async function fetchMetalQuotes(symbols: string[]): Promise<MetalFiyati[]> {
  const istenecek = symbols.filter((s) => metalDestekliyor(s));
  if (istenecek.length === 0) return [];

  const sonuclar = await Promise.all(
    istenecek.map(async (symbol): Promise<MetalFiyati | null> => {
      try {
        const yanit = await fetch(`${BASE}/price/${ESLEME[symbol]}`, {
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(8_000),
          cache: "no-store",
        });
        if (!yanit.ok) return null;
        const govde = (await yanit.json()) as Yanit;
        if (typeof govde.price !== "number" || !Number.isFinite(govde.price)) return null;

        const zaman = govde.updatedAt ? Date.parse(govde.updatedAt) : Number.NaN;
        return {
          symbol,
          price: govde.price,
          updatedAt: Number.isNaN(zaman) ? Date.now() : zaman,
        };
      } catch {
        return null;
      }
    }),
  );

  const temiz = sonuclar.filter((s): s is MetalFiyati => s !== null);
  if (temiz.length === 0) {
    throw new MarketDataError("Metal fiyatı alınamadı.", 502);
  }
  return temiz;
}

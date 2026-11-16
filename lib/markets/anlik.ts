/**
 * Hangi semboller gecikmesiz (anlık) gelebiliyor?
 *
 * Ölçüldü (2026-11-16, `scripts/anlik-tara.ts`): kaynak her sembol için
 * `update_mode` bildiriyor. "streaming" çıkanlar:
 *   • ABD hisseleri (NASDAQ/NYSE, quote oturumu ve grafik akışında)
 *   • TVC endeksleri: S&P 500, Nasdaq, Dow, DAX, CAC 40, FTSE 100, Nikkei,
 *     Hang Seng, dolar endeksi; KOSPI borsanın kendi kodunda
 *   • TVC emtia: altın, gümüş, platin, paladyum, WTI ve Brent petrol
 *   • döviz (FX:…) ve kripto
 * Gecikmeli kalanlar: BIST, Avrupa ve Asya hisseleri (15–20 dk), Şanghay,
 * Nifty, TSX, TAIEX, TASI ve BIST endeksleri (15 dk), doğal gaz, bakır,
 * buğday ve kahve vadelileri (10 dk). Bunların ücretsiz anlık karşılığı yok.
 *
 * Bu dosya yalnızca veri içerir; arayüz de "canlı" işaretini buradan bilir.
 */

import type { MarketId } from "./types";

/** Endeks → anlık yayınlanan TradingView sembolü. */
export const ENDEKS_ANLIK: Record<string, string> = {
  "^GSPC": "TVC:SPX",
  "^IXIC": "TVC:IXIC",
  "^DJI": "TVC:DJI",
  "DX-Y.NYB": "TVC:DXY",
  "^GDAXI": "TVC:DAX",
  "^FCHI": "TVC:CAC40",
  "^FTSE": "TVC:UKX",
  "^N225": "TVC:NI225",
  "^HSI": "TVC:HSI",
  "^KS11": "KRX:KOSPI",
};

/**
 * Emtia → anlık yayınlanan TVC sembolü.
 *
 * Bunlar vadeli kontrat değil, spot (anlık teslim) fiyat. Vadeliyle farkı
 * ölçümde %0,1 civarındaydı (altın 3865 / 3867,8). Uygulamadaki ad zaten
 * "Altın (ons)"; spot fiyat bu ada vadeliden daha uygun.
 */
export const EMTIA_ANLIK: Record<string, string> = {
  "GC=F": "TVC:GOLD",
  "SI=F": "TVC:SILVER",
  "PL=F": "TVC:PLATINUM",
  "PA=F": "TVC:PALLADIUM",
  "CL=F": "TVC:USOIL",
  "BZ=F": "TVC:UKOIL",
};

/** Bu varlığın fiyatı ve mumları gecikmesiz mi geliyor? */
export function anlikMi(market: MarketId, symbol: string): boolean {
  if (market === "kripto") return true;
  if (ENDEKS_ANLIK[symbol] || EMTIA_ANLIK[symbol]) return true;
  if (symbol.endsWith("=X")) return true; // döviz
  // ABD hisseleri: grafik akışı ve quote oturumu gecikmesiz veriyor.
  return market === "abd";
}

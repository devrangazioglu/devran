/**
 * Hangi semboller gecikmesiz gelebiliyor, gün içi mumlar geliyor mu?
 *
 * Kaynak her sembol için `update_mode` bildiriyor: "streaming" gecikmesiz,
 * "delayed_streaming_900" 15 dakika gecikmeli demek. Aday beslemeler:
 *   • ABD hisseleri için Cboe BZX ("BATS:AAPL") — ücretsiz gerçek zamanlı
 *   • TVC endeks ve emtia beslemeleri ("TVC:DAX", "TVC:GOLD")
 * Ayrıca 15 dk / 1 sa / 4 sa mumların sayısı ve son mumun yaşı ölçülür.
 *
 *   npm run anlik-tara
 */

import { fetchTvAnlik, fetchTvCandles } from "../lib/markets/tv-mum";
import type { Interval } from "../lib/markets/types";

const ADAYLAR = [
  // ABD hisseleri: birincil borsa (gecikmeli) ve Cboe BZX (gerçek zamanlı?)
  "NASDAQ:AAPL", "BATS:AAPL", "BATS:MSFT", "BATS:JPM", "BATS:SPY",
  // Endeksler: borsanın kendi kodu ve TVC
  "SP:SPX", "TVC:SPX", "NASDAQ:IXIC", "TVC:IXIC", "DJ:DJI", "TVC:DJI",
  "BIST:XU100", "BIST:XU030", "XETR:DAX", "TVC:DAX", "EURONEXT:PX1", "TVC:CAC40",
  "TVC:UKX", "TVC:NI225", "TVC:HSI", "SSE:000001", "TVC:SHCOMP", "NSE:NIFTY", "TVC:NIFTY50",
  "TSX:TSX", "KRX:KOSPI", "TVC:KOSPI", "TWSE:IX0001", "TADAWUL:TASI", "TVC:DXY",
  // Emtia: vadeli (gecikmeli) ve TVC (?)
  "COMEX:GC1!", "TVC:GOLD", "COMEX:SI1!", "TVC:SILVER", "TVC:PLATINUM", "TVC:PALLADIUM",
  "NYMEX:CL1!", "TVC:USOIL", "TVC:UKOIL", "NYMEX:NG1!", "TVC:NATGAS", "COMEX:HG1!", "TVC:COPPER",
  "CBOT:ZW1!", "ICEUS:KC1!",
  // Hisse örnekleri
  "BIST:THYAO", "LSE:AZN", "XETR:SAP", "TSE:7203", "HKEX:700", "NSE:RELIANCE", "FX:USDTRY",
];

const GUN_ICI: Interval[] = ["15m", "1h", "4h"];
const MUM_ADAYLARI = ["BATS:AAPL", "NASDAQ:AAPL", "BIST:THYAO", "XETR:SAP", "LSE:AZN", "TSE:7203", "TVC:GOLD", "COMEX:GC1!", "FX:USDTRY", "SP:SPX"];

async function main() {
  console.log("══ Anlık fiyat (quote oturumu) ══");
  const basladi = Date.now();
  const anlik = await fetchTvAnlik(ADAYLAR, 15_000);
  console.log(`${anlik.size}/${ADAYLAR.length} sembol, ${Date.now() - basladi} ms\n`);
  for (const ad of ADAYLAR) {
    const v = anlik.get(ad);
    if (!v) {
      console.log(`  ${ad.padEnd(16)} ✗ gelmedi`);
      continue;
    }
    const yas = v.zaman ? `${Math.round((Date.now() - v.zaman) / 60_000)} dk önce` : "?";
    console.log(
      `  ${ad.padEnd(16)} ${String(v.guncelleme).padEnd(24)} ${String(v.fiyat).padStart(12)}  %${v.degisimYuzde?.toFixed(2) ?? "?"}  son işlem ${yas}`,
    );
  }

  console.log("\n══ Gün içi mumlar ══");
  for (const ad of MUM_ADAYLARI) {
    const satir: string[] = [];
    for (const periyot of GUN_ICI) {
      try {
        const { candles } = await fetchTvCandles(ad, periyot, 300);
        const son = candles.at(-1)!;
        const yas = Math.round((Date.now() - son.openTime) / 60_000);
        satir.push(`${periyot}: ${candles.length} mum, son ${yas} dk önce açıldı`);
      } catch (error) {
        satir.push(`${periyot}: ✗ ${error instanceof Error ? error.message : error}`);
      }
    }
    console.log(`  ${ad.padEnd(14)} ${satir.join(" | ")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

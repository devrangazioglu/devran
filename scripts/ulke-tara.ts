/**
 * Yeni ülke borsaları için veri ölçümü.
 *
 * Bir borsayı siteye eklemeden önce üç sorunun yanıtı ölçülür, tahmin
 * edilmez:
 *   1. Anlık fiyat: TradingView tarayıcısı o ülkeyi tek istekte veriyor mu,
 *      hangi borsa kodu, para birimi ve gecikmeyle (`update_mode`)?
 *   2. Mum geçmişi: Yahoo (aktarıcı üzerinden) o borsanın sembolünde 300
 *      günlük mum veriyor mu, son kapanış tarayıcıdaki fiyatla tutuyor mu?
 *      Tutmuyorsa sembol eşlemesi yanlıştır ve kullanıcı başka bir şirketin
 *      grafiğini görür.
 *   3. Endeks: kıyas endeksi her iki kaynakta da var mı?
 *
 * Çıktıdaki piyasa değerine göre ilk 30 satır, hazır listeyi seçmek için de
 * kullanılır.
 *
 *   npm run ulke-tara
 */

import { fetchTvCandles } from "../lib/markets/tv-mum";
import { fetchChart } from "../lib/markets/yahoo";

const TV = "https://scanner.tradingview.com";
const BASLIK = {
  "content-type": "application/json",
  accept: "application/json",
  origin: "https://www.tradingview.com",
  referer: "https://www.tradingview.com/",
  "user-agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

type Aday = {
  ad: string;
  yol: string;
  borsalar: string[];
  /** Tarayıcı adını Yahoo sembolüne çevirir. */
  yahoo: (ad: string, borsa: string) => string;
  endeksTv: string[];
  endeksYahoo: string;
};

const ADAYLAR: Aday[] = [
  { ad: "Almanya", yol: "germany", borsalar: ["XETR"], yahoo: (a) => `${a}.DE`, endeksTv: ["XETR:DAX", "TVC:DAX"], endeksYahoo: "^GDAXI" },
  { ad: "İngiltere", yol: "uk", borsalar: ["LSE"], yahoo: (a) => `${a.replace(/\.$/, "")}.L`, endeksTv: ["TVC:UKX", "FTSE:UKX"], endeksYahoo: "^FTSE" },
  { ad: "Fransa", yol: "france", borsalar: ["EURONEXT"], yahoo: (a) => `${a}.PA`, endeksTv: ["EURONEXT:PX1", "TVC:CAC40"], endeksYahoo: "^FCHI" },
  { ad: "Japonya", yol: "japan", borsalar: ["TSE"], yahoo: (a) => `${a}.T`, endeksTv: ["TVC:NI225", "INDEX:NKY"], endeksYahoo: "^N225" },
  { ad: "Hong Kong", yol: "hongkong", borsalar: ["HKEX"], yahoo: (a) => `${a.padStart(4, "0")}.HK`, endeksTv: ["TVC:HSI", "HSI:HSI"], endeksYahoo: "^HSI" },
  {
    ad: "Çin",
    yol: "china",
    borsalar: ["SSE", "SZSE"],
    yahoo: (a, b) => `${a}.${b === "SSE" ? "SS" : "SZ"}`,
    endeksTv: ["SSE:000001", "SSE:000300"],
    endeksYahoo: "000001.SS",
  },
  { ad: "Hindistan", yol: "india", borsalar: ["NSE"], yahoo: (a) => `${a}.NS`, endeksTv: ["NSE:NIFTY", "TVC:NIFTY"], endeksYahoo: "^NSEI" },
  { ad: "Kanada", yol: "canada", borsalar: ["TSX"], yahoo: (a) => `${a.replace(/\./g, "-")}.TO`, endeksTv: ["TSX:TSX", "TVC:TSX"], endeksYahoo: "^GSPTSE" },
  { ad: "Güney Kore", yol: "korea", borsalar: ["KRX"], yahoo: (a) => `${a}.KS`, endeksTv: ["KRX:KOSPI", "TVC:KOSPI"], endeksYahoo: "^KS11" },
  { ad: "Tayvan", yol: "taiwan", borsalar: ["TWSE"], yahoo: (a) => `${a}.TW`, endeksTv: ["TWSE:IX0001", "TVC:TWII"], endeksYahoo: "^TWII" },
  { ad: "Suudi Arabistan", yol: "ksa", borsalar: ["TADAWUL"], yahoo: (a) => `${a}.SR`, endeksTv: ["TADAWUL:TASI", "TVC:TASI"], endeksYahoo: "^TASI.SR" },
];

type Satir = { s: string; d: (string | number | null)[] };

async function tara(aday: Aday) {
  const yanit = await fetch(`${TV}/${aday.yol}/scan`, {
    method: "POST",
    headers: BASLIK,
    body: JSON.stringify({
      filter: [
        { left: "exchange", operation: "in_range", right: aday.borsalar },
        { left: "type", operation: "equal", right: "stock" },
      ],
      columns: ["name", "description", "close", "currency", "update_mode", "market_cap_basic", "exchange", "volume"],
      sort: { sortBy: "market_cap_basic", sortOrder: "desc" },
      range: [0, 30],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!yanit.ok) throw new Error(`HTTP ${yanit.status}: ${(await yanit.text()).slice(0, 120)}`);
  const govde = (await yanit.json()) as { totalCount?: number; data?: Satir[] };
  return { toplam: govde.totalCount ?? 0, satirlar: govde.data ?? [] };
}

async function tumBorsa(aday: Aday) {
  // Uygulama hacme göre sıralı tüm borsayı tek istekte çekiyor; aynısı ölçülür.
  const basladi = Date.now();
  const yanit = await fetch(`${TV}/${aday.yol}/scan`, {
    method: "POST",
    headers: BASLIK,
    body: JSON.stringify({
      filter: [{ left: "exchange", operation: "in_range", right: aday.borsalar }],
      columns: ["name", "close"],
      sort: { sortBy: "volume", sortOrder: "desc" },
      range: [0, 3000],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const govde = (await yanit.json()) as { totalCount?: number; data?: Satir[] };
  return `${govde.data?.length ?? 0}/${govde.totalCount ?? 0} satır, ${Date.now() - basladi} ms`;
}

async function endeksTv(tamAd: string): Promise<string> {
  const yanit = await fetch(`${TV}/symbol?symbol=${encodeURIComponent(tamAd)}&fields=close,currency,update_mode`, {
    headers: BASLIK,
    signal: AbortSignal.timeout(15_000),
  });
  if (!yanit.ok) return `${tamAd} ✗ HTTP ${yanit.status}`;
  const g = (await yanit.json()) as { close?: number; currency?: string; update_mode?: string };
  return typeof g.close === "number" ? `${tamAd} ✓ ${g.close} ${g.currency ?? ""} (${g.update_mode ?? "?"})` : `${tamAd} ✗ boş`;
}

async function yahoo(sembol: string, tvFiyat?: number): Promise<string> {
  try {
    const grafik = await fetchChart(sembol, "1d", 300);
    const son = grafik.candles.at(-1);
    if (!son) return `${sembol} ✗ mum yok`;
    let fark = "";
    if (tvFiyat) {
      const yuzde = (Math.abs(son.close - tvFiyat) / tvFiyat) * 100;
      fark = ` · TV ${tvFiyat} → fark %${yuzde.toFixed(1)}${yuzde > 8 ? " ⚠ EŞLEŞME ŞÜPHELİ" : ""}`;
    }
    return `${sembol} ✓ ${grafik.candles.length} mum, son ${son.close} ${grafik.currency ?? ""} (${new Date(son.openTime).toISOString().slice(0, 10)})${fark}`;
  } catch (error) {
    return `${sembol} ✗ ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function tvMum(tamAd: string, tvFiyat?: number): Promise<string> {
  const basladi = Date.now();
  try {
    const { candles, currency } = await fetchTvCandles(tamAd, "1d", 300);
    const son = candles.at(-1)!;
    let fark = "";
    if (tvFiyat) {
      const yuzde = (Math.abs(son.close - tvFiyat) / tvFiyat) * 100;
      fark = ` · tarayıcı ${tvFiyat} → fark %${yuzde.toFixed(1)}${yuzde > 8 ? " ⚠ ŞÜPHELİ" : ""}`;
    }
    const hafta = await fetchTvCandles(tamAd, "1w", 300).then((r) => r.candles.length).catch((e) => `✗ ${e.message}`);
    return `${tamAd} ✓ ${candles.length} günlük / ${hafta} haftalık mum, son ${son.close} ${currency ?? ""} (${new Date(son.openTime).toISOString().slice(0, 10)}), ${Date.now() - basladi} ms${fark}`;
  } catch (error) {
    return `${tamAd} ✗ ${error instanceof Error ? error.message : String(error)} (${Date.now() - basladi} ms)`;
  }
}


async function main() {
  // Mevcut piyasalar da aynı yoldan gelebilir mi?
  console.log("══ Mevcut piyasalar (grafik akışı) ══");
  for (const tam of ["NASDAQ:AAPL", "NYSE:JPM", "SP:SPX", "BIST:THYAO", "BIST:XU100", "COMEX:GC1!", "FX:USDTRY", "TVC:DXY"]) {
    console.log(`  ${await tvMum(tam)}`);
  }
  for (const aday of ADAYLAR) {
    console.log(`\n══ ${aday.ad} (${aday.yol} · ${aday.borsalar.join("/")}) ══`);
    try {
      const { toplam, satirlar } = await tara(aday);
      console.log(`Tarayıcı: ${toplam} hisse · tüm borsa: ${await tumBorsa(aday)}`);
      for (const [i, s] of satirlar.entries()) {
        const [ad, aciklama, kapanis, para, mod, deger, borsa] = s.d;
        console.log(
          `  ${String(i + 1).padStart(2)}. ${s.s.padEnd(18)} ${String(aciklama).slice(0, 34).padEnd(34)} ${kapanis} ${para} ${mod} · ${
            typeof deger === "number" ? `${(deger / 1e9).toFixed(0)} mlr` : "?"
          } · yahoo ${aday.yahoo(String(ad), String(borsa))}`,
        );
      }
      // İlk üç hissede mum geçmişi ve fiyat tutarlılığı (grafik akışı).
      for (const s of satirlar.slice(0, 3)) {
        console.log(`  TV mum: ${await tvMum(s.s, Number(s.d[2]))}`);
      }
      const [ilkAd, , ilkKapanis, , , , ilkBorsa] = satirlar[0].d;
      console.log(`  Yahoo: ${await yahoo(aday.yahoo(String(ilkAd), String(ilkBorsa)), Number(ilkKapanis))}`);
    } catch (error) {
      console.log(`Tarayıcı ✗ ${error instanceof Error ? error.message : String(error)}`);
    }
    for (const tam of aday.endeksTv) console.log(`  Endeks TV: ${await endeksTv(tam)}`);
    for (const tam of aday.endeksTv) console.log(`  Endeks TV mum: ${await tvMum(tam)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

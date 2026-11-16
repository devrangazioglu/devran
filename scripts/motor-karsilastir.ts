/**
 * Eski ve yeni sinyal motorunu aynı gerçek veride yarıştırır.
 *
 * "Yeni motor daha tutarlı" bir iddia; bu betik onu ölçüme çevirir. Her varlık
 * için iki motor da geçmişteki her mumda "o gün ne derdi" diye çalıştırılır
 * (yalnızca o güne kadarki veriyle) ve sonuç sonraki mumlarla karşılaştırılır.
 *
 * Ölçülenler:
 *   • kapsam      — mumların yüzde kaçında AL/SAT deniyor (gerisi BEKLE)
 *   • isabet      — sinyalden N mum sonra fiyat sinyal yönünde mi
 *   • taban       — sinyalden bağımsız, fiyatın o yöne gitme sıklığı
 *   • üstünlük    — isabet − taban; sıfırsa sinyal yazı-tura kadar bilgi taşır
 *   • getiri      — sinyal yönünde ortalama getiri
 *   • dönme       — ardışık mumlarda sinyal sınıfının değişme sıklığı
 *                   (yüksekse sinyal "titriyor" demektir)
 *   • trendde yön — güçlü trend mumlarında (ADX ≥ 30) trend yönünü söyleme oranı
 *
 * Çalıştırma (veritabanı ve anahtar gerektirmez):
 *   npm run motor-karsilastir
 */

import { analyze as yeniAnaliz } from "../lib/analysis";
import { adx } from "../lib/indicators";
import { fetchChart } from "../lib/markets/yahoo";
import type { Candle, Instrument, MarketId } from "../lib/markets/types";
import { analyze as eskiAnaliz } from "./eski-motor";

const UFUKLAR = [5, 10, 20];
const ISINMA = 210;
const ESIK = 18;

type Hedef = { market: MarketId; symbol: string; endeks: string | null };

const HEDEFLER: Hedef[] = [
  ...["THYAO.IS", "GARAN.IS", "ASELS.IS", "BIMAS.IS", "EREGL.IS", "KCHOL.IS", "SISE.IS", "TUPRS.IS"].map(
    (symbol): Hedef => ({ market: "bist", symbol, endeks: "XU100.IS" }),
  ),
  ...["AAPL", "MSFT", "NVDA", "AMZN", "JPM", "XOM", "KO", "TSLA"].map(
    (symbol): Hedef => ({ market: "abd", symbol, endeks: "^GSPC" }),
  ),
  ...["GC=F", "CL=F", "USDTRY=X", "EURUSD=X"].map(
    (symbol): Hedef => ({ market: "emtia", symbol, endeks: null }),
  ),
  // Kripto burada Yahoo sembolüyle çekilir: çalıştırıcı ABD'de ve Binance 451 veriyor.
  ...["BTC-USD", "ETH-USD", "SOL-USD"].map(
    (symbol): Hedef => ({ market: "kripto", symbol, endeks: symbol === "BTC-USD" ? null : "BTC-USD" }),
  ),
];

type Sayac = {
  mum: number;
  al: number;
  sat: number;
  donme: number;
  tersDonme: number;
  trendMum: number;
  trendDogru: number;
  trendTers: number;
  ufuk: Record<number, { alIsabet: number; satIsabet: number; alGetiri: number; satGetiri: number; yukari: number; asagi: number; n: number; alN: number; satN: number }>;
};

function bosSayac(): Sayac {
  const ufuk: Sayac["ufuk"] = {};
  for (const h of UFUKLAR) {
    ufuk[h] = { alIsabet: 0, satIsabet: 0, alGetiri: 0, satGetiri: 0, yukari: 0, asagi: 0, n: 0, alN: 0, satN: 0 };
  }
  return { mum: 0, al: 0, sat: 0, donme: 0, tersDonme: 0, trendMum: 0, trendDogru: 0, trendTers: 0, ufuk };
}

function topla(a: Sayac, b: Sayac): void {
  a.mum += b.mum;
  a.al += b.al;
  a.sat += b.sat;
  a.donme += b.donme;
  a.tersDonme += b.tersDonme;
  a.trendMum += b.trendMum;
  a.trendDogru += b.trendDogru;
  a.trendTers += b.trendTers;
  for (const h of UFUKLAR) {
    for (const k of Object.keys(a.ufuk[h]) as (keyof Sayac["ufuk"][number])[]) a.ufuk[h][k] += b.ufuk[h][k];
  }
}

const sinif = (skor: number) => (skor >= ESIK ? 1 : skor <= -ESIK ? -1 : 0);

function olc(skorlar: (number | null)[], mumlar: Candle[]): Sayac {
  const s = bosSayac();
  const kapanis = mumlar.map((c) => c.close);
  const yon = adx(
    mumlar.map((c) => c.high),
    mumlar.map((c) => c.low),
    kapanis,
    14,
  );

  let onceki: number | null = null;
  for (let i = ISINMA; i < mumlar.length; i++) {
    const skor = skorlar[i];
    if (skor === null) continue;
    const c = sinif(skor);
    s.mum++;
    if (c > 0) s.al++;
    if (c < 0) s.sat++;
    if (onceki !== null && onceki !== c) {
      s.donme++;
      if (onceki * c < 0) s.tersDonme++;
    }
    onceki = c;

    const a = yon.adx[i];
    const arti = yon.plusDI[i];
    const eksi = yon.minusDI[i];
    if (a !== null && arti !== null && eksi !== null && a >= 30) {
      const trendYonu = arti > eksi ? 1 : -1;
      s.trendMum++;
      if (c === trendYonu) s.trendDogru++;
      if (c === -trendYonu) s.trendTers++;
    }

    for (const h of UFUKLAR) {
      if (i + h >= mumlar.length) continue;
      const getiri = (kapanis[i + h] / kapanis[i] - 1) * 100;
      const u = s.ufuk[h];
      u.n++;
      if (getiri > 0) u.yukari++;
      if (getiri < 0) u.asagi++;
      if (c > 0) {
        u.alN++;
        u.alGetiri += getiri;
        if (getiri > 0) u.alIsabet++;
      } else if (c < 0) {
        u.satN++;
        u.satGetiri -= getiri;
        if (getiri < 0) u.satIsabet++;
      }
    }
  }
  return s;
}

const yuzde = (pay: number, payda: number) => (payda === 0 ? "   —" : `${((pay / payda) * 100).toFixed(1).padStart(5)}%`);

function rapor(ad: string, s: Sayac): void {
  console.log(`\n── ${ad} ─────────────────────────────────────────`);
  console.log(`mum ${s.mum} · AL ${yuzde(s.al, s.mum)} · SAT ${yuzde(s.sat, s.mum)} · kapsam ${yuzde(s.al + s.sat, s.mum)}`);
  console.log(`sinyal dönme sıklığı ${yuzde(s.donme, s.mum)} · doğrudan AL↔SAT dönüşü ${s.tersDonme}`);
  console.log(
    `güçlü trend mumları ${s.trendMum}: trend yönünü söyledi ${yuzde(s.trendDogru, s.trendMum)} · tersini söyledi ${yuzde(s.trendTers, s.trendMum)} · bekle dedi ${yuzde(s.trendMum - s.trendDogru - s.trendTers, s.trendMum)}`,
  );
  for (const h of UFUKLAR) {
    const u = s.ufuk[h];
    const alTaban = u.yukari / Math.max(u.n, 1);
    const satTaban = u.asagi / Math.max(u.n, 1);
    const alIsabet = u.alIsabet / Math.max(u.alN, 1);
    const satIsabet = u.satIsabet / Math.max(u.satN, 1);
    const toplamUstunluk =
      ((alIsabet - alTaban) * u.alN + (satIsabet - satTaban) * u.satN) / Math.max(u.alN + u.satN, 1);
    console.log(
      `  ${String(h).padStart(2)} mum · AL isabet ${yuzde(u.alIsabet, u.alN)} (taban ${(alTaban * 100).toFixed(1)}%, n=${u.alN}, ort ${(u.alGetiri / Math.max(u.alN, 1)).toFixed(2)}%)` +
        ` · SAT isabet ${yuzde(u.satIsabet, u.satN)} (taban ${(satTaban * 100).toFixed(1)}%, n=${u.satN}, ort ${(u.satGetiri / Math.max(u.satN, 1)).toFixed(2)}%)` +
        ` · üstünlük ${(toplamUstunluk * 100).toFixed(2)} puan`,
    );
  }
}

async function main(): Promise<void> {
  const endeksler = new Map<string, Candle[]>();
  for (const symbol of new Set(HEDEFLER.map((h) => h.endeks).filter((e): e is string => e !== null))) {
    try {
      endeksler.set(symbol, (await fetchChart(symbol, "1d", 1000)).candles);
    } catch (error) {
      console.log(`endeks alınamadı: ${symbol} — ${error instanceof Error ? error.message : error}`);
    }
  }

  const eskiToplam = bosSayac();
  const yeniToplam = bosSayac();
  const piyasaBazinda = new Map<MarketId, { eski: Sayac; yeni: Sayac }>();

  for (const hedef of HEDEFLER) {
    let mumlar: Candle[];
    try {
      mumlar = (await fetchChart(hedef.symbol, "1d", 1000)).candles;
    } catch (error) {
      console.log(`✗ ${hedef.symbol}: ${error instanceof Error ? error.message : error}`);
      continue;
    }
    if (mumlar.length < ISINMA + 60) {
      console.log(`✗ ${hedef.symbol}: yetersiz veri (${mumlar.length} mum)`);
      continue;
    }

    const instrument: Instrument = {
      id: `${hedef.market}:${hedef.symbol}`,
      market: hedef.market,
      symbol: hedef.symbol,
      name: hedef.symbol,
      ticker: hedef.symbol,
      currency: "USD",
      kind: "hisse",
    };
    const endeks = hedef.endeks ? endeksler.get(hedef.endeks) : undefined;

    const eskiSkor: (number | null)[] = new Array(mumlar.length).fill(null);
    const yeniSkor: (number | null)[] = new Array(mumlar.length).fill(null);
    for (let i = ISINMA; i < mumlar.length; i++) {
      // Her iki motor da yalnızca o güne kadarki mumları görür. Canlıda
      // analiz en çok 300 mumla yapıldığı için pencere de 300 ile sınırlanır.
      const dilim = mumlar.slice(Math.max(0, i + 1 - 300), i + 1);
      eskiSkor[i] = eskiAnaliz(instrument, "1d", dilim, "canli").score;
      yeniSkor[i] = yeniAnaliz(instrument, "1d", dilim, "canli", {
        backtest: false,
        benchmark: endeks ? { ticker: hedef.endeks as string, candles: endeks } : null,
      }).score;
    }

    const eski = olc(eskiSkor, mumlar);
    const yeni = olc(yeniSkor, mumlar);
    topla(eskiToplam, eski);
    topla(yeniToplam, yeni);
    const p = piyasaBazinda.get(hedef.market) ?? { eski: bosSayac(), yeni: bosSayac() };
    topla(p.eski, eski);
    topla(p.yeni, yeni);
    piyasaBazinda.set(hedef.market, p);

    const u = (s: Sayac) => {
      const x = s.ufuk[10];
      const taban = (x.yukari / Math.max(x.n, 1)) * 100;
      return `kapsam ${yuzde(s.al + s.sat, s.mum)} AL ${yuzde(x.alIsabet, x.alN)}/${taban.toFixed(0)}% dönme ${yuzde(s.donme, s.mum)}`;
    };
    console.log(`✓ ${hedef.symbol.padEnd(10)} ${mumlar.length} mum · eski: ${u(eski)} · yeni: ${u(yeni)}`);
  }

  for (const [market, p] of piyasaBazinda) {
    rapor(`${market} — ESKİ`, p.eski);
    rapor(`${market} — YENİ`, p.yeni);
  }
  rapor("TOPLAM — ESKİ MOTOR", eskiToplam);
  rapor("TOPLAM — YENİ MOTOR", yeniToplam);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

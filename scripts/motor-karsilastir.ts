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

import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

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
  ...[
    "THYAO.IS", "GARAN.IS", "ASELS.IS", "BIMAS.IS", "EREGL.IS", "KCHOL.IS",
    "SISE.IS", "TUPRS.IS", "AKBNK.IS", "FROTO.IS", "TCELL.IS", "SAHOL.IS",
  ].map((symbol): Hedef => ({ market: "bist", symbol, endeks: "XU100.IS" })),
  ...[
    "AAPL", "MSFT", "NVDA", "AMZN", "JPM", "XOM", "KO", "TSLA", "META", "WMT", "JNJ", "BA",
  ].map((symbol): Hedef => ({ market: "abd", symbol, endeks: "^GSPC" })),
  ...["GC=F", "SI=F", "CL=F", "USDTRY=X", "EURUSD=X", "GBPUSD=X"].map(
    (symbol): Hedef => ({ market: "emtia", symbol, endeks: null }),
  ),
  // Kripto burada Yahoo sembolüyle çekilir: çalıştırıcı ABD'de ve Binance 451 veriyor.
  ...["BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD"].map(
    (symbol): Hedef => ({ market: "kripto", symbol, endeks: symbol === "BTC-USD" ? null : "BTC-USD" }),
  ),
];

/**
 * İstekler arası bekleme. Aktarıcı dakikada yaklaşık 20 istekten sonra
 * kısıtlıyor (ölçüldü: 25. sembolde hız sınırı); 3,5 saniye aralık sınırın
 * altında kalır.
 */
const ISTEK_ARASI_MS = 3_500;
const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Veri kaynağı: ağ ya da dosya.
 *
 * Geliştirme ortamının ağı piyasa verisine kapalı; ayar denemelerini her
 * seferinde uzak makinede çalıştırmak dakikalar sürüyor. `MUM_DOK=1` ile
 * çekilen mumlar kütüğe yazılır, `MUM_DOSYASI` ile o dökümden okunur; böylece
 * aynı gerçek veriyle yerelde saniyeler içinde yeniden ölçülebilir.
 */
const DOSYA = process.env.MUM_DOSYASI;
const dosyaVerisi: Record<string, Candle[]> | null = DOSYA
  ? (JSON.parse(readFileSync(DOSYA, "utf8")) as Record<string, Candle[]>)
  : null;

async function mumGetir(symbol: string): Promise<Candle[]> {
  if (dosyaVerisi) {
    const mumlar = dosyaVerisi[symbol];
    if (!mumlar) throw new Error("dökümde yok");
    return mumlar;
  }
  await bekle(ISTEK_ARASI_MS);
  const mumlar = (await fetchChart(symbol, "1d", 1000)).candles;
  if (process.env.MUM_DOK === "1") {
    // Sıkıştırılmış ve satırlara bölünmüş: kütük satırları çok uzun olmasın.
    const ham = JSON.stringify(mumlar.map((c) => [c.openTime, c.open, c.high, c.low, c.close, c.volume]));
    const b64 = gzipSync(Buffer.from(ham)).toString("base64");
    for (let k = 0; k * 3000 < b64.length; k++) {
      console.log(`MUM|${symbol}|${k}|${b64.slice(k * 3000, (k + 1) * 3000)}`);
    }
  }
  return mumlar;
}

/* ── Bileşen ölçümü ────────────────────────────────────────────────
 *
 * Bütün skorun üstünlüğü sıfıra yakın çıktı; hangi parçanın bilgi taşıdığını
 * görmek için her gösterge ayrı ayrı ölçülür. Getiri, varlıklar arasında
 * kıyaslanabilsin diye oynaklık birimine çevrilir (getiri / ATR%·√ufuk).
 */
type Bilesen = { alN: number; alToplam: number; satN: number; satToplam: number };
const BILESEN_UFKU = 10;
const bilesenler = new Map<string, Map<string, Bilesen>>(); // grup → gösterge → sayaç
const grupTaban = new Map<string, { n: number; toplam: number }>();

function grupAdi(market: MarketId): string {
  return market === "bist" || market === "abd" ? "hisse" : market;
}

function bilesenEkle(grup: string, kimlik: string, yon: number, z: number): void {
  let g = bilesenler.get(grup);
  if (!g) bilesenler.set(grup, (g = new Map()));
  let b = g.get(kimlik);
  if (!b) g.set(kimlik, (b = { alN: 0, alToplam: 0, satN: 0, satToplam: 0 }));
  if (yon > 0) {
    b.alN++;
    b.alToplam += z;
  } else if (yon < 0) {
    b.satN++;
    b.satToplam += z;
  }
}

function bilesenRaporu(): void {
  for (const [grup, g] of bilesenler) {
    const taban = grupTaban.get(grup);
    const ort = taban && taban.n > 0 ? taban.toplam / taban.n : 0;
    console.log(`\n── BİLEŞENLER — ${grup} (taban ortalama ${ort.toFixed(3)}σ, n=${taban?.n ?? 0}) ──`);
    console.log(`${"gösterge".padEnd(26)}${"AL n".padStart(7)}${"AL ort".padStart(9)}${"SAT n".padStart(7)}${"SAT ort".padStart(9)}${"fark".padStart(9)}`);
    const satirlar = [...g.entries()].map(([kimlik, b]) => {
      const al = b.alN > 0 ? b.alToplam / b.alN : NaN;
      const sat = b.satN > 0 ? b.satToplam / b.satN : NaN;
      return { kimlik, b, al, sat, fark: al - sat };
    });
    satirlar.sort((x, y) => (Number.isNaN(y.fark) ? -1 : y.fark) - (Number.isNaN(x.fark) ? -1 : x.fark));
    for (const r of satirlar) {
      console.log(
        `${r.kimlik.padEnd(26)}${String(r.b.alN).padStart(7)}${r.al.toFixed(3).padStart(9)}${String(r.b.satN).padStart(7)}${r.sat.toFixed(3).padStart(9)}${r.fark.toFixed(3).padStart(9)}`,
      );
    }
  }
}

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

/**
 * Dönem bölmesi: `BOLME=ilk` ya da `BOLME=son` verilirse her varlığın yalnızca
 * ilk ya da son yarısı ölçülür. Bir etki iki yarıda da aynı yönde çıkmıyorsa
 * büyük olasılıkla gürültüdür; ağırlıklar ancak ikisinde de görünen etkilere
 * göre ayarlanır.
 */
const BOLME = process.env.BOLME;
function aralik(uzunluk: number): [number, number] {
  const orta = ISINMA + Math.floor((uzunluk - ISINMA) / 2);
  if (BOLME === "ilk") return [ISINMA, orta];
  if (BOLME === "son") return [orta, uzunluk];
  return [ISINMA, uzunluk];
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
  const [bas, son] = aralik(mumlar.length);
  for (let i = bas; i < son; i++) {
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
      endeksler.set(symbol, await mumGetir(symbol));
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
      mumlar = await mumGetir(hedef.symbol);
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
      // Motor varlık sınıfına göre profil seçiyor; tür gerçek olmalı.
      kind:
        hedef.market === "kripto"
          ? "kripto"
          : hedef.market === "emtia"
            ? hedef.symbol.endsWith("=X")
              ? "doviz"
              : "emtia"
            : "hisse",
    };
    const endeks = hedef.endeks ? endeksler.get(hedef.endeks) : undefined;

    const eskiSkor: (number | null)[] = new Array(mumlar.length).fill(null);
    const yeniSkor: (number | null)[] = new Array(mumlar.length).fill(null);
    const [bas, son] = aralik(mumlar.length);
    for (let i = bas; i < son; i++) {
      // Her iki motor da yalnızca o güne kadarki mumları görür. Canlıda
      // analiz en çok 300 mumla yapıldığı için pencere de 300 ile sınırlanır.
      const dilim = mumlar.slice(Math.max(0, i + 1 - 300), i + 1);
      eskiSkor[i] = eskiAnaliz(instrument, "1d", dilim, "canli").score;
      const sonuc = yeniAnaliz(instrument, "1d", dilim, "canli", {
        backtest: false,
        benchmark: endeks ? { ticker: hedef.endeks as string, candles: endeks } : null,
      });
      yeniSkor[i] = sonuc.score;

      if (i + BILESEN_UFKU < mumlar.length) {
        const getiri = (mumlar[i + BILESEN_UFKU].close / mumlar[i].close - 1) * 100;
        const z = getiri / (Math.max(sonuc.volatility.atrPercent, 0.05) * Math.sqrt(BILESEN_UFKU));
        const grup = grupAdi(hedef.market);
        const t = grupTaban.get(grup) ?? { n: 0, toplam: 0 };
        t.n++;
        t.toplam += z;
        grupTaban.set(grup, t);

        for (const check of sonuc.checks) {
          bilesenEkle(grup, check.id, check.verdict === "BUY" ? 1 : check.verdict === "SELL" ? -1 : 0, z);
        }
        // Aday özellikler: motor bunları henüz kullanmıyor; kullanılmaya
        // değer mi diye ölçülüyor.
        const g = sonuc.indicators;
        const fiyat = sonuc.price;
        const atr = g.atr ?? fiyat * 0.02;
        const uzunYukari = g.ema200 !== null && fiyat > g.ema200;
        const uzunAsagi = g.ema200 !== null && fiyat < g.ema200;
        bilesenEkle(grup, "~uzun-trend(ema200)", uzunYukari ? 1 : uzunAsagi ? -1 : 0, z);
        if (g.rsi !== null) {
          bilesenEkle(grup, "~yukari+rsi<45", uzunYukari && g.rsi < 45 ? 1 : 0, z);
          bilesenEkle(grup, "~yukari+rsi<35", uzunYukari && g.rsi < 35 ? 1 : 0, z);
          bilesenEkle(grup, "~yukari+rsi>70", uzunYukari && g.rsi > 70 ? 1 : 0, z);
          bilesenEkle(grup, "~asagi+rsi>55", uzunAsagi && g.rsi > 55 ? -1 : 0, z);
          bilesenEkle(grup, "~asagi+rsi<30", uzunAsagi && g.rsi < 30 ? -1 : 0, z);
          bilesenEkle(grup, "~rsi<30(hepsi)", g.rsi < 30 ? 1 : g.rsi > 70 ? -1 : 0, z);
        }
        if (g.ema21 !== null) {
          const uzama = (fiyat - g.ema21) / atr;
          bilesenEkle(grup, "~uzama>2atr(ters)", uzama > 2 ? -1 : uzama < -2 ? 1 : 0, z);
          bilesenEkle(grup, "~uzama>3atr(ters)", uzama > 3 ? -1 : uzama < -3 ? 1 : 0, z);
        }
        if (dilim.length > 130) {
          const m6 = fiyat / dilim[dilim.length - 127].close - 1;
          const m1 = fiyat / dilim[dilim.length - 22].close - 1;
          bilesenEkle(grup, "~momentum-6ay", m6 > 0.05 ? 1 : m6 < -0.05 ? -1 : 0, z);
          bilesenEkle(grup, "~momentum-6ay-1ay", m6 - m1 > 0.05 ? 1 : m6 - m1 < -0.05 ? -1 : 0, z);
          const g5 = (fiyat / dilim[dilim.length - 6].close - 1) * 100;
          const z5 = g5 / (Math.max(sonuc.volatility.atrPercent, 0.05) * Math.sqrt(5));
          bilesenEkle(grup, "~5gun-dusus(ters)", z5 < -1 ? 1 : z5 > 1 ? -1 : 0, z);
          bilesenEkle(grup, "~yukari+5gun-dusus", uzunYukari && z5 < -1 ? 1 : 0, z);
        }
        bilesenEkle(grup, "~rejim-yonu", sonuc.regime.key === "regime.up" ? 1 : sonuc.regime.key === "regime.down" ? -1 : 0, z);
      }
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
  bilesenRaporu();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * Canlı doğruluk ölçümü (sinyal günlüğü).
 *
 * Geçmiş veriyle yapılan ölçüm ne kadar dikkatli kurulursa kurulsun, motorun
 * ayarları aynı veriye bakılarak seçildiği için iyimser kalır. Gerçek doğruluk
 * ancak **geleceğe** bakılarak ölçülür: bugün verilen sinyal bugün yazılır,
 * değiştirilemez, 10 işlem günü sonra fiyatın ne yaptığı yanına eklenir.
 *
 * Kurallar (sonuçları güvenilir kılan şey bunlar):
 *   • Liste sabittir. Kayıt "iyi görünen" varlıklardan seçilmez.
 *   • BEKLE dahil her sinyal yazılır. Taban oran (sinyal olmasa da fiyatın
 *     yükselme sıklığı) bu kayıtlardan hesaplanır; isabetin anlamı ancak
 *     onunla kıyaslanınca ortaya çıkar.
 *   • Bir kayıt yazıldıktan sonra yalnızca sonuç alanları doldurulur.
 *   • Sinyal, kapanmış günlük mumdan üretilir; oluşmakta olan mum kullanılmaz.
 *
 * Kayıt günde bir kez, zamanlanmış görevle yapılır (bkz. `vercel.json`,
 * `app/api/sinyal-gunlugu/route.ts`). Veritabanı yoksa (yerel geliştirme)
 * kayıtlar bir JSON dosyasına yazılır.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import { analyze, isBuySignal, isSellSignal, type SignalLabel } from "./analysis";
import { ensureSchema, postgresEnabled, query } from "./db";
import { analizBaglami } from "./markets/baglam";
import { getCandles } from "./markets/provider";
import type { Candle, MarketId } from "./markets/types";

/** Sonucun ölçüldüğü ufuk: sinyalden kaç günlük mum sonra. */
export const UFUK = 10;

/**
 * Takip edilen varlıklar. Her piyasadan işlem hacmi yüksek, verisi sürekli
 * gelen semboller; hangisinin "iyi sonuç verdiğine" bakılarak seçilmedi.
 */
export const TAKIP_LISTESI: { market: MarketId; symbol: string }[] = [
  ...["THYAO", "GARAN", "ASELS", "BIMAS", "AKBNK", "KCHOL", "EREGL", "TUPRS"].map((s) => ({
    market: "bist" as const,
    symbol: `${s}.IS`,
  })),
  ...["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "JPM", "TSLA"].map((symbol) => ({
    market: "abd" as const,
    symbol,
  })),
  ...["GC=F", "CL=F", "USDTRY=X", "EURUSD=X"].map((symbol) => ({ market: "emtia" as const, symbol })),
  ...["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"].map((symbol) => ({
    market: "kripto" as const,
    symbol,
  })),
];

export type Kayit = {
  id: string;
  /** Sinyalin üretildiği günlük mumun tarihi (YYYY-AA-GG, UTC). */
  tarih: string;
  market: MarketId;
  symbol: string;
  ticker: string;
  sinyal: SignalLabel;
  skor: number;
  guven: number;
  fiyat: number;
  mumZamani: number;
  kaydedildi: number;
  sonucFiyat: number | null;
  sonucZamani: number | null;
  /** Yüzde. */
  getiri: number | null;
};

/* ────────────────────────── Depo ────────────────────────── */

type Satir = {
  id: string;
  tarih: string;
  market: string;
  symbol: string;
  ticker: string;
  sinyal: string;
  skor: number;
  guven: number;
  fiyat: number;
  mum_zamani: string;
  kaydedildi: string;
  sonuc_fiyat: number | null;
  sonuc_zamani: string | null;
  getiri: number | null;
};

function satirdan(s: Satir): Kayit {
  return {
    id: s.id,
    tarih: s.tarih,
    market: s.market as MarketId,
    symbol: s.symbol,
    ticker: s.ticker,
    sinyal: s.sinyal as SignalLabel,
    skor: Number(s.skor),
    guven: Number(s.guven),
    fiyat: Number(s.fiyat),
    mumZamani: Number(s.mum_zamani),
    kaydedildi: Number(s.kaydedildi),
    sonucFiyat: s.sonuc_fiyat === null ? null : Number(s.sonuc_fiyat),
    sonucZamani: s.sonuc_zamani === null ? null : Number(s.sonuc_zamani),
    getiri: s.getiri === null ? null : Number(s.getiri),
  };
}

function dosyaYolu(): string {
  return process.env.SINYAL_GUNLUGU_FILE ?? path.join(process.cwd(), "data", "sinyal-gunlugu.json");
}

async function dosyaOku(): Promise<Kayit[]> {
  try {
    return JSON.parse(await fs.readFile(dosyaYolu(), "utf8")) as Kayit[];
  } catch {
    return [];
  }
}

async function dosyaYaz(kayitlar: Kayit[]): Promise<void> {
  await fs.mkdir(path.dirname(dosyaYolu()), { recursive: true });
  await fs.writeFile(dosyaYolu(), JSON.stringify(kayitlar, null, 1));
}

/** Bütün kayıtlar, eskiden yeniye. */
export async function kayitlariOku(): Promise<Kayit[]> {
  if (!postgresEnabled()) {
    return (await dosyaOku()).sort((a, b) => a.mumZamani - b.mumZamani);
  }
  await ensureSchema();
  const satirlar = await query<Satir>("select * from sinyal_gunlugu order by mum_zamani asc, id asc");
  return satirlar.map(satirdan);
}

/** Yeni kayıt ekler; aynı gün ve varlık zaten varsa dokunmaz. */
async function ekle(kayit: Kayit): Promise<boolean> {
  if (!postgresEnabled()) {
    const kayitlar = await dosyaOku();
    if (kayitlar.some((k) => k.id === kayit.id)) return false;
    kayitlar.push(kayit);
    await dosyaYaz(kayitlar);
    return true;
  }
  const sonuc = await query<{ id: string }>(
    `insert into sinyal_gunlugu
       (id, tarih, market, symbol, ticker, sinyal, skor, guven, fiyat, mum_zamani, kaydedildi)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     on conflict (id) do nothing
     returning id`,
    [
      kayit.id,
      kayit.tarih,
      kayit.market,
      kayit.symbol,
      kayit.ticker,
      kayit.sinyal,
      kayit.skor,
      kayit.guven,
      kayit.fiyat,
      kayit.mumZamani,
      kayit.kaydedildi,
    ],
  );
  return sonuc.length > 0;
}

/** Yalnızca sonuç alanlarını yazar; sinyalin kendisi asla değişmez. */
async function sonucYaz(id: string, fiyat: number, zaman: number, getiri: number): Promise<void> {
  if (!postgresEnabled()) {
    const kayitlar = await dosyaOku();
    const kayit = kayitlar.find((k) => k.id === id);
    if (kayit && kayit.sonucFiyat === null) {
      kayit.sonucFiyat = fiyat;
      kayit.sonucZamani = zaman;
      kayit.getiri = getiri;
      await dosyaYaz(kayitlar);
    }
    return;
  }
  await query(
    `update sinyal_gunlugu set sonuc_fiyat = $2, sonuc_zamani = $3, getiri = $4
     where id = $1 and sonuc_fiyat is null`,
    [id, fiyat, zaman, getiri],
  );
}

/* ────────────────────────── Kayıt ve değerlendirme ────────────────────────── */

const GUN_MS = 86_400_000;

function gunu(zaman: number): string {
  return new Date(zaman).toISOString().slice(0, 10);
}

/** Borsa ve emtiada günün kapanmış sayıldığı an (UTC): ABD seansı 21:00'de biter. */
const SEANS_SONU_DK = 21 * 60 + 30;

/**
 * Yalnızca kapanmış günlük mumlar.
 *
 * Kriptonun günlük mumu UTC gece yarısı kapanır. Borsa ve emtiada bugünün mumu,
 * seanslar bitene (21:30 UTC) kadar oluşmaktadır. Oluşan mumdan üretilen sinyal
 * gün içinde değişir; kayda geçen sinyal ise değişmemeli. Bu yüzden oluşmakta
 * olan mum atılır ve kayıt bir önceki kapanmış güne yapılır.
 */
export function kapanmisMumlar(market: MarketId, mumlar: Candle[], simdi = Date.now()): Candle[] {
  if (mumlar.length === 0) return mumlar;
  const son = mumlar[mumlar.length - 1];
  if (market === "kripto") {
    return son.openTime + GUN_MS > simdi ? mumlar.slice(0, -1) : mumlar;
  }
  const an = new Date(simdi);
  const dakika = an.getUTCHours() * 60 + an.getUTCMinutes();
  const bugun = gunu(son.openTime) === gunu(simdi);
  return bugun && dakika < SEANS_SONU_DK ? mumlar.slice(0, -1) : mumlar;
}

/**
 * Bekleyen kayıtların sonucunu, aynı varlığın güncel mumlarından doldurur.
 * Sonuç, sinyal mumundan tam `UFUK` mum sonraki kapanıştır.
 */
export function sonuclariBul(
  bekleyenler: Kayit[],
  mumlar: Candle[],
): { id: string; fiyat: number; zaman: number; getiri: number }[] {
  const out: { id: string; fiyat: number; zaman: number; getiri: number }[] = [];
  for (const kayit of bekleyenler) {
    const index = mumlar.findIndex((m) => m.openTime === kayit.mumZamani);
    if (index < 0 || index + UFUK >= mumlar.length) continue;
    const hedef = mumlar[index + UFUK];
    out.push({
      id: kayit.id,
      fiyat: hedef.close,
      zaman: hedef.openTime,
      getiri: (hedef.close / kayit.fiyat - 1) * 100,
    });
  }
  return out;
}

export type CalismaSonucu = {
  yeni: number;
  degerlendirilen: number;
  atlanan: number;
  hatalar: string[];
  sureMs: number;
  bitti: boolean;
};

const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Günlük çalışma: her varlık için bugünün sinyalini yazar ve vadesi gelen
 * eski kayıtların sonucunu doldurur.
 *
 * `butceMs` dolunca durur: sunucusuz işlevin süresi sınırlı. Bugün kaydı
 * yazılmış varlıklar atlandığı için ikinci bir çalışma kaldığı yerden devam
 * eder (görev günde iki kez zamanlanmıştır).
 */
export async function gunlukCalisma(butceMs = 45_000): Promise<CalismaSonucu> {
  const basla = Date.now();
  const sonuc: CalismaSonucu = { yeni: 0, degerlendirilen: 0, atlanan: 0, hatalar: [], sureMs: 0, bitti: true };

  const kayitlar = await kayitlariOku();
  const bugunYazilan = new Set(
    kayitlar.filter((k) => basla - k.kaydedildi < 20 * 3_600_000).map((k) => `${k.market}:${k.symbol}`),
  );

  // Bugün işlenmemiş olanlar önce: bir önceki çalışma yarıda kaldıysa
  // ikincisi baştan değil, kaldığı yerden başlar.
  const sira = [...TAKIP_LISTESI].sort(
    (a, b) =>
      Number(bugunYazilan.has(`${a.market}:${a.symbol}`)) -
      Number(bugunYazilan.has(`${b.market}:${b.symbol}`)),
  );

  for (const varlik of sira) {
    if (Date.now() - basla > butceMs) {
      sonuc.bitti = false;
      break;
    }
    const anahtar = `${varlik.market}:${varlik.symbol}`;
    const bekleyenler = kayitlar.filter(
      (k) => k.market === varlik.market && k.symbol === varlik.symbol && k.sonucFiyat === null,
    );
    if (bugunYazilan.has(anahtar) && bekleyenler.length === 0) {
      sonuc.atlanan++;
      continue;
    }

    const istekBasi = Date.now();
    try {
      const set = await getCandles(varlik.market, varlik.symbol, "1d", 300);
      if (set.source === "demo") throw new Error("demo veri; kayıt yapılmaz");
      const mumlar = kapanmisMumlar(varlik.market, set.candles);
      if (mumlar.length < 60) throw new Error(`yetersiz veri (${mumlar.length} mum)`);

      for (const s of sonuclariBul(bekleyenler, mumlar)) {
        await sonucYaz(s.id, s.fiyat, s.zaman, s.getiri);
        sonuc.degerlendirilen++;
      }

      const son = mumlar[mumlar.length - 1];
      const id = `${gunu(son.openTime)}:${anahtar}`;
      if (!kayitlar.some((k) => k.id === id)) {
        const analiz = analyze(
          set.instrument,
          "1d",
          mumlar,
          set.source,
          await analizBaglami(set.instrument, "1d"),
        );
        const eklendi = await ekle({
          id,
          tarih: gunu(son.openTime),
          market: varlik.market,
          symbol: varlik.symbol,
          ticker: set.instrument.ticker,
          sinyal: analiz.signal,
          skor: analiz.score,
          guven: analiz.confidence,
          fiyat: son.close,
          mumZamani: son.openTime,
          kaydedildi: Date.now(),
          sonucFiyat: null,
          sonucZamani: null,
          getiri: null,
        });
        if (eklendi) sonuc.yeni++;
      }

      // Veri kaynaktan yeni çekildiyse aktarıcının hız sınırına (dakikada
      // ~20 istek) saygı için kısa bir ara. Önbellekten geldiyse gerek yok.
      if (varlik.market !== "kripto" && set.fetchedAt && set.fetchedAt >= istekBasi) {
        await bekle(3_000);
      }
    } catch (error) {
      sonuc.hatalar.push(`${anahtar}: ${error instanceof Error ? error.message : "bilinmeyen hata"}`);
    }
  }

  sonuc.sureMs = Date.now() - basla;
  return sonuc;
}

/* ────────────────────────── İstatistik ────────────────────────── */

export type YonOzeti = {
  /** Sonucu belli olan sinyal sayısı. */
  n: number;
  tutan: number;
  /** 0–1; n = 0 ise null. */
  oran: number | null;
  /** Sinyalsiz taban oran (0–1). */
  taban: number | null;
  /** Sinyal yönünde ortalama getiri (%). */
  ortalama: number | null;
};

export type Istatistik = {
  baslangic: string | null;
  toplam: number;
  degerlendirilen: number;
  bekleyen: number;
  /** İlk sonuçların beklendiği yaklaşık tarih (henüz sonuç yoksa). */
  ilkSonuc: string | null;
  al: YonOzeti;
  sat: YonOzeti;
  bekle: { n: number };
  piyasalar: { market: MarketId; al: YonOzeti; sat: YonOzeti }[];
  son: Kayit[];
};

function ozet(kayitlar: Kayit[], yon: 1 | -1, hepsi: Kayit[]): YonOzeti {
  const sonuclu = kayitlar.filter((k) => k.getiri !== null);
  const tumSonuclu = hepsi.filter((k) => k.getiri !== null);
  const tutan = sonuclu.filter((k) => (k.getiri as number) * yon > 0).length;
  const tabanTutan = tumSonuclu.filter((k) => (k.getiri as number) * yon > 0).length;
  return {
    n: sonuclu.length,
    tutan,
    oran: sonuclu.length ? tutan / sonuclu.length : null,
    taban: tumSonuclu.length ? tabanTutan / tumSonuclu.length : null,
    ortalama: sonuclu.length
      ? sonuclu.reduce((t, k) => t + (k.getiri as number) * yon, 0) / sonuclu.length
      : null,
  };
}

/** İş günü ekler (hafta sonu atlanır); ilk sonucun tahmini tarihi için. */
function isGunuEkle(tarih: string, gun: number): string {
  const d = new Date(`${tarih}T12:00:00Z`);
  let kalan = gun;
  while (kalan > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const g = d.getUTCDay();
    if (g !== 0 && g !== 6) kalan--;
  }
  return d.toISOString().slice(0, 10);
}

export function istatistikHesapla(kayitlar: Kayit[]): Istatistik {
  const alKayit = kayitlar.filter((k) => isBuySignal(k.sinyal));
  const satKayit = kayitlar.filter((k) => isSellSignal(k.sinyal));
  const degerlendirilen = kayitlar.filter((k) => k.getiri !== null).length;
  const baslangic = kayitlar.length ? kayitlar[0].tarih : null;

  const piyasalar = (["bist", "abd", "emtia", "kripto"] as MarketId[])
    .map((market) => {
      const p = kayitlar.filter((k) => k.market === market);
      return {
        market,
        al: ozet(p.filter((k) => isBuySignal(k.sinyal)), 1, p),
        sat: ozet(p.filter((k) => isSellSignal(k.sinyal)), -1, p),
      };
    })
    .filter((p) => p.al.n + p.sat.n > 0);

  return {
    baslangic,
    toplam: kayitlar.length,
    degerlendirilen,
    bekleyen: kayitlar.length - degerlendirilen,
    ilkSonuc: degerlendirilen === 0 && baslangic ? isGunuEkle(baslangic, UFUK + 1) : null,
    al: ozet(alKayit, 1, kayitlar),
    sat: ozet(satKayit, -1, kayitlar),
    bekle: { n: kayitlar.filter((k) => k.sinyal === "WAIT").length },
    piyasalar,
    son: [...kayitlar].sort((a, b) => b.mumZamani - a.mumZamani || a.id.localeCompare(b.id)).slice(0, 48),
  };
}

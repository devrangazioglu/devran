/**
 * Piyasa verisini veritabanına doldurur (günlük besleme).
 *
 * Neden ayrı bir betik: kripto dışı veriyi web sunucusundan çekmek iki duvara
 * çarpıyor. Anahtarsız kaynaklar (Yahoo, Stooq) Vercel'in IP aralığını
 * engelliyor — ölçüldü, sırasıyla 429 ve CSV yerine HTML engel sayfası. Anahtar
 * isteyen kaynak ise ücretsiz katmanda günde 800 kredi veriyor ve tek bir gün
 * içinde bitiyor.
 *
 * Bu betik ikisini de aşar: uygulamanın çalıştığı yerden değil, **başka bir
 * makineden** (GitHub Actions) çalışır ve sonucu doğrudan paylaşımlı önbelleğe
 * yazar. Site zaten önce oraya bakıyor; tablo doluysa hiçbir sağlayıcıya
 * gitmiyor. Böylece kota kavramı tamamen ortadan kalkar.
 *
 * Günlük mumlar günde bir değiştiği için günde bir çalışması yeterli.
 *
 * Çalıştırma:
 *   DATABASE_URL=... npm run besle              # tüm piyasalar
 *   DATABASE_URL=... npm run besle -- abd bist  # seçili piyasalar
 */

import { closePool, ensureSchema, postgresEnabled, query } from "../lib/db";
import { staticInstruments } from "../lib/markets/instruments";
import { MARKET_IDS, type Candle, type Instrument, type Interval, type MarketId } from "../lib/markets/types";

/** Beslenen mum sayısı: göstergeler için 300 fazlasıyla yeter. */
const MUM_SAYISI = 300;

/**
 * Beslenen periyotlar.
 *
 * Haftalık da yazılır: analiz sayfası üst zaman dilimi uyumunu haftalık mumdan
 * hesaplıyor. Yalnızca günlük beslendiğinde site her analizde haftalık için
 * sağlayıcıya gidiyor ve kotayı orada harcıyordu — ölçüldü.
 */
const PERIYOTLAR: { interval: Interval; aralik: string; adim: string }[] = [
  { interval: "1d", aralik: "2y", adim: "1d" },
  { interval: "1w", aralik: "10y", adim: "1wk" },
];

/**
 * Kaydın "taze" sayılacağı süre.
 *
 * Bir sonraki beslemeye kadar geçerli kalmalı, yoksa site aradaki boşlukta
 * yeniden sağlayıcıya gider. Günlük beslemede 26 saat, bir çalışmanın
 * atlanmasına da tolerans bırakır.
 */
const TAZELIK_MS = 26 * 60 * 60_000;

/** Sağlayıcıyı yormamak için: aynı anda kaç sembol ve her tur arası bekleme. */
const ESZAMANLI = 4;
const TUR_ARASI_MS = 250;

const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ────────────────────────── Kaynak ────────────────────────── */

type ChartYanit = {
  chart?: {
    result?: {
      meta?: { currency?: string; longName?: string; shortName?: string };
      timestamp?: number[];
      indicators?: {
        quote?: {
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }[];
      };
    }[];
    error?: { code?: string; description?: string };
  };
};

const BASE = process.env.BESLEME_API_BASE ?? "https://query1.finance.yahoo.com";

/**
 * Tek sembolün günlük mumları.
 *
 * Yanıttaki diziler paralel: aynı indeks aynı günü gösterir ve tatil günlerinde
 * `null` gelebilir; eksik alanı olan gün tamamen atlanır, yoksa gösterge
 * hesapları bozulur.
 */
async function mumlariCek(
  symbol: string,
  adim: string,
  aralik: string,
): Promise<{ candles: Candle[]; currency?: string; name?: string }> {
  const url =
    `${BASE}/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=${adim}&range=${aralik}&includePrePost=false`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const govde = (await response.json()) as ChartYanit;
    const sonuc = govde.chart?.result?.[0];
    if (!sonuc) throw new Error(govde.chart?.error?.description ?? "boş yanıt");

    const zaman = sonuc.timestamp ?? [];
    const q = sonuc.indicators?.quote?.[0] ?? {};
    const candles: Candle[] = [];

    for (let i = 0; i < zaman.length; i++) {
      const open = q.open?.[i];
      const high = q.high?.[i];
      const low = q.low?.[i];
      const close = q.close?.[i];
      if (
        typeof open !== "number" ||
        typeof high !== "number" ||
        typeof low !== "number" ||
        typeof close !== "number" ||
        close <= 0
      ) {
        continue;
      }
      const volume = typeof q.volume?.[i] === "number" ? (q.volume[i] as number) : 0;
      const openTime = zaman[i] * 1000;
      const sureMs = adim === "1wk" ? 7 * 86_400_000 : 86_400_000;
      candles.push({
        openTime,
        open,
        high,
        low,
        close,
        volume,
        closeTime: openTime + sureMs - 1,
        quoteVolume: volume * close,
        trades: 0,
      });
    }

    candles.sort((a, b) => a.openTime - b.openTime);
    return {
      candles: candles.slice(-MUM_SAYISI),
      currency: sonuc.meta?.currency,
      name: sonuc.meta?.longName ?? sonuc.meta?.shortName,
    };
  } finally {
    clearTimeout(timer);
  }
}

/* ────────────────────────── Yazma ────────────────────────── */

/** Anahtar biçimi uygulamayla birebir aynı olmalı, yoksa site yazdığımızı bulamaz. */
function anahtar(market: MarketId, symbol: string, interval: Interval): string {
  return `candles:${market}:${symbol}:${interval}`;
}

async function kaydet(
  instrument: Instrument,
  interval: Interval,
  candles: Candle[],
  currency?: string,
): Promise<void> {
  const deger = {
    instrument: currency ? { ...instrument, currency } : instrument,
    candles,
    source: "canli",
    fetchedAt: Date.now(),
  };

  await query(
    `insert into piyasa_onbellek (anahtar, deger, biter)
     values ($1, $2::jsonb, $3)
     on conflict (anahtar) do update set deger = excluded.deger, biter = excluded.biter`,
    [
      anahtar(instrument.market, instrument.symbol, interval),
      JSON.stringify(deger),
      Date.now() + TAZELIK_MS,
    ],
  );
}

/* ────────────────────────── Akış ────────────────────────── */

type Sonuc = { market: MarketId; basarili: number; toplam: number; hatalar: string[] };

async function piyasayiBesle(market: MarketId): Promise<Sonuc> {
  const instruments = staticInstruments(market);
  const hatalar: string[] = [];
  let basarili = 0;

  for (let i = 0; i < instruments.length; i += ESZAMANLI) {
    const parca = instruments.slice(i, i + ESZAMANLI);
    await Promise.all(
      parca.map(async (instrument) => {
        for (const periyot of PERIYOTLAR) {
          try {
            const { candles, currency } = await mumlariCek(
              instrument.symbol,
              periyot.adim,
              periyot.aralik,
            );
            // Birkaç mumluk yanıt genelde "sembol bulunamadı" demektir; yarım
            // veriyle önbelleği kirletmektense o sembolü atlamak daha iyi.
            if (candles.length < 30) throw new Error(`yetersiz veri (${candles.length} mum)`);
            await kaydet(instrument, periyot.interval, candles, currency);
            if (periyot.interval === "1d") basarili++;
          } catch (error) {
            hatalar.push(
              `${instrument.symbol} ${periyot.interval}: ${error instanceof Error ? error.message : "bilinmeyen"}`,
            );
          }
        }
      }),
    );
    if (i + ESZAMANLI < instruments.length) await bekle(TUR_ARASI_MS);
  }

  return { market, basarili, toplam: instruments.length, hatalar };
}

async function main(): Promise<void> {
  if (!postgresEnabled()) {
    console.error("DATABASE_URL tanımlı değil; yazacak yer yok.");
    process.exit(1);
  }

  const istenen = process.argv.slice(2).filter((arg): arg is MarketId =>
    (MARKET_IDS as readonly string[]).includes(arg),
  );
  const piyasalar = (istenen.length > 0 ? istenen : MARKET_IDS).filter((m) => m !== "kripto");

  await ensureSchema();

  const sonuclar: Sonuc[] = [];
  for (const market of piyasalar) {
    const sonuc = await piyasayiBesle(market);
    sonuclar.push(sonuc);
    console.log(`${market.padEnd(6)} ${sonuc.basarili}/${sonuc.toplam} sembol yazıldı`);
    // İlk birkaç hatayı göster: hepsini basmak kütüğü boğar, sıfır bilgi de bırakmaz.
    for (const hata of sonuc.hatalar.slice(0, 5)) console.log(`       ✗ ${hata}`);
    if (sonuc.hatalar.length > 5) console.log(`       … ${sonuc.hatalar.length - 5} hata daha`);
  }

  await closePool();

  // Bir piyasadan hiç veri gelmediyse çalışma başarısız sayılır: sessizce boş
  // dönen bir besleme, kotanın günlerce boşa harcanması demek.
  const bos = sonuclar.filter((s) => s.basarili === 0);
  if (bos.length > 0) {
    console.error(`\nHiç veri alınamayan piyasa: ${bos.map((s) => s.market).join(", ")}`);
    process.exit(1);
  }
  console.log("\nBesleme tamam.");
}

main().catch(async (error) => {
  console.error(error);
  await closePool().catch(() => undefined);
  process.exit(1);
});

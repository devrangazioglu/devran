/**
 * Piyasa verisini veritabanına doldurur (günlük besleme).
 *
 * Neden ayrı bir betik: mum geçmişi veren anahtarsız kaynak (Yahoo) bulut IP
 * aralıklarını engelliyor ve anahtar isteyen kaynak ücretsiz katmanda günde
 * 800 kredi veriyor — ikisi de her ziyaretçi isteğinde sağlayıcıya gitmeyi
 * imkânsız kılıyor. Bu betik veriyi gece bir kez çeker ve paylaşımlı
 * önbelleğe yazar; site zaten önce oraya bakıyor, tablo doluysa hiçbir
 * sağlayıcıya gitmiyor.
 *
 * Önemli bir ölçüm: GitHub çalıştırıcısının IP aralığı da yasaklı, yani
 * "başka makineden çalıştırmak" tek başına yetmiyordu. Veri aktarıcı
 * üzerinden geliyor (bkz. `lib/markets/aktarici.ts`) ve bu betik de
 * uygulamanın veri yolunu kullanıyor, kendi `fetch`'ini değil.
 *
 * Günlük mumlar günde bir değiştiği için günde bir çalışması yeterli.
 *
 * Çalıştırma:
 *   DATABASE_URL=... npm run besle              # tüm piyasalar
 *   DATABASE_URL=... npm run besle -- abd bist  # seçili piyasalar
 *   npm run besle -- --dene                     # yalnızca kaynağı ölç, yazma
 *
 * `--dene`: veritabanı gerekmez. Birkaç sembol çekip sonucu basar; "bu makineden
 * veri alınabiliyor mu?" sorusunu kurulumun geri kalanından bağımsız yanıtlar.
 */

import { closePool, ensureSchema, postgresEnabled, query } from "../lib/db";
import { aktariciAcik } from "../lib/markets/aktarici";
import { staticInstruments } from "../lib/markets/instruments";
import { fetchChart } from "../lib/markets/yahoo";
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
const PERIYOTLAR: Interval[] = ["1d", "1w"];

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

/**
 * Tek sembolün mumları.
 *
 * Veri yolu uygulamayla **aynı**: `lib/markets/yahoo.ts`. Bu betik bir süre
 * kendi `fetch`'ini kullanıyordu ve bu sessiz bir tuzak oldu — uygulamaya
 * eklenen aktarıcı (engellenen IP aralığını aşan yol, bkz.
 * `lib/markets/aktarici.ts`) beslemeye hiç uğramadı, besleme her sembolde 429
 * alıp boş döndü, ölçüm de bunu "kaynak çalışmıyor" diye gösterdi. Tek yol
 * kullanmak aynı hatanın iki yerde ayrı ayrı düzeltilmesi gereğini de bitirir.
 */
async function mumlariCek(
  symbol: string,
  interval: Interval,
): Promise<{ candles: Candle[]; currency?: string; name?: string }> {
  const chart = await fetchChart(symbol, interval, MUM_SAYISI);
  return {
    candles: chart.candles,
    currency: chart.currency ?? undefined,
    name: chart.name ?? undefined,
  };
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
            const { candles, currency } = await mumlariCek(instrument.symbol, periyot);
            // Birkaç mumluk yanıt genelde "sembol bulunamadı" demektir; yarım
            // veriyle önbelleği kirletmektense o sembolü atlamak daha iyi.
            if (candles.length < 30) throw new Error(`yetersiz veri (${candles.length} mum)`);
            await kaydet(instrument, periyot, candles, currency);
            if (periyot === "1d") basarili++;
          } catch (error) {
            hatalar.push(
              `${instrument.symbol} ${periyot}: ${error instanceof Error ? error.message : "bilinmeyen"}`,
            );
          }
        }
      }),
    );
    if (i + ESZAMANLI < instruments.length) await bekle(TUR_ARASI_MS);
  }

  return { market, basarili, toplam: instruments.length, hatalar };
}

/**
 * Kaynak ölçümü: veritabanına dokunmadan birkaç sembol çeker ve sonucu basar.
 *
 * Beslemenin iki ayağı var — veriyi alabilmek ve yazabilmek. Biri çalışmayınca
 * diğeri hakkında da hüküm vermek kolay ama yanlış; bu mod ilkini tek başına
 * ölçer.
 */
async function kaynagiDene(): Promise<void> {
  const ornekler: { market: MarketId; symbol: string }[] = [
    { market: "abd", symbol: "AAPL" },
    { market: "abd", symbol: "^GSPC" },
    { market: "bist", symbol: "THYAO.IS" },
    { market: "bist", symbol: "GARAN.IS" },
    { market: "emtia", symbol: "GC=F" },
    { market: "emtia", symbol: "USDTRY=X" },
  ];

  console.log(
    `Kaynak: ${process.env.MARKET_API_BASE ?? "Yahoo Finance"}` +
      `${aktariciAcik() ? " (gerekirse aktarıcı üzerinden)" : ""}\n`,
  );
  let basarili = 0;

  for (const ornek of ornekler) {
    try {
      const { candles, currency } = await mumlariCek(ornek.symbol, "1d");
      const son = candles[candles.length - 1];
      const tarih = new Date(son.openTime).toISOString().slice(0, 10);
      console.log(
        `✓ ${ornek.symbol.padEnd(10)} ${String(candles.length).padStart(3)} mum · ` +
          `son ${tarih} · kapanış ${son.close.toFixed(2)} ${currency ?? ""}`,
      );
      basarili++;
    } catch (error) {
      console.log(`✗ ${ornek.symbol.padEnd(10)} ${error instanceof Error ? error.message : "bilinmeyen"}`);
    }
    await bekle(TUR_ARASI_MS);
  }

  console.log(`\n${basarili}/${ornekler.length} sembol alınabildi.`);
  if (basarili === 0) {
    console.error("Bu makineden veri alınamıyor; kaynağı değiştirmek gerekiyor.");
    process.exit(1);
  }
  if (basarili < ornekler.length) {
    console.log("Bazı semboller alınamadı; ayrıntı için yukarıdaki satırlara bakın.");
  }
}

async function main(): Promise<void> {
  if (process.argv.includes("--dene")) {
    await kaynagiDene();
    return;
  }

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

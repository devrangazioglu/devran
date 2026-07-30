/**
 * Piyasa katmanı testleri: enstrüman tanımları, sembol doğrulama,
 * mum toplama ve demo veri üretimi.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { demoBasePrice, demoCandles } from "../lib/markets/demo";
import {
  allStaticInstruments,
  BIST_INSTRUMENTS,
  COMMODITY_FX_INSTRUMENTS,
  displayTicker,
  findStaticInstrument,
  staticInstruments,
  US_INSTRUMENTS,
} from "../lib/markets/instruments";
import { parseFxPair, toCandles as fxToCandles } from "../lib/markets/frankfurter";
import { normalizeSymbol } from "../lib/markets/provider";
import { fetchStooqCandles, parseCandleCsv, parseQuoteCsv, toStooqSymbol, toStooqSymbols } from "../lib/markets/stooq";
import { krediAyir, krediSifirla } from "../lib/markets/kota";
import { batchHatasi, parseSeries, toTwelveSymbol } from "../lib/markets/twelvedata";
import { fetchChart, parseSpark, rateLimitedUntil, resetRateLimitState } from "../lib/markets/yahoo";
import {
  aggregateCandles,
  instrumentId,
  isMarketId,
  marketBySlug,
  MARKETS,
  MARKET_IDS,
  parseInstrumentId,
  type Candle,
} from "../lib/markets/types";

test("dört piyasa tanımlı ve her birinin sayfa yolu tekil", () => {
  assert.deepEqual(MARKET_IDS, ["kripto", "abd", "bist", "emtia"]);
  const slugs = MARKET_IDS.map((id) => MARKETS[id].slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const id of MARKET_IDS) {
    assert.equal(marketBySlug(MARKETS[id].slug)?.id, id);
    assert.ok(MARKETS[id].intervals.length >= 2);
  }
  assert.equal(marketBySlug("yok"), null);
  assert.equal(isMarketId("kripto"), true);
  assert.equal(isMarketId("forex"), false);
});

test("enstrüman kimlikleri çözümlenebilir", () => {
  assert.equal(instrumentId("abd", "AAPL"), "abd:AAPL");
  assert.deepEqual(parseInstrumentId("abd:AAPL"), { market: "abd", symbol: "AAPL" });
  assert.deepEqual(parseInstrumentId("emtia:GC=F"), { market: "emtia", symbol: "GC=F" });
  assert.equal(parseInstrumentId("AAPL"), null);
  assert.equal(parseInstrumentId("yokpiyasa:AAPL"), null);
});

test("tanımlı listelerde tekrar eden sembol yok ve alanlar dolu", () => {
  const all = allStaticInstruments();
  assert.ok(US_INSTRUMENTS.length >= 40);
  assert.ok(BIST_INSTRUMENTS.length >= 40);
  assert.ok(COMMODITY_FX_INSTRUMENTS.length >= 18);

  const ids = all.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length, "tekrar eden enstrüman var");

  for (const item of all) {
    assert.ok(item.name.length > 0, `${item.symbol} için ad yok`);
    assert.ok(item.ticker.length > 0, `${item.symbol} için kısa ad yok`);
    assert.ok(item.currency.length >= 3, `${item.symbol} için para birimi yok`);
    assert.equal(item.id, `${item.market}:${item.symbol}`);
  }

  // BIST sembolleri Yahoo biçiminde (.IS) olmalı — endeksler dahil.
  for (const item of BIST_INSTRUMENTS) assert.match(item.symbol, /\.IS$/);
  assert.equal(findStaticInstrument("bist", "THYAO.IS")?.ticker, "THYAO");
  assert.equal(findStaticInstrument("bist", "YOK"), null);
  assert.equal(staticInstruments("kripto").length, 0, "kripto listesi dinamik gelir");
});

test("gösterilecek kısa ad sağlayıcı sembolünü okunur kılar", () => {
  // Tanımlı enstrümanlarda gerçek kısa ad kullanılır.
  assert.equal(displayTicker("emtia", "GC=F"), "XAU");
  assert.equal(displayTicker("emtia", "USDTRY=X"), "USD/TRY");
  assert.equal(displayTicker("bist", "THYAO.IS"), "THYAO");
  assert.equal(displayTicker("bist", "XU100.IS"), "BIST 100");
  assert.equal(displayTicker("abd", "AAPL"), "AAPL");

  // Kriptoda parite biçimine ayrıştırılır.
  assert.equal(displayTicker("kripto", "BTCUSDT"), "BTC/USDT");
  assert.equal(displayTicker("kripto", "ETHBTC"), "ETH/BTC");

  // Tanımsız sembolde sağlayıcı sonekleri atılır, hiçbir zaman boş kalmaz.
  assert.equal(displayTicker("bist", "YOKBIR.IS"), "YOKBIR");
  assert.ok(displayTicker("abd", "ZZZZ").length > 0);
});

test("sembol doğrulama piyasaya göre çalışır", () => {
  assert.equal(normalizeSymbol("kripto", "btcusdt"), "BTCUSDT");
  assert.equal(normalizeSymbol("kripto", "BTC/USDT"), null);
  assert.equal(normalizeSymbol("abd", "aapl"), "AAPL");
  assert.equal(normalizeSymbol("abd", "^GSPC"), "^GSPC");
  assert.equal(normalizeSymbol("bist", "thyao.is"), "THYAO.IS");
  assert.equal(normalizeSymbol("emtia", "gc=f"), "GC=F");
  assert.equal(normalizeSymbol("emtia", "USDTRY=X"), "USDTRY=X");
  assert.equal(normalizeSymbol("abd", "'; drop table users--"), null);
  assert.equal(normalizeSymbol("abd", ""), null);
});

test("mum toplama 4 saatlik mumu doğru üretir", () => {
  const base: Candle[] = Array.from({ length: 8 }, (_, i) => ({
    openTime: i * 3_600_000,
    open: 100 + i,
    high: 105 + i,
    low: 95 + i,
    close: 101 + i,
    volume: 10,
    closeTime: (i + 1) * 3_600_000 - 1,
    quoteVolume: 1000,
    trades: 5,
  }));

  const merged = aggregateCandles(base, 4);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].open, base[0].open, "açılış ilk mumdan gelir");
  assert.equal(merged[0].close, base[3].close, "kapanış son mumdan gelir");
  assert.equal(merged[0].high, Math.max(...base.slice(0, 4).map((c) => c.high)));
  assert.equal(merged[0].low, Math.min(...base.slice(0, 4).map((c) => c.low)));
  assert.equal(merged[0].volume, 40, "hacimler toplanır");
  assert.equal(aggregateCandles(base, 1).length, base.length);
});

test("toplu fiyat yanıtı tek istekten çözümlenir", () => {
  // Sağlayıcının döndüğü biçim; eksik alanlar bilinçli olarak boş bırakıldı.
  const parsed = parseSpark({
    spark: {
      result: [
        {
          symbol: "AAPL",
          response: [
            {
              meta: {
                symbol: "AAPL",
                currency: "USD",
                regularMarketPrice: 220,
                previousClose: 200,
                regularMarketVolume: 1_000,
              },
              indicators: { quote: [{ close: [201, 215, 220] }] },
            },
          ],
        },
        {
          // Fiyat alanı yoksa seriden türetilmeli.
          symbol: "GC=F",
          response: [
            {
              meta: { symbol: "GC=F", currency: "USD" },
              indicators: { quote: [{ close: [2400, null, 2460] }] },
            },
          ],
        },
        // Kullanılabilir hiçbir veri yoksa atlanmalı, çökmemeli.
        { symbol: "BOS", response: [] },
      ],
    },
  });

  assert.equal(parsed.length, 2, "veri taşıyan iki sembol dönmeli");

  const apple = parsed[0];
  assert.equal(apple.symbol, "AAPL");
  assert.equal(apple.price, 220);
  assert.equal(apple.previousClose, 200);
  assert.equal(Math.round(apple.changePercent), 10);
  assert.equal(apple.high, 220, "uç değerler seriden gelmeli");
  assert.equal(apple.low, 201);

  const gold = parsed[1];
  assert.equal(gold.price, 2460, "fiyat serinin son değeri olmalı");
  assert.equal(gold.previousClose, 2400, "önceki kapanış serinin ilk değeri olmalı");
  assert.ok(gold.changePercent > 0);

  assert.deepEqual(parseSpark({}), [], "boş yanıt boş liste vermeli");
});

test("demo veri deterministik ve tutarlıdır", () => {
  const first = demoCandles("AAPL", "1d", 60);
  const second = demoCandles("AAPL", "1d", 60);
  assert.equal(first.length, 60);
  assert.deepEqual(
    first.map((c) => c.close),
    second.map((c) => c.close),
    "aynı sembol ve periyot için aynı seri üretilmeli",
  );

  const other = demoCandles("MSFT", "1d", 60);
  assert.notDeepEqual(
    first.map((c) => c.close),
    other.map((c) => c.close),
    "farklı semboller farklı seri üretmeli",
  );

  for (const candle of first) {
    assert.ok(candle.high >= candle.low);
    assert.ok(candle.high >= candle.open && candle.high >= candle.close);
    assert.ok(candle.low <= candle.open && candle.low <= candle.close);
    assert.ok(candle.close > 0 && candle.volume > 0);
  }

  // Bilinen enstrümanlar gerçekçi bir başlangıç fiyatı kullanır.
  assert.ok(demoBasePrice("GC=F") > 1000, "altın fiyatı dört haneli olmalı");
  assert.ok(demoBasePrice("USDTRY=X") > 10);
  assert.ok(demoBasePrice("BILINMEYEN") > 0);
});

test("hız sınırında sağlayıcıya daha çok istek atılmaz", async () => {
  // Gerçek ağa çıkmadan devre kesiciyi ölç: sağlayıcı hep 429 dönüyor.
  const gercekFetch = globalThis.fetch;
  let istek = 0;
  globalThis.fetch = (async () => {
    istek++;
    return new Response("{}", { status: 429 });
  }) as typeof fetch;

  try {
    resetRateLimitState();

    // İlk çağrı yeniden dener (1 + 2 deneme), sonra devreyi açar.
    await assert.rejects(() => fetchChart("AAPL", "1d", 10), /istek limitine/);
    const ilkTur = istek;
    assert.ok(ilkTur <= 6, `ilk turda beklenenden çok istek: ${ilkTur}`);
    assert.ok(rateLimitedUntil() > Date.now(), "devre kesici açılmalı");

    // Sonraki çağrılar ağa hiç çıkmamalı.
    for (let i = 0; i < 10; i++) {
      await assert.rejects(() => fetchChart(`SYM${i}`, "1d", 10), /istek limitine/);
    }
    assert.equal(istek, ilkTur, "devre açıkken yeni istek atılmamalı");

    // Bekleme bitince yeniden denenmeli.
    resetRateLimitState();
    await assert.rejects(() => fetchChart("AAPL", "1d", 10), /istek limitine/);
    assert.ok(istek > ilkTur, "bekleme sonrası tekrar denenmeli");
  } finally {
    globalThis.fetch = gercekFetch;
    resetRateLimitState();
  }
});

test("ikinci kaynağın sembol eşlemesi piyasaya göre çalışır", () => {
  assert.equal(toStooqSymbol("abd", "AAPL"), "aapl.us");
  assert.equal(toStooqSymbol("abd", "^GSPC"), "^spx");
  assert.equal(toStooqSymbol("emtia", "GC=F"), "xauusd");
  assert.equal(toStooqSymbol("emtia", "CL=F"), "cl.f");
  assert.equal(toStooqSymbol("emtia", "USDTRY=X"), "usdtry");
  assert.equal(toStooqSymbol("bist", "THYAO.IS"), "thyao.tr");

  // Kripto bu kaynaktan gelmez.
  assert.equal(toStooqSymbol("kripto", "BTCUSDT"), null);
});

test("ikinci kaynağın toplu fiyat CSV'si çözümlenir", () => {
  const csv = [
    "Symbol,Date,Time,Open,High,Low,Close,Volume",
    "AAPL.US,2026-07-29,22:00:04,210.5,214.2,209.1,213.76,44210000",
    "XAUUSD,2026-07-29,22:00:04,2440,2470.5,2435,2461.3,0",
    // Veri bulunamayan sembol: atlanmalı, çökmemeli.
    "YOKBIR.US,N/D,N/D,N/D,N/D,N/D,N/D,N/D",
  ].join("\n");

  const rows = parseQuoteCsv(csv);
  assert.equal(rows.length, 2, "geçersiz satır elenmeli");
  assert.equal(rows[0].symbol, "aapl.us", "sembol küçük harfe indirilmeli");
  assert.equal(rows[0].close, 213.76);
  assert.equal(rows[0].high, 214.2);
  assert.equal(rows[1].symbol, "xauusd");
  assert.equal(rows[1].volume, 0);

  assert.deepEqual(parseQuoteCsv(""), [], "boş yanıt boş liste vermeli");
  assert.deepEqual(parseQuoteCsv("Symbol,Date"), [], "başlık tek başına satır üretmemeli");
});

test("ikinci kaynağın mum CSV'si analize uygun mum üretir", () => {
  const csv = [
    "Date,Open,High,Low,Close,Volume",
    "2026-07-27,200,205,199,204,1000",
    "2026-07-28,204,208,203,206,1200",
    "bozuk,satir,,,,",
    "2026-07-29,206,210,205,209,900",
  ].join("\n");

  const candles = parseCandleCsv(csv, "1d");
  assert.equal(candles.length, 3, "bozuk satır atlanmalı");

  for (const candle of candles) {
    assert.ok(candle.high >= candle.low);
    assert.ok(candle.high >= candle.open && candle.high >= candle.close);
    assert.ok(candle.low <= candle.open && candle.low <= candle.close);
    assert.ok(candle.closeTime > candle.openTime);
    assert.equal(candle.quoteVolume, candle.volume * candle.close);
  }

  // Mumlar zaman sırasında olmalı (analiz motoru buna dayanır).
  for (let i = 1; i < candles.length; i++) {
    assert.ok(candles[i].openTime > candles[i - 1].openTime);
  }

  assert.equal(parseCandleCsv("Date,Open", "1d").length, 0);
});

test("sembol yazımı tutmazsa sıradaki yazım denenir", async () => {
  // Sağlayıcının hangi yazımı taşıdığı belgeli değil; ilki boş dönerse
  // ikincisine geçilmeli, aksi hâlde varlık sessizce kaybolur.
  assert.deepEqual(toStooqSymbols("bist", "THYAO.IS"), ["thyao.tr", "thyao"]);
  assert.deepEqual(toStooqSymbols("abd", "AAPL"), ["aapl.us", "aapl"]);
  // Endekste de bilinen karşılık önce, ham yazım yedek olarak denenir.
  assert.deepEqual(toStooqSymbols("abd", "^GSPC"), ["^spx", "^gspc"]);
  assert.deepEqual(toStooqSymbols("kripto", "BTCUSDT"), []);

  const govde = (n: number) =>
    ["Date,Open,High,Low,Close,Volume"]
      .concat(
        Array.from({ length: n }, (_, i) => {
          const gun = String((i % 28) + 1).padStart(2, "0");
          return `2026-01-${gun},100,101,99,100.5,1000`;
        }),
      )
      .join("\n");

  const gercekFetch = globalThis.fetch;
  const istenen: string[] = [];
  globalThis.fetch = (async (url: string) => {
    istenen.push(String(url));
    // İlk yazım ("thyao.tr") bilinmeyen sembol: neredeyse boş CSV.
    if (String(url).includes("thyao.tr")) return new Response(govde(1), { status: 200 });
    return new Response(govde(60), { status: 200 });
  }) as unknown as typeof fetch;

  try {
    const candles = await fetchStooqCandles(toStooqSymbols("bist", "THYAO.IS"), "1d", 300);
    assert.equal(candles.length, 60, "ikinci yazımdan veri gelmeli");
    assert.equal(istenen.length, 2, "önce ilk yazım, sonra ikincisi denenmeli");
    assert.ok(istenen[0].includes("thyao.tr"));
    assert.ok(istenen[1].includes("thyao"));
  } finally {
    globalThis.fetch = gercekFetch;
  }
});

test("hiçbir yazım tutmazsa anlamlı hata verir", async () => {
  const gercekFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("Date,Open,High,Low,Close,Volume", { status: 200 })) as typeof fetch;
  try {
    await assert.rejects(
      () => fetchStooqCandles(["yok.tr", "yok"], "1d", 300),
      /veri yok|veri bulunamadı/,
    );
  } finally {
    globalThis.fetch = gercekFetch;
  }
});

test("bu kaynak gün içi periyot için kullanılmaz", async () => {
  await assert.rejects(() => fetchStooqCandles(["aapl.us"], "4h", 300), /gün içi/);
});

/* ────────────────────── Kur kaynağı (anahtarsız) ────────────────────── */

test("döviz çifti çözümlenir, desteklenmeyen çift reddedilir", () => {
  assert.deepEqual(parseFxPair("USDTRY=X"), { from: "USD", to: "TRY" });
  assert.deepEqual(parseFxPair("EURUSD=X"), { from: "EUR", to: "USD" });
  assert.deepEqual(parseFxPair("GBPUSD"), { from: "GBP", to: "USD" });

  assert.equal(parseFxPair("USDUSD=X"), null, "aynı para birimi çift olamaz");
  assert.equal(parseFxPair("GC=F"), null, "emtia bu kaynakta yok");
  assert.equal(parseFxPair("AAPL"), null);
  assert.equal(parseFxPair("XAUUSD=X"), null, "altın ECB kuru değil");
});

test("kur serisi analize uygun mum üretir", () => {
  const candles = fxToCandles(
    { "2026-07-27": 40, "2026-07-28": 42, "2026-07-29": 41 },
    "1d",
    300,
  );

  assert.equal(candles.length, 3);
  // İlk mumda önceki kapanış yok; açılış kapanışa eşitlenir.
  assert.equal(candles[0].open, 40);
  assert.equal(candles[0].close, 40);
  // Sonraki mumların açılışı bir önceki kapanıştır.
  assert.equal(candles[1].open, 40);
  assert.equal(candles[1].close, 42);
  assert.equal(candles[2].open, 42);
  assert.equal(candles[2].close, 41);

  for (const candle of candles) {
    assert.ok(candle.high >= candle.low);
    assert.ok(candle.high >= candle.open && candle.high >= candle.close);
    assert.ok(candle.low <= candle.open && candle.low <= candle.close);
    // Bu kaynakta hacim yok; uydurulmamalı.
    assert.equal(candle.volume, 0);
  }

  // Tarihler sıralı olmalı, analiz motoru buna dayanır.
  for (let i = 1; i < candles.length; i++) {
    assert.ok(candles[i].openTime > candles[i - 1].openTime);
  }
});

/* ────────────────────── Anahtarlı sağlayıcı ────────────────────── */

test("anahtarlı sağlayıcının sembol eşlemesi piyasaya göre çalışır", () => {
  assert.equal(toTwelveSymbol("abd", "AAPL"), "AAPL");
  assert.equal(toTwelveSymbol("abd", "^GSPC"), "SPX");
  assert.equal(toTwelveSymbol("bist", "THYAO.IS"), "THYAO");
  assert.equal(toTwelveSymbol("emtia", "GC=F"), "XAU/USD");
  assert.equal(toTwelveSymbol("emtia", "USDTRY=X"), "USD/TRY");
  assert.equal(toTwelveSymbol("kripto", "BTCUSDT"), null);
});

test("anahtarlı sağlayıcının serisi eskiden yeniye sıralanır", () => {
  // Sağlayıcı en yeniden eskiye döndürür; motor tersini bekler.
  const candles = parseSeries(
    {
      status: "ok",
      values: [
        { datetime: "2026-07-29", open: "206", high: "210", low: "205", close: "209", volume: "900" },
        { datetime: "2026-07-28", open: "204", high: "208", low: "203", close: "206", volume: "1200" },
        { datetime: "2026-07-27", open: "200", high: "205", low: "199", close: "204", volume: "1000" },
        { datetime: "2026-07-26", open: "bozuk", high: "", low: "", close: "", volume: "" },
      ],
    },
    "1d",
  );

  assert.equal(candles.length, 3, "bozuk satır atlanmalı");
  assert.equal(candles[0].close, 204, "en eski mum başta olmalı");
  assert.equal(candles[2].close, 209, "en yeni mum sonda olmalı");
  for (let i = 1; i < candles.length; i++) {
    assert.ok(candles[i].openTime > candles[i - 1].openTime);
  }
  assert.equal(candles[0].quoteVolume, 1000 * 204);
});

test("anahtarlı sağlayıcının hata yanıtı sessizce yutulmaz", () => {
  assert.throws(
    () => parseSeries({ status: "error", message: "symbol not found", code: 404 }, "1d"),
    /symbol not found/,
  );
  // Kredi bitti hatası hız sınırı olarak işaretlenmeli.
  try {
    parseSeries({ status: "error", message: "limit", code: 429 }, "1d");
    assert.fail("hata bekleniyordu");
  } catch (error) {
    assert.equal((error as { status: number }).status, 429);
  }
});

test("kredi bütçesi dakikalık sınırı aşmaz ve pencere dolunca yenilenir", async () => {
  // Ücretsiz katman dakikada sabit sayıda sembol veriyor (öntanımlı 8).
  // Sınır aşılırsa sağlayıcı tüm piyasayı hataya çeviriyordu.
  krediSifirla();
  assert.equal(await krediAyir(5), 5);
  assert.equal(await krediAyir(5), 3, "kalan bütçe kadarı verilmeli, fazlası değil");
  assert.equal(await krediAyir(1), 0, "bütçe bitince sıfır dönmeli");

  krediSifirla();
  assert.equal(await krediAyir(1), 1, "pencere yenilenince yeniden kredi verilmeli");
});

test("toplu yanıttaki kota hatası yüzeye çıkar", () => {
  // Sağlayıcı kota hatasını her sembolün altında ayrı bildiriyor. Bu sembol
  // bazında yutulunca "veri yok" sanılıyor ve uygulama istemeye devam ediyordu.
  const hata = batchHatasi({
    AAPL: { status: "error", code: 429, message: "You have run out of API credits for the day." },
    MSFT: { status: "error", code: 429, message: "You have run out of API credits for the day." },
  });

  assert.ok(hata, "hata bulunmalı");
  assert.equal(hata?.status, 429);
  assert.match(hata?.message ?? "", /for the day/);

  // Veri dönen yanıtta hata yoktur.
  assert.equal(batchHatasi({ AAPL: { status: "ok", values: [] } }), null);
});

/**
 * Dünya borsaları: sembol eşlemesi, borsa tanımı ve grafik akışı çözümleme.
 *
 * Yanlış eşlenen bir sembol kullanıcıya başka bir şirketin fiyatını gösterir;
 * bu yüzden her tanımlı hisse için iki yönlü eşleme ayrı ayrı sınanır.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { anlikMi } from "../lib/markets/anlik";
import { BORSALAR, borsa, yahooBorsasindanPiyasa } from "../lib/markets/borsalar";
import { displayTicker, staticInstruments } from "../lib/markets/instruments";
import { kiyasEndeksi } from "../lib/markets/baglam";
import { tvTamAd } from "../lib/markets/tradingview";
import { hacimSayisi, mumlariCoz, paketiAyir } from "../lib/markets/tv-mum";
import { DUNYA_MARKET_IDS, hisseBorsasi, MARKETS, marketBySlug, type MarketId } from "../lib/markets/types";

test("her dünya borsasının tanımı, listesi ve endeksi var", () => {
  for (const id of DUNYA_MARKET_IDS) {
    const tanim = borsa(id);
    assert.ok(tanim, `${id} borsa tanımı yok`);
    assert.ok(MARKETS[id].bayrak, `${id} bayrağı yok`);
    assert.equal(marketBySlug(MARKETS[id].slug)?.id, id);
    assert.ok(hisseBorsasi(id));

    const liste = staticInstruments(id);
    assert.ok(liste.length >= 20, `${id} listesi kısa: ${liste.length}`);
    const endeksler = liste.filter((i) => i.kind === "endeks");
    assert.equal(endeksler.length, 1, `${id} tek endeksle açılmalı`);
    assert.equal(endeksler[0].symbol, tanim.endeks.symbol, `${id} endeksi borsa tanımıyla aynı değil`);
    assert.equal(new Set(liste.map((i) => i.symbol)).size, liste.length, `${id} listesinde tekrar var`);
  }
});

test("tarayıcı adı ↔ uygulama sembolü iki yönde aynı hisseye gider", () => {
  for (const [market, tanim] of Object.entries(BORSALAR)) {
    for (const instrument of staticInstruments(market as MarketId)) {
      if (instrument.kind !== "hisse") continue;
      const ad = tanim!.tvAdi(instrument.symbol);
      const borsaKodu =
        market === "cin" ? (instrument.symbol.endsWith(".SS") ? "SSE" : "SZSE") : tanim!.tvBorsalar[0];
      assert.equal(
        tanim!.uygulamaSembolu(ad, borsaKodu),
        instrument.symbol,
        `${market}: ${instrument.symbol} → ${ad} → geri dönmüyor`,
      );
    }
  }
});

test("özel yazımlar: Hong Kong sıfırları, Londra noktası, Kanada sınıfı", () => {
  assert.equal(borsa("hongkong")!.tvAdi("0700.HK"), "700");
  assert.equal(borsa("hongkong")!.uygulamaSembolu("5", "HKEX"), "0005.HK");
  assert.equal(borsa("ingiltere")!.tvAdi("BP.L"), "BP.");
  assert.equal(borsa("ingiltere")!.uygulamaSembolu("BP.", "LSE"), "BP.L");
  assert.equal(borsa("ingiltere")!.tvAdi("AZN.L"), "AZN");
  assert.equal(borsa("kanada")!.uygulamaSembolu("BBD.B", "TSX"), "BBD-B.TO");
  assert.equal(borsa("kanada")!.tvAdi("BBD-B.TO"), "BBD.B");
  assert.equal(borsa("cin")!.uygulamaSembolu("300750", "SZSE"), "300750.SZ");
  assert.equal(borsa("cin")!.uygulamaSembolu("600519", "SSE"), "600519.SS");
});

test("grafik akışı tam adları: borsa, Çin borsası, endeks, vadeli, döviz", async () => {
  delete process.env.TRADINGVIEW_KAPALI;
  assert.equal(await tvTamAd("almanya", "SAP.DE"), "XETR:SAP");
  assert.equal(await tvTamAd("japonya", "7203.T"), "TSE:7203");
  assert.equal(await tvTamAd("hongkong", "0700.HK"), "HKEX:700");
  assert.equal(await tvTamAd("cin", "300750.SZ"), "SZSE:300750");
  assert.equal(await tvTamAd("cin", "600519.SS"), "SSE:600519");
  assert.equal(await tvTamAd("bist", "THYAO.IS"), "BIST:THYAO");
  assert.equal(await tvTamAd("tayvan", "^TWII"), "TWSE:IX0001");
  assert.equal(await tvTamAd("abd", "^GSPC"), "TVC:SPX");
  assert.equal(await tvTamAd("emtia", "GC=F"), "TVC:GOLD");
  assert.equal(await tvTamAd("emtia", "NG=F"), "NYMEX:NG1!");
  assert.equal(await tvTamAd("emtia", "USDTRY=X"), "FX:USDTRY");
});

test("göreli güç her borsada kendi endeksiyle kıyaslanır", () => {
  for (const id of DUNYA_MARKET_IDS) {
    const hisse = staticInstruments(id).find((i) => i.kind === "hisse")!;
    assert.deepEqual(kiyasEndeksi(hisse), {
      market: id,
      symbol: borsa(id)!.endeks.symbol,
      ticker: borsa(id)!.endeks.ticker,
    });
  }
});

test("aramadaki borsa kodu doğru piyasaya düşer", () => {
  assert.equal(yahooBorsasindanPiyasa("JPX"), "japonya");
  assert.equal(yahooBorsasindanPiyasa("GER"), "almanya");
  assert.equal(yahooBorsasindanPiyasa("NMS"), "abd");
  assert.equal(yahooBorsasindanPiyasa("IST"), "bist");
  assert.equal(yahooBorsasindanPiyasa("XYZ"), null);
});

test("anlık işareti: ABD, TVC endeks/emtia, döviz ve kripto anlık; BIST ve gaz değil", () => {
  assert.equal(anlikMi("abd", "AAPL"), true);
  assert.equal(anlikMi("abd", "^GSPC"), true);
  assert.equal(anlikMi("almanya", "^GDAXI"), true);
  assert.equal(anlikMi("almanya", "SAP.DE"), false);
  assert.equal(anlikMi("emtia", "GC=F"), true);
  assert.equal(anlikMi("emtia", "NG=F"), false);
  assert.equal(anlikMi("emtia", "USDTRY=X"), true);
  assert.equal(anlikMi("bist", "THYAO.IS"), false);
  assert.equal(anlikMi("bist", "XU100.IS"), false);
  assert.equal(anlikMi("kripto", "BTCUSDT"), true);
});

test("kısa gösterim: dünya borsası soneki atılır, ABD sınıf harfi kalır", () => {
  assert.equal(displayTicker("almanya", "SAP.DE"), "SAP");
  assert.equal(displayTicker("almanya", "XYZ.DE"), "XYZ");
  assert.equal(displayTicker("abd", "BRK.B"), "BRK.B");
});

test("grafik akışı: paket ayrıştırma ve mum çözümleme", () => {
  const a = JSON.stringify({ m: "series_completed", p: [] });
  const paket = `~m~${a.length}~m~${a}~m~4~m~~h~7`;
  assert.deepEqual(paketiAyir(paket), [a, "~h~7"]);

  const mumlar = mumlariCoz(
    [
      { i: 1, v: [1_700_086_400, 11, 12, 10, 11.5, 2000] },
      { i: 0, v: [1_700_000_000, 10, 11, 9, 10.5, 1000] },
      { i: 2, v: [1_700_172_800, Number.NaN, 1, 1, 1, 1] },
    ],
    "1d",
  );
  assert.equal(mumlar.length, 2);
  assert.equal(mumlar[0].openTime, 1_700_000_000_000);
  assert.equal(mumlar[1].close, 11.5);
  assert.equal(mumlar[1].quoteVolume, 2000 * 11.5);
});

test("periyotlar: anlık varlıkta 1 dk'dan, gecikmelide 15 dk'dan başlar; en yakına düşer", async () => {
  const { enYakinPeriyot, varlikPeriyotlari } = await import("../lib/markets/anlik");
  assert.deepEqual(varlikPeriyotlari("abd", "AAPL").slice(0, 2), ["1m", "5m"]);
  assert.deepEqual(varlikPeriyotlari("almanya", "^GDAXI").slice(0, 2), ["1m", "5m"]);
  assert.deepEqual(varlikPeriyotlari("almanya", "SAP.DE"), ["15m", "1h", "4h", "1d", "1w"]);
  assert.deepEqual(varlikPeriyotlari("emtia", "NG=F")[0], "15m");
  assert.equal(enYakinPeriyot(varlikPeriyotlari("emtia", "NG=F"), "1m"), "15m");
  assert.equal(enYakinPeriyot(varlikPeriyotlari("emtia", "NG=F"), "30m"), "1h");
  assert.equal(enYakinPeriyot(varlikPeriyotlari("emtia", "GC=F"), "5m"), "5m");
});

test("360° bakış: gruplar ayrılır, verisi olmayan açı boş kalır, uyum sinyal yönüne göre", async () => {
  const { bakis360 } = await import("../lib/bakis360");
  const c = (id: string, category: string, direction: number, weight = 1) =>
    ({ id, category, direction, weight, labelKey: "", value: [], verdict: "NEUTRAL", noteKey: "" }) as never;
  const analysis = {
    score: 40,
    checks: [
      c("ema-cross", "trend", 1),
      c("adx", "trend", 0.5, 3),
      c("rsi", "momentum", -0.6),
      c("structure", "structure", 0.8),
      c("higher-tf", "structure", -1),
      c("bollinger", "volatility", 0),
    ],
  } as never;
  const b = bakis360(analysis, { timeframes: [{ score: 30 }, { score: 50 }], fundamentals: null });
  const deger = (k: string) => b.acilar.find((a) => a.anahtar === k)!.deger;
  assert.equal(Math.round(deger("trend")!), 63); // (1·1 + 0.5·3) / 4
  assert.equal(Math.round(deger("momentum")!), -60);
  assert.equal(deger("structure"), 80); // üst periyot yapıya karışmaz
  assert.equal(deger("timeframes"), 40);
  assert.equal(deger("volume"), null);
  assert.equal(deger("relative"), null);
  assert.equal(deger("fundamental"), null);
  assert.equal(b.alici, 3);
  assert.equal(b.satici, 1);
  assert.equal(b.notr, 1);
  assert.equal(b.uyum, 3 / 5);
  assert.equal(b.enGuclu?.anahtar, "structure");
  assert.equal(b.enZayif?.anahtar, "momentum");
});

test("endekslerin yer tutucu hacmi (1e100) hacim sayılmaz", () => {
  // Kaynak hacmi olmayan endekslerde 1e100 yolluyor; fiyatla çarpılınca
  // paneldeki toplam hacim 10^104 oluyordu.
  assert.equal(hacimSayisi(1e100), null);
  assert.equal(hacimSayisi(Infinity), null);
  assert.equal(hacimSayisi(-5), null);
  assert.equal(hacimSayisi("12"), null);
  assert.equal(hacimSayisi(835_420_586), 835_420_586);
  assert.equal(hacimSayisi(0), 0);
});

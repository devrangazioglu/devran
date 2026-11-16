/**
 * Dünya borsaları: sembol eşlemesi, borsa tanımı ve grafik akışı çözümleme.
 *
 * Yanlış eşlenen bir sembol kullanıcıya başka bir şirketin fiyatını gösterir;
 * bu yüzden her tanımlı hisse için iki yönlü eşleme ayrı ayrı sınanır.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { BORSALAR, borsa, yahooBorsasindanPiyasa } from "../lib/markets/borsalar";
import { displayTicker, staticInstruments } from "../lib/markets/instruments";
import { kiyasEndeksi } from "../lib/markets/baglam";
import { tvTamAd } from "../lib/markets/tradingview";
import { mumlariCoz, paketiAyir } from "../lib/markets/tv-mum";
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
  assert.equal(await tvTamAd("abd", "^GSPC"), "SP:SPX");
  assert.equal(await tvTamAd("emtia", "GC=F"), "COMEX:GC1!");
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

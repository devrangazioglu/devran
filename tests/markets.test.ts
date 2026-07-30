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
  findStaticInstrument,
  staticInstruments,
  US_INSTRUMENTS,
} from "../lib/markets/instruments";
import { normalizeSymbol } from "../lib/markets/provider";
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
    assert.ok(MARKETS[id].intervals.length >= 5);
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

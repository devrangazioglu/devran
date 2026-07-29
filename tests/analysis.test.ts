/**
 * Sinyal motoru testleri.
 * Çalıştırmak için: npm test
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { analyze, findLevels, signalFromScore } from "../lib/analysis";
import type { Candle } from "../lib/binance";
import { buildCommentary } from "../lib/commentary";

/** Verilen fiyat serisinden mum dizisi üretir. */
function toCandles(closes: number[], noise = 0.004): Candle[] {
  const step = 3_600_000;
  const start = Date.now() - closes.length * step;
  return closes.map((close, i) => {
    const open = i === 0 ? close : closes[i - 1];
    const high = Math.max(open, close) * (1 + noise);
    const low = Math.min(open, close) * (1 - noise);
    return {
      openTime: start + i * step,
      open,
      high,
      low,
      close,
      volume: 1000 + ((i * 53) % 400),
      closeTime: start + (i + 1) * step - 1,
      quoteVolume: (1000 + ((i * 53) % 400)) * close,
      trades: 300 + (i % 50),
    };
  });
}

const RISING = toCandles(Array.from({ length: 260 }, (_, i) => 100 * (1 + i * 0.004)));
const FALLING = toCandles(Array.from({ length: 260 }, (_, i) => 200 * (1 - i * 0.0028)));
const FLAT = toCandles(
  Array.from({ length: 260 }, (_, i) => 100 + Math.sin(i / 3) * 0.6),
);

test("skor eşikleri doğru sinyale çevrilir", () => {
  assert.equal(signalFromScore(80), "GÜÇLÜ AL");
  assert.equal(signalFromScore(25), "AL");
  assert.equal(signalFromScore(0), "BEKLE");
  assert.equal(signalFromScore(-20), "SAT");
  assert.equal(signalFromScore(-70), "GÜÇLÜ SAT");
});

test("yükselen trendde alış sinyali üretir", () => {
  const result = analyze("BTCUSDT", "1h", RISING, "binance");
  assert.ok(result.score > 18, `beklenen pozitif skor, gelen: ${result.score}`);
  assert.ok(["AL", "GÜÇLÜ AL"].includes(result.signal));
  assert.equal(result.trade.side, "LONG");
  assert.ok(result.trade.stopLoss < result.trade.entry);
  assert.ok(result.trade.targets[0] > result.trade.entry);
});

test("düşen trendde satış sinyali üretir", () => {
  const result = analyze("ETHUSDT", "1h", FALLING, "binance");
  assert.ok(result.score < -18, `beklenen negatif skor, gelen: ${result.score}`);
  assert.ok(["SAT", "GÜÇLÜ SAT"].includes(result.signal));
  assert.equal(result.trade.side, "SHORT");
  assert.ok(result.trade.stopLoss > result.trade.entry);
  assert.ok(result.trade.targets[0] < result.trade.entry);
});

test("yatay piyasada skor nötre yakın kalır", () => {
  const result = analyze("XRPUSDT", "1h", FLAT, "binance");
  assert.ok(Math.abs(result.score) < 45, `yatay piyasada aşırı skor: ${result.score}`);
  assert.ok(result.trendStrength.adx !== null);
});

test("skor −100…+100 aralığında, güven 0…100 aralığında kalır", () => {
  for (const candles of [RISING, FALLING, FLAT]) {
    const result = analyze("BTCUSDT", "4h", candles, "binance");
    assert.ok(result.score >= -100 && result.score <= 100);
    assert.ok(result.confidence >= 0 && result.confidence <= 100);
    assert.equal(
      result.tally.al + result.tally.sat + result.tally.notr,
      result.checks.length,
      "oy sayıları gösterge sayısına eşit olmalı",
    );
  }
});

test("her gösterge yön değeri -1 ile 1 arasındadır", () => {
  const result = analyze("BTCUSDT", "4h", RISING, "binance");
  assert.ok(result.checks.length >= 14, `beklenen ≥14 gösterge, gelen: ${result.checks.length}`);
  for (const check of result.checks) {
    assert.ok(
      check.direction >= -1 && check.direction <= 1,
      `${check.id} yönü aralık dışında: ${check.direction}`,
    );
    assert.ok(check.weight > 0);
    assert.ok(check.note.length > 10, `${check.id} için açıklama eksik`);
  }
});

test("yetersiz veride anlamlı hata verir", () => {
  assert.throws(() => analyze("BTCUSDT", "1h", toCandles([1, 2, 3]), "binance"), /yeterli mum/);
});

test("destek seviyeleri fiyatın altında, dirençler üstündedir", () => {
  const candles = toCandles(
    Array.from({ length: 200 }, (_, i) => 100 + Math.sin(i / 7) * 12),
  );
  const price = candles[candles.length - 1].close;
  const { supports, resistances } = findLevels(candles, price);
  for (const level of supports) {
    assert.ok(level.price < price);
    assert.ok(level.strength >= 1 && level.strength <= 5);
  }
  for (const level of resistances) {
    assert.ok(level.price > price);
  }
});

test("yorum motoru dolu Türkçe metin üretir", () => {
  const result = analyze("BTCUSDT", "4h", RISING, "binance");
  const commentary = buildCommentary(result);
  assert.ok(commentary.headline.includes("BTC/USDT"));
  assert.ok(commentary.paragraphs.length >= 5);
  assert.ok(commentary.risks.length >= 1);
  for (const paragraph of commentary.paragraphs) {
    assert.ok(paragraph.length > 40, "paragraflar boş olmamalı");
    assert.ok(!paragraph.includes("undefined"), `metinde undefined var: ${paragraph}`);
    assert.ok(!paragraph.includes("NaN"), `metinde NaN var: ${paragraph}`);
  }
  for (const item of [...commentary.highlights, ...commentary.risks]) {
    assert.ok(!item.includes("undefined"));
    assert.ok(!item.includes("NaN"));
  }
});

test("demo veri kaynağı risk uyarısı olarak belirtilir", () => {
  const result = analyze("BTCUSDT", "4h", RISING, "demo");
  const commentary = buildCommentary(result);
  assert.ok(commentary.risks.some((risk) => risk.includes("DEMO")));
});

/**
 * Sinyal motoru testleri.
 * Çalıştırmak için: npm test
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { analyze, findLevels, signalFromScore } from "../lib/analysis";
import { renderNote, renderValue } from "../lib/analysis-text";
import { buildCommentary } from "../lib/commentary";
import { makeT } from "../lib/i18n";
import type { Candle, Instrument, MarketId } from "../lib/markets/types";

function instrument(market: MarketId, symbol: string, ticker = symbol): Instrument {
  return {
    id: `${market}:${symbol}`,
    market,
    symbol,
    name: ticker,
    ticker,
    currency: market === "bist" ? "TRY" : "USD",
    kind: market === "kripto" ? "kripto" : "hisse",
  };
}

const BTC = instrument("kripto", "BTCUSDT", "BTC/USDT");
const AAPL = instrument("abd", "AAPL");
const THYAO = instrument("bist", "THYAO.IS", "THYAO");
const GOLD = instrument("emtia", "GC=F", "XAU");

/** Verilen fiyat serisinden mum dizisi üretir. */
function toCandles(closes: number[], noise = 0.004): Candle[] {
  const step = 3_600_000;
  const start = Date.now() - closes.length * step;
  return closes.map((close, i) => {
    const open = i === 0 ? close : closes[i - 1];
    return {
      openTime: start + i * step,
      open,
      high: Math.max(open, close) * (1 + noise),
      low: Math.min(open, close) * (1 - noise),
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
const FLAT = toCandles(Array.from({ length: 260 }, (_, i) => 100 + Math.sin(i / 3) * 0.6));

test("skor eşikleri doğru sinyale çevrilir", () => {
  assert.equal(signalFromScore(80), "STRONG_BUY");
  assert.equal(signalFromScore(25), "BUY");
  assert.equal(signalFromScore(0), "WAIT");
  assert.equal(signalFromScore(-20), "SELL");
  assert.equal(signalFromScore(-70), "STRONG_SELL");
});

test("yükselen trendde alış sinyali üretir", () => {
  const result = analyze(BTC, "1h", RISING, "canli");
  assert.ok(result.score > 18, `beklenen pozitif skor, gelen: ${result.score}`);
  assert.ok(["BUY", "STRONG_BUY"].includes(result.signal));
  assert.equal(result.trade.side, "LONG");
  assert.ok(result.trade.stopLoss < result.trade.entry);
  assert.ok(result.trade.targets[0] > result.trade.entry);
});

test("düşen trendde satış sinyali üretir", () => {
  const result = analyze(AAPL, "1d", FALLING, "canli");
  assert.ok(result.score < -18, `beklenen negatif skor, gelen: ${result.score}`);
  assert.ok(["SELL", "STRONG_SELL"].includes(result.signal));
  assert.equal(result.trade.side, "SHORT");
  assert.ok(result.trade.stopLoss > result.trade.entry);
  assert.ok(result.trade.targets[0] < result.trade.entry);
});

test("yatay piyasada skor nötre yakın kalır", () => {
  const result = analyze(THYAO, "1h", FLAT, "canli");
  assert.ok(Math.abs(result.score) < 45, `yatay piyasada aşırı skor: ${result.score}`);
  assert.ok(result.trendStrength.adx !== null);
});

test("motor her piyasa için aynı şekilde çalışır", () => {
  for (const asset of [BTC, AAPL, THYAO, GOLD]) {
    const result = analyze(asset, "1d", RISING, "canli");
    assert.equal(result.instrument.market, asset.market);
    assert.equal(result.instrument.ticker, asset.ticker);
    assert.ok(result.checks.length >= 14);
    assert.ok(result.score >= -100 && result.score <= 100);
  }
});

test("skor −100…+100, güven 0…100 aralığında kalır", () => {
  for (const candles of [RISING, FALLING, FLAT]) {
    const result = analyze(BTC, "4h", candles, "canli");
    assert.ok(result.score >= -100 && result.score <= 100);
    assert.ok(result.confidence >= 0 && result.confidence <= 100);
    assert.equal(
      result.tally.buy + result.tally.sell + result.tally.neutral,
      result.checks.length,
      "oy sayıları gösterge sayısına eşit olmalı",
    );
  }
});

test("her gösterge geçerli yön, ağırlık ve çeviri anahtarı taşır", () => {
  const result = analyze(BTC, "4h", RISING, "canli");
  assert.ok(result.checks.length >= 14, `beklenen ≥14 gösterge, gelen: ${result.checks.length}`);

  for (const check of result.checks) {
    assert.ok(
      check.direction >= -1 && check.direction <= 1,
      `${check.id} yönü aralık dışında: ${check.direction}`,
    );
    assert.ok(check.weight > 0);
    assert.match(check.labelKey, /^ind\./);
    assert.match(check.noteKey, /^note\./);
    assert.ok(["trend", "momentum", "volatility", "volume"].includes(check.category));
    assert.ok(check.value.length > 0, `${check.id} için değer parçası yok`);
  }
});

test("gösterge metinleri Türkçe ve İngilizce olarak üretilebilir", () => {
  const result = analyze(BTC, "4h", RISING, "canli");
  for (const locale of ["tr", "en"] as const) {
    const t = makeT(locale);
    for (const check of result.checks) {
      const label = t(check.labelKey as "ind.rsi");
      const note = renderNote(t, check);
      const value = renderValue(check.value, locale === "tr" ? "tr-TR" : "en-US");

      assert.ok(!label.startsWith("ind."), `çeviri eksik: ${check.labelKey} (${locale})`);
      assert.ok(!note.startsWith("note."), `çeviri eksik: ${check.noteKey} (${locale})`);
      assert.ok(note.length > 10, `${check.id} açıklaması kısa (${locale})`);
      assert.ok(!note.includes("{"), `açıklamada boş yer tutucu var: ${note}`);
      assert.ok(!value.includes("NaN"), `değerde NaN var: ${value}`);
    }
  }
});

test("yetersiz veride anlamlı hata verir", () => {
  assert.throws(() => analyze(BTC, "1h", toCandles([1, 2, 3]), "canli"), /yeterli mum/);
});

test("destek seviyeleri fiyatın altında, dirençler üstündedir", () => {
  const candles = toCandles(Array.from({ length: 200 }, (_, i) => 100 + Math.sin(i / 7) * 12));
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

test("yorum motoru her dilde dolu metin üretir", () => {
  const result = analyze(BTC, "4h", RISING, "canli");

  for (const locale of ["tr", "en", "de", "ar"] as const) {
    const commentary = buildCommentary(result, locale);
    assert.ok(commentary.headline.includes("BTC/USDT"), `başlıkta varlık yok (${locale})`);
    assert.ok(commentary.paragraphs.length >= 5, `paragraf eksik (${locale})`);
    assert.ok(commentary.risks.length >= 1);

    for (const text of [...commentary.paragraphs, ...commentary.highlights, ...commentary.risks]) {
      assert.ok(text.length > 10, `kısa metin (${locale}): ${text}`);
      assert.ok(!text.includes("undefined"), `metinde undefined var (${locale}): ${text}`);
      assert.ok(!text.includes("NaN"), `metinde NaN var (${locale}): ${text}`);
      assert.ok(!text.includes("{"), `metinde boş yer tutucu var (${locale}): ${text}`);
      // Çevrilmemiş anahtar "note.rsi.overbought" gibi görünür; cümle içindeki
      // "a risk." gibi normal metinleri yakalamamak için noktadan sonra harf arıyoruz.
      assert.ok(
        !/(?:^|\s)(commentary|note|risk|pattern|ind|signal|verdict|trend|vol)\.[a-zA-Z]/.test(text),
        `çevrilmemiş anahtar (${locale}): ${text}`,
      );
    }
  }
});

test("hisse analizinde seans uyarısı, demo veride demo uyarısı verilir", () => {
  const stock = buildCommentary(analyze(AAPL, "1d", RISING, "canli"), "tr");
  assert.ok(stock.risks.some((risk) => risk.includes("kapalı")));

  const demo = buildCommentary(analyze(BTC, "4h", RISING, "demo"), "tr");
  assert.ok(demo.risks.some((risk) => risk.includes("DEMO")));
});

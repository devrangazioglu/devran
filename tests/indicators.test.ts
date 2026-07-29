/**
 * Gösterge birim testleri.
 * Çalıştırmak için: npm test
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  adx,
  atr,
  bollinger,
  cci,
  ema,
  last,
  macd,
  mfi,
  obv,
  rsi,
  sma,
  stochastic,
  supertrend,
  williamsR,
} from "../lib/indicators";

/** Wilder'ın RSI örneğindeki referans kapanışlar. */
const CLOSES = [
  44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61,
  46.28, 46.28, 46.0, 46.03, 46.41, 46.22, 45.64, 46.21, 46.25, 45.71, 46.45, 45.78, 45.35,
  44.03, 44.18, 44.22, 44.57, 43.42, 42.66, 43.13,
];
const HIGHS = CLOSES.map((c) => c * 1.008);
const LOWS = CLOSES.map((c) => c * 0.992);
const VOLUMES = CLOSES.map((_, i) => 1000 + ((i * 37) % 500));

test("SMA kayan pencere ortalamasını doğru hesaplar", () => {
  const values = [1, 2, 3, 4, 5, 6];
  const result = sma(values, 3);
  assert.equal(result[0], null);
  assert.equal(result[1], null);
  assert.equal(result[2], 2); // (1+2+3)/3
  assert.equal(result[5], 5); // (4+5+6)/3
});

test("EMA ilk değeri SMA ile tohumlar ve uzunluğu korur", () => {
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const result = ema(values, 3);
  assert.equal(result.length, values.length);
  assert.equal(result[1], null);
  assert.equal(result[2], 2); // ilk üç değerin ortalaması
  const lastValue = last(result);
  assert.ok(lastValue !== null && lastValue > 8 && lastValue < 10);
});

test("RSI, Wilder referans değerlerini üretir", () => {
  const result = rsi(CLOSES, 14);
  assert.equal(result[13], null, "ısınma döneminde değer olmamalı");
  assert.ok(Math.abs((result[14] as number) - 70.46) < 0.1);
  assert.ok(Math.abs((last(result) as number) - 37.77) < 0.1);
});

test("RSI 0-100 aralığında kalır ve tek yönlü seride uçlara gider", () => {
  const rising = Array.from({ length: 40 }, (_, i) => 100 + i * 2);
  const falling = Array.from({ length: 40 }, (_, i) => 200 - i * 2);
  assert.equal(last(rsi(rising, 14)), 100);
  assert.equal(last(rsi(falling, 14)), 0);
});

test("MACD, sinyal ve histogram tutarlıdır", () => {
  const values = Array.from({ length: 120 }, (_, i) => 100 + Math.sin(i / 6) * 8 + i * 0.15);
  const { macd: line, signal, histogram } = macd(values);
  const index = values.length - 1;
  assert.ok(line[index] !== null && signal[index] !== null && histogram[index] !== null);
  assert.ok(
    Math.abs((histogram[index] as number) - ((line[index] as number) - (signal[index] as number))) <
      1e-9,
    "histogram = MACD − sinyal olmalı",
  );
});

test("Bollinger bantları fiyatı çevreler ve %B 0-1 arasında kalır", () => {
  const { upper, middle, lower, percentB } = bollinger(CLOSES, 20, 2);
  const index = CLOSES.length - 1;
  assert.ok((upper[index] as number) > (middle[index] as number));
  assert.ok((middle[index] as number) > (lower[index] as number));
  const b = percentB[index] as number;
  assert.ok(b >= -0.5 && b <= 1.5);
});

test("ATR pozitif ve fiyat aralığıyla uyumludur", () => {
  const value = last(atr(HIGHS, LOWS, CLOSES, 14)) as number;
  assert.ok(value > 0);
  assert.ok(value < 5, "ATR fiyat aralığına göre makul olmalı");
});

test("ADX ve DI göstergeleri 0-100 aralığındadır", () => {
  const { adx: adxSeries, plusDI, minusDI } = adx(HIGHS, LOWS, CLOSES, 14);
  const value = last(adxSeries) as number;
  assert.ok(value >= 0 && value <= 100);
  assert.ok((last(plusDI) as number) >= 0);
  assert.ok((last(minusDI) as number) >= 0);
});

test("Stokastik %K sınırlar içinde ve zirvede yüksektir", () => {
  const { k, d } = stochastic(HIGHS, LOWS, CLOSES);
  const value = last(k) as number;
  assert.ok(value >= 0 && value <= 100);
  assert.ok(last(d) !== null);

  // Sürekli yükselen seride %K üst bölgede olmalı.
  const rising = Array.from({ length: 40 }, (_, i) => 10 + i);
  const up = stochastic(
    rising.map((v) => v + 0.5),
    rising.map((v) => v - 0.5),
    rising,
  );
  assert.ok((last(up.k) as number) > 80);
});

test("Williams %R -100 ile 0 arasındadır", () => {
  const value = last(williamsR(HIGHS, LOWS, CLOSES, 14)) as number;
  assert.ok(value <= 0 && value >= -100);
});

test("OBV yükselen kapanışlarda artar", () => {
  const closes = [10, 11, 12, 13];
  const volumes = [100, 200, 300, 400];
  const result = obv(closes, volumes);
  assert.equal(result[3], 900); // 200 + 300 + 400
});

test("MFI 0-100 aralığındadır", () => {
  const value = last(mfi(HIGHS, LOWS, CLOSES, VOLUMES, 14)) as number;
  assert.ok(value >= 0 && value <= 100);
});

test("CCI aşırı yükselişte pozitif olur", () => {
  const rising = Array.from({ length: 60 }, (_, i) => 100 + i * 1.5);
  const value = last(
    cci(
      rising.map((v) => v + 0.5),
      rising.map((v) => v - 0.5),
      rising,
      20,
    ),
  ) as number;
  assert.ok(value > 100, `CCI güçlü yükselişte +100 üzerinde olmalı, gelen: ${value}`);
});

test("Supertrend yükselen trendde alıcı tarafı gösterir", () => {
  const rising = Array.from({ length: 80 }, (_, i) => 100 + i * 1.2);
  const { direction, value } = supertrend(
    rising.map((v) => v + 0.6),
    rising.map((v) => v - 0.6),
    rising,
    10,
    3,
  );
  assert.equal(direction[direction.length - 1], 1);
  const level = last(value) as number;
  assert.ok(level < rising[rising.length - 1], "yükselişte supertrend fiyatın altında olmalı");
});

test("Göstergeler girdiyle aynı uzunlukta dizi döndürür", () => {
  assert.equal(rsi(CLOSES, 14).length, CLOSES.length);
  assert.equal(sma(CLOSES, 20).length, CLOSES.length);
  assert.equal(atr(HIGHS, LOWS, CLOSES, 14).length, CLOSES.length);
  assert.equal(macd(CLOSES).macd.length, CLOSES.length);
});

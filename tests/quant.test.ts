/**
 * Olasılık ve risk matematiği testleri.
 * Çalıştırmak için: npm test
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { analyze } from "../lib/analysis";
import type { Candle, Instrument } from "../lib/markets/types";
import {
  barsPerYear,
  calibrate,
  edgeStats,
  expectedMove,
  hurstExponent,
  hurstKeyOf,
  logReturns,
  marketRelation,
  maxDrawdown,
  positionPercent,
  stdev,
  zScore,
} from "../lib/quant";

/** Tohumlanmış sözde rastgele sayı (testler deterministik kalsın). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Standart normal (Box–Muller). */
function gauss(next: () => number) {
  const u = Math.max(next(), 1e-12);
  const v = next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

test("yıllık mum sayısı varlık sınıfına göre", () => {
  assert.equal(barsPerYear("kripto", "1d"), 365);
  assert.equal(barsPerYear("kripto", "4h"), 365 * 6);
  assert.equal(barsPerYear("hisse", "1d"), 252);
  assert.equal(barsPerYear("hisse", "1w"), 52);
  assert.equal(barsPerYear("doviz", "1d"), 252);
});

test("σ√t bantları simetrik (log ölçekte) ve büyüyen ufukla genişler", () => {
  const m10 = expectedMove(100, 0.02, 10);
  const m40 = expectedMove(100, 0.02, 40);
  // √10 · 0,02 ≈ 0,0632
  assert.ok(Math.abs(m10.high1 - 100 * Math.exp(0.02 * Math.sqrt(10))) < 1e-9);
  assert.ok(Math.abs(m10.low1 * m10.high1 - 100 * 100) < 1e-6, "log-simetri");
  assert.ok(m10.low2 < m10.low1 && m10.high2 > m10.high1);
  // Dört kat ufuk → iki kat σ.
  assert.ok(Math.abs(Math.log(m40.high1 / 100) - 2 * Math.log(m10.high1 / 100)) < 1e-9);
});

test("en büyük düşüş ve z-skor", () => {
  assert.equal(maxDrawdown([100, 120, 90, 130, 117]), -25);
  assert.equal(maxDrawdown([1, 2, 3]), 0);
  const flat = new Array(20).fill(50);
  assert.equal(zScore(flat), 0);
  const up = [...new Array(19).fill(100), 110];
  assert.ok((zScore(up) ?? 0) > 4);
  assert.equal(zScore([1, 2, 3]), null);
});

test("Hurst: rastgele yürüyüş ≈ 0,5, kalıcı seri > 0,5, ters dönen seri < 0,5", () => {
  const next = rng(7);
  const white = Array.from({ length: 500 }, () => gauss(next));
  const h0 = hurstExponent(white);
  assert.ok(h0 !== null && Math.abs(h0 - 0.5) < 0.12, `rastgele: ${h0}`);

  // AR(1) getiriler: φ > 0 kalıcılık, φ < 0 ters dönüş.
  const ar = (phi: number) => {
    const g = rng(11);
    const out: number[] = [0];
    for (let i = 1; i < 500; i++) out.push(phi * out[i - 1] + gauss(g));
    return out;
  };
  const hPos = hurstExponent(ar(0.5));
  const hNeg = hurstExponent(ar(-0.5));
  assert.ok(hPos !== null && hPos > 0.55, `kalıcı: ${hPos}`);
  assert.ok(hNeg !== null && hNeg < 0.45, `ters: ${hNeg}`);

  assert.equal(hurstExponent(white.slice(0, 50)), null, "kısa seride hesaplanmaz");
  assert.equal(hurstKeyOf(0.47), "quant.hurst.random");
  assert.equal(hurstKeyOf(0.65), "quant.hurst.trending");
  assert.equal(hurstKeyOf(0.3), "quant.hurst.meanReverting");
});

test("beta ve korelasyon bilinen ilişkiyi bulur", () => {
  const next = rng(3);
  const index: number[] = [1000];
  const asset: number[] = [50];
  for (let i = 1; i < 260; i++) {
    const rm = 0.01 * gauss(next);
    const noise = 0.005 * gauss(next);
    index.push(index[i - 1] * Math.exp(rm));
    asset.push(asset[i - 1] * Math.exp(1.5 * rm + noise));
  }
  const rel = marketRelation(asset, index, "SPX", 252);
  assert.ok(rel);
  assert.ok(Math.abs(rel.beta - 1.5) < 0.15, `beta: ${rel.beta}`);
  assert.ok(rel.correlation > 0.9, `korelasyon: ${rel.correlation}`);

  // Eksik endeks değerleri atlanır; yetersiz örnekte null.
  const sparse = index.map((v, i) => (i % 10 === 0 ? v : null));
  assert.equal(marketRelation(asset, sparse, "SPX", 252), null);
});

test("lojistik kalibrasyon: bilgilendirici skor eğimi pozitif, bilgisiz skor taban orana yakın", () => {
  const next = rng(5);
  const scores: number[] = [];
  const informative: number[] = [];
  const noise: number[] = [];
  for (let i = 0; i < 400; i++) {
    const s = (next() * 2 - 1) * 80;
    scores.push(s);
    const p = 1 / (1 + Math.exp(-s / 25));
    informative.push(next() < p ? 1 : -1);
    noise.push(next() < 0.55 ? 1 : -1);
  }
  const good = calibrate(scores, informative, 60);
  assert.ok(good && good.slope > 0.5, `eğim: ${good?.slope}`);
  assert.ok(good.up > 0.75, `olasılık: ${good.up}`);

  const flat = calibrate(scores, noise, 60);
  assert.ok(flat);
  assert.ok(Math.abs(flat.up - flat.baseRate) < 0.08, `bilgisiz: ${flat.up} / ${flat.baseRate}`);

  assert.equal(calibrate(scores.slice(0, 10), noise.slice(0, 10), 0), null, "az örnek");
});

test("beklenti, kâr faktörü ve Kelly", () => {
  // 6 kazanç (+2) ve 4 kayıp (−1): p=0,6, R=2.
  const forwards = [2, 2, 2, 2, 2, 2, -1, -1, -1, -1];
  const e = edgeStats("BUY", forwards, 0.5);
  assert.ok(e);
  assert.equal(e.winRate, 0.6);
  assert.equal(e.payoff, 2);
  assert.ok(Math.abs(e.expectancy - (0.6 * 2 - 0.4 * 1)) < 1e-9);
  assert.equal(e.profitFactor, 3);
  // Büzülmüş p = (6 + 10·0,5) / 20 = 0,55 → Kelly = 0,55 − 0,45/2 = 0,325.
  assert.ok(Math.abs(e.kelly - 0.325) < 1e-9);
  assert.ok(Math.abs(e.halfKelly - 0.1625) < 1e-12);
  assert.equal(e.reliable, false);

  // SELL'de düşüş kazançtır.
  const s = edgeStats("SELL", [-3, -3, 1], 0.5);
  assert.ok(s && s.winRate > 0.6 && s.expectancy > 0);

  // Avantaj yoksa Kelly sıfırlanır.
  const bad = edgeStats("BUY", [1, -2, -2, 1, -2, -2, 1, -2, -2, -2, -2, -2], 0.5);
  assert.ok(bad && bad.kelly < 0 && bad.halfKelly === 0);
});

test("pozisyon büyüklüğü sabit riskten türetilir", () => {
  assert.equal(positionPercent(2), 50); // %2 stop → sermayenin yarısı = %1 risk
  assert.equal(positionPercent(0.5), 100); // kaldıraçsız üst sınır
  assert.equal(positionPercent(0), null);
});

test("analyze çıktısı quant bloğunu içerir ve skoru değiştirmez", () => {
  const next = rng(21);
  const candles: Candle[] = [];
  let price = 100;
  for (let i = 0; i < 300; i++) {
    const open = price;
    price = price * Math.exp(0.0005 + 0.015 * gauss(next));
    const high = Math.max(open, price) * (1 + 0.004 * next());
    const low = Math.min(open, price) * (1 - 0.004 * next());
    candles.push({
      openTime: Date.UTC(2025, 0, 1) + i * 86_400_000,
      open,
      high,
      low,
      close: price,
      volume: 1000 + 500 * next(),
      closeTime: Date.UTC(2025, 0, 1) + (i + 1) * 86_400_000 - 1,
      quoteVolume: 0,
      trades: 0,
    });
  }
  const AAPL: Instrument = {
    id: "abd:AAPL",
    market: "abd",
    symbol: "AAPL",
    name: "AAPL",
    ticker: "AAPL",
    currency: "USD",
    kind: "hisse",
  };

  const a = analyze(AAPL, "1d", candles, "demo");
  const q = a.quant;
  assert.equal(q.barsPerYear, 252);
  assert.equal(q.horizon, a.backtest?.horizon);
  // Üretilen seri ~%1,5 günlük oynaklıkla kuruldu.
  const sd = stdev(logReturns(candles.map((c) => c.close)).slice(-250));
  assert.ok(Math.abs(q.volPerBar - sd) < 1e-12);
  assert.ok(q.volPerBar > 0.01 && q.volPerBar < 0.02, `σ: ${q.volPerBar}`);
  assert.ok(q.expectedMove.low1 < a.price && q.expectedMove.high1 > a.price);
  assert.ok(q.probability && q.probability.up > 0 && q.probability.up < 1);
  assert.ok(q.hurst !== null);
  assert.equal(q.market, null, "endeks verilmediğinde beta yok");

  // Geçmiş sınaması kapalıyken olasılık ve beklenti de yok; skor aynı.
  const b = analyze(AAPL, "1d", candles, "demo", { backtest: false });
  assert.equal(b.quant.probability, null);
  assert.equal(b.quant.edge, null);
  assert.equal(b.score, a.score);
});

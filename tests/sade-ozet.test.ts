/**
 * Sade özet: teknik terim içermemeli, her sinyalde dolu ve tutarlı olmalı.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { analyze } from "../lib/analysis";
import { temelPuanla, type TemelSatir } from "../lib/fundamentals";
import type { Candle, Instrument } from "../lib/markets/types";
import { sadeOzet } from "../lib/sade-ozet";

const HISSE: Instrument = {
  id: "bist:THYAO.IS",
  market: "bist",
  symbol: "THYAO.IS",
  name: "THY",
  ticker: "THYAO",
  currency: "TRY",
  kind: "hisse",
};
const ALTIN: Instrument = { ...HISSE, id: "emtia:GC=F", market: "emtia", symbol: "GC=F", ticker: "XAU", kind: "emtia" };

function mumlar(fiyat: (i: number) => number, adet = 280): Candle[] {
  return Array.from({ length: adet }, (_, i) => {
    const close = fiyat(i);
    const open = i === 0 ? close : fiyat(i - 1);
    return {
      openTime: Date.UTC(2025, 0, 1) + i * 86_400_000,
      open,
      high: Math.max(open, close) * 1.006,
      low: Math.min(open, close) * 0.994,
      close,
      volume: 1000 + ((i * 37) % 300),
      closeTime: Date.UTC(2025, 0, 1) + (i + 1) * 86_400_000 - 1,
      quoteVolume: close * 1000,
      trades: 10,
    };
  });
}

const SERILER = {
  yukselen: mumlar((i) => 100 * (1 + i * 0.004)),
  dusen: mumlar((i) => 200 * (1 - i * 0.0028)),
  yatay: mumlar((i) => 100 + Math.sin(i / 4) * 3),
};

/** Teknik analiz bilmeyen birinin tanımayacağı terimler. */
const TERIMLER = /\b(RSI|MACD|EMA|SMA|ADX|ATR|VWAP|OBV|MFI|CCI|Bollinger|Stokastik|Stochastic|Supertrend|Williams|pivot|osilat|momentum)\b/i;

test("sade özet her durumda dolu, terimsiz ve yer tutucusuz", () => {
  for (const [ad, seri] of Object.entries(SERILER)) {
    for (const varlik of [HISSE, ALTIN]) {
      const analiz = analyze(varlik, "1d", seri, "canli");
      for (const dil of ["tr", "en"] as const) {
        const ozet = sadeOzet(analiz, dil);
        const metinler = [ozet.baslik, ozet.uyari, ...ozet.maddeler.map((m) => m.metin)];
        assert.ok(ozet.maddeler.length >= 3, `${ad}/${varlik.ticker}/${dil}: madde az`);
        assert.ok(ozet.baslik.includes(varlik.ticker), `${ad}: başlıkta varlık adı yok`);
        for (const metin of metinler) {
          assert.ok(!metin.includes("{"), `boş yer tutucu (${ad}/${dil}): ${metin}`);
          assert.ok(!/plain\.|regime\.|fund\./.test(metin), `çevrilmemiş anahtar (${ad}/${dil}): ${metin}`);
          assert.ok(!TERIMLER.test(metin), `teknik terim (${ad}/${dil}): ${metin}`);
        }
      }
    }
  }
});

test("özetin tonu ve başlığı sinyalle uyumlu", () => {
  const yukselen = analyze(ALTIN, "1d", SERILER.yukselen, "canli");
  const ozet = sadeOzet(yukselen, "tr");
  assert.ok(["BUY", "STRONG_BUY"].includes(yukselen.signal));
  assert.equal(ozet.ton, "up");
  assert.match(ozet.baslik, /olumlu/);
  // Sinyal varken "nerede geçersiz olur" maddesi bulunur.
  assert.ok(ozet.maddeler.some((m) => m.metin.includes("geçersiz")));

  const yatay = analyze(HISSE, "1d", SERILER.yatay, "canli");
  if (yatay.signal === "WAIT") {
    const o = sadeOzet(yatay, "tr");
    assert.equal(o.ton, "flat");
    assert.ok(!o.maddeler.some((m) => m.metin.includes("geçersiz")), "BEKLE iken zarar durdur önerilmez");
  }
});

test("süre ifadesi periyoda göre değişir", () => {
  const a = analyze(ALTIN, "1d", SERILER.yukselen, "canli");
  assert.match(sadeOzet(a, "tr").baslik, /bir-iki haftada/);
  const b = analyze(ALTIN, "1h", SERILER.yukselen, "canli");
  assert.match(sadeOzet(b, "tr").baslik, /bir-iki günde/);
});

test("temel analiz varsa şirketin mali durumu sade dille eklenir", () => {
  const satir = (code: string, ek: Partial<TemelSatir> = {}): TemelSatir => ({
    code, sector: "Transportation", marketCap: 1, eps: 1, pe: 10, pb: 1, ps: 1, evEbitda: 5,
    roe: 10, netMargin: 10, operatingMargin: 10, revenueGrowth: 10, epsGrowth: 10,
    debtToEquity: 1, currentRatio: 1, dividendYield: 1, analystRating: 2, ...ek,
  });
  const evren = Array.from({ length: 12 }, (_, i) => satir(`E${i}`, { pe: 5 + i, roe: 20 - i }));
  const temel = temelPuanla(satir("THYAO", { eps: -1, pe: null }), evren);
  assert.ok(temel);
  const ozet = sadeOzet(analyze(HISSE, "1d", SERILER.yatay, "canli"), "tr", { fundamentals: temel });
  const metin = ozet.maddeler.map((m) => m.metin).join(" ");
  assert.match(metin, /mali durumu/);
  assert.match(metin, /zarar etti/);
});

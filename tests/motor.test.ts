/**
 * Sinyal motorunun ikinci sürümüne özgü davranışlar: varlık sınıfı profili,
 * motor içi üst zaman dilimi, hacimsiz varlıklar, kıyas endeksi, geçmiş
 * sınaması ve bunların yoruma yansıması.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { analyze } from "../lib/analysis";
import { backtestVerdictKey, buildCommentary } from "../lib/commentary";
import type { AssetKind, Candle, Instrument, MarketId } from "../lib/markets/types";

function instrument(market: MarketId, symbol: string, kind: AssetKind): Instrument {
  return { id: `${market}:${symbol}`, market, symbol, name: symbol, ticker: symbol, currency: "USD", kind };
}

const HISSE = instrument("abd", "AAPL", "hisse");
const EMTIA = instrument("emtia", "GC=F", "emtia");
const DOVIZ = instrument("emtia", "EURUSD=X", "doviz");
const KRIPTO = instrument("kripto", "ETHUSDT", "kripto");

function toCandles(closes: number[], volume: (i: number) => number = (i) => 1000 + ((i * 53) % 400)): Candle[] {
  const step = 86_400_000;
  const start = Date.UTC(2025, 0, 1);
  return closes.map((close, i) => {
    const open = i === 0 ? close : closes[i - 1];
    return {
      openTime: start + i * step,
      open,
      high: Math.max(open, close) * 1.004,
      low: Math.min(open, close) * 0.996,
      close,
      volume: volume(i),
      closeTime: start + (i + 1) * step - 1,
      quoteVolume: volume(i) * close,
      trades: 100,
    };
  });
}

/** Tekrarlanabilir sözde rastgele sayı (testler her çalışmada aynı veriyi görsün). */
function rastgele(tohum: number): () => number {
  let s = tohum;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const DUSEN = toCandles(Array.from({ length: 260 }, (_, i) => 200 * (1 - i * 0.0028)));
const YUKSELEN = toCandles(Array.from({ length: 260 }, (_, i) => 100 * (1 + i * 0.004)));
const DALGALI = (() => {
  const r = rastgele(7);
  let fiyat = 100;
  return toCandles(
    Array.from({ length: 300 }, (_, i) => {
      fiyat *= 1 + (r() - 0.5) * 0.03 + Math.sin(i / 25) * 0.004;
      return fiyat;
    }),
  );
})();

test("aynı düşüşte emtia SAT verir, hisse daha temkinli kalır", () => {
  // Ölçüm sonucu: emtiada başlamış hareket sürüyor, hissede aşırı satım geri
  // dönüyor. Aynı mumlar bu yüzden iki varlık sınıfında farklı okunur.
  const emtia = analyze(EMTIA, "1d", DUSEN, "canli");
  const hisse = analyze(HISSE, "1d", DUSEN, "canli");

  assert.ok(emtia.score < -18, `emtia skoru: ${emtia.score}`);
  assert.ok(hisse.score > emtia.score + 10, `hisse ${hisse.score}, emtia ${emtia.score}`);
  assert.equal(emtia.profileKey, "profile.trend");
  assert.equal(hisse.profileKey, "profile.equity");
});

test("aynı yükselişte hisse, emtiadan daha az iyimserdir", () => {
  const emtia = analyze(EMTIA, "1d", YUKSELEN, "canli");
  const hisse = analyze(HISSE, "1d", YUKSELEN, "canli");
  assert.ok(emtia.score > 18);
  assert.ok(hisse.score < emtia.score);
});

test("ortalamadan uzaklık göstergesi yalnızca hisse profilinde vardır", () => {
  const kimlikler = (i: Instrument) => analyze(i, "1d", DALGALI, "canli").checks.map((c) => c.id);
  assert.ok(kimlikler(HISSE).includes("extension"));
  assert.ok(!kimlikler(EMTIA).includes("extension"));
  assert.ok(!kimlikler(KRIPTO).includes("extension"));
});

test("profil varlık sınıfı ve periyoda göre seçilir", () => {
  assert.equal(analyze(KRIPTO, "4h", DALGALI, "canli").profileKey, "profile.crypto");
  assert.equal(analyze(DOVIZ, "1d", DALGALI, "canli").profileKey, "profile.trend");
  assert.equal(analyze(HISSE, "1w", DALGALI, "canli").profileKey, "profile.equityWeekly");
  assert.equal(
    analyze(instrument("bist", "XU100.IS", "endeks"), "1d", DALGALI, "canli").profileKey,
    "profile.equity",
  );
});

test("üst zaman dilimi eldeki mumlardan türetilir", () => {
  const gunluk = analyze(EMTIA, "1d", YUKSELEN, "canli");
  const ust = gunluk.checks.find((c) => c.id === "higher-tf");
  assert.ok(ust, "günlükte üst periyot göstergesi olmalı");
  assert.equal(ust.verdict, "BUY", "düzenli yükselişte haftalık görünüm de yukarı olmalı");

  // Haftalığın üstü tanımlı değil.
  const haftalik = analyze(EMTIA, "1w", YUKSELEN, "canli");
  assert.ok(!haftalik.checks.some((c) => c.id === "higher-tf"));

  // Yeterli mum yoksa uydurulmaz: 100 günlük mum 20 haftalık mum eder.
  const kisa = analyze(EMTIA, "1d", YUKSELEN.slice(-100), "canli");
  assert.ok(!kisa.checks.some((c) => c.id === "higher-tf"));

  // Açıkça null verilirse kullanılmaz.
  const kapali = analyze(EMTIA, "1d", YUKSELEN, "canli", { higher: null });
  assert.ok(!kapali.checks.some((c) => c.id === "higher-tf"));
});

test("aynı girdiler aynı sonucu verir (tarayıcı ve detay sayfası tutarlılığı)", () => {
  const a = analyze(HISSE, "1d", DALGALI, "canli");
  const b = analyze(HISSE, "1d", DALGALI, "canli");
  assert.equal(a.score, b.score);
  assert.equal(a.confidence, b.confidence);
  assert.deepEqual(a.backtest, b.backtest);
});

test("hacim verisi olmayan varlıkta hacim göstergeleri oy kullanmaz", () => {
  // Döviz kurlarında hacim sıfır gelir; MFI bu veriyle 100 çıkıyor ve sahte
  // bir "aşırı alım" oyu üretiyordu.
  const hacimsiz = toCandles(
    DALGALI.map((c) => c.close),
    () => 0,
  );
  const sonuc = analyze(DOVIZ, "1d", hacimsiz, "canli");
  const kimlikler = sonuc.checks.map((c) => c.id);
  for (const id of ["mfi", "obv", "vwap", "volume"]) {
    assert.ok(!kimlikler.includes(id), `${id} hacimsiz veride olmamalı`);
  }
  assert.equal(sonuc.indicators.mfi, null);
  assert.equal(sonuc.indicators.obv, null);
  assert.equal(sonuc.indicators.vwap, null);
});

test("kıyas endeksi verilince göreli güç hesaplanır", () => {
  const endeks = toCandles(DALGALI.map((_, i) => 100 * (1 + i * 0.0005)));
  const guclu = toCandles(DALGALI.map((_, i) => 50 * (1 + i * 0.004)));

  const endekssiz = analyze(KRIPTO, "1d", guclu, "canli");
  assert.ok(!endekssiz.checks.some((c) => c.id === "rel-strength"));

  const endeksli = analyze(KRIPTO, "1d", guclu, "canli", {
    benchmark: { ticker: "BTC", candles: endeks },
  });
  const goreli = endeksli.checks.find((c) => c.id === "rel-strength");
  assert.ok(goreli, "göreli güç göstergesi olmalı");
  assert.equal(goreli.verdict, "BUY", "endeksten hızlı yükselen varlık güçlü sayılmalı");
  assert.equal(goreli.noteParams?.benchmark, "BTC");
});

test("zamanı uyuşmayan kıyas endeksi kullanılmaz", () => {
  // Endeks mumları yıllar öncesine aitse hizalanamaz; bayat kıyas, kıyas değildir.
  const eski = toCandles(DALGALI.map((_, i) => 100 + i)).map((c) => ({
    ...c,
    openTime: c.openTime - 5 * 365 * 86_400_000,
  }));
  const sonuc = analyze(KRIPTO, "1d", DALGALI, "canli", { benchmark: { ticker: "BTC", candles: eski } });
  assert.ok(!sonuc.checks.some((c) => c.id === "rel-strength"));
});

test("geçmiş sınaması taban oranla birlikte raporlanır", () => {
  const sonuc = analyze(EMTIA, "1d", DALGALI, "canli");
  const sinama = sonuc.backtest;
  assert.ok(sinama, "300 mumda sınama yapılabilmeli");
  assert.equal(sinama.horizon, 10);
  assert.ok(sinama.samples >= 150);

  for (const taraf of [sinama.buy, sinama.sell]) {
    if (!taraf) continue;
    assert.ok(taraf.signals > 0);
    assert.ok(taraf.hitRate >= 0 && taraf.hitRate <= 1);
    assert.ok(taraf.baseRate >= 0 && taraf.baseRate <= 1);
    // Büzülme: bildirilen fark ham farktan büyük olamaz.
    assert.ok(Math.abs(taraf.edge) <= Math.abs(taraf.hitRate - taraf.baseRate) + 1e-9);
    assert.equal(taraf.reliable, taraf.signals >= 12);
  }
  // Alış ve satış taban oranları birlikte 1'i aşamaz (kalan: değişmeyen mumlar).
  if (sinama.buy && sinama.sell) {
    assert.ok(sinama.buy.baseRate + sinama.sell.baseRate <= 1 + 1e-9);
  }
});

test("geçmiş sınaması az veride yapılmaz, istenirse kapatılır", () => {
  assert.equal(analyze(EMTIA, "1d", DALGALI.slice(-100), "canli").backtest, null);
  assert.equal(analyze(EMTIA, "1d", DALGALI, "canli", { backtest: false }).backtest, null);
});

test("geçmiş sınaması geleceğe bakmaz", () => {
  // Son mumlar değişirse yalnızca son mumlara ait sonuçlar değişmeli: sınamanın
  // son örneği (bitiş − ufuk) ve öncesi için sinyaller aynı kalır. Bunu
  // doğrudan sınamak için seriyi kısaltıp ortak dönemin sinyal sayılarını
  // karşılaştırırız: kısa serideki her sinyal uzun seride de bulunmalı.
  const uzun = analyze(EMTIA, "1d", DALGALI, "canli").backtest;
  const kisa = analyze(EMTIA, "1d", DALGALI.slice(0, 280), "canli").backtest;
  assert.ok(uzun && kisa);
  assert.ok((uzun.buy?.signals ?? 0) >= (kisa.buy?.signals ?? 0));
  assert.ok((uzun.sell?.signals ?? 0) >= (kisa.sell?.signals ?? 0));
  assert.equal(uzun.samples - kisa.samples, 20);
});

test("sınama hükmü küçük örnekte kesin konuşmaz", () => {
  const taraf = { signals: 5, hitRate: 1, baseRate: 0.5, edge: 0.17, avgReturn: 3, reliable: false };
  assert.equal(backtestVerdictKey(taraf), "backtest.verdict.few");
  assert.equal(backtestVerdictKey({ ...taraf, signals: 40, reliable: true, edge: 0.08 }), "backtest.verdict.good");
  assert.equal(backtestVerdictKey({ ...taraf, signals: 40, reliable: true, edge: -0.08 }), "backtest.verdict.bad");
  assert.equal(backtestVerdictKey({ ...taraf, signals: 40, reliable: true, edge: 0.01 }), "backtest.verdict.flat");
});

test("yorum, sinyal BEKLE iken verilmemiş bir sinyal hakkında uyarmaz", () => {
  // Skor sıfırdan farklı ama eşiğin altında: sinyal BEKLE. Eskiden "satış
  // sinyali aşırı satımda üretildi" ve "üst periyotlar tersini söylüyor"
  // uyarıları skorun işaretine bakıp yine de yazılıyordu.
  const sonuc = analyze(HISSE, "1d", DUSEN, "canli");
  assert.equal(sonuc.signal, "WAIT", `beklenen BEKLE, gelen ${sonuc.signal} (${sonuc.score})`);
  assert.ok(sonuc.score !== 0);

  const yorum = buildCommentary(sonuc, "tr", {
    timeframes: [{ interval: "1w", signal: "BUY", score: 30 }],
  });
  const riskler = yorum.risks.join(" ");
  assert.ok(!riskler.includes("Satış sinyali aşırı satım"), riskler);
  assert.ok(!riskler.includes("ters yönde sinyal"), riskler);
});

test("yorum piyasa durumunu, okuma yöntemini ve geçmiş sınamasını anlatır", () => {
  const sonuc = analyze(HISSE, "1d", DALGALI, "canli");
  for (const dil of ["tr", "en"] as const) {
    const metin = buildCommentary(sonuc, dil).paragraphs.join("\n");
    assert.ok(metin.includes(dil === "tr" ? "Piyasa durumu" : "Market state"), `rejim yok (${dil})`);
    assert.ok(metin.includes(dil === "tr" ? "geriye dönük sınandı" : "replayed"), `sınama yok (${dil})`);
    assert.ok(!metin.includes("{"), `boş yer tutucu (${dil})`);
    assert.ok(!/(profile|regime|backtest|fund|overall)\.[a-z]/i.test(metin), `çevrilmemiş anahtar (${dil})`);
  }
});

test("değişim yüzdesi yorumda işaretiyle ve tek biçimde yazılır", () => {
  const sonuc = analyze(HISSE, "1d", DUSEN, "canli");
  const ilk = buildCommentary(sonuc, "tr").paragraphs[0];
  // Eskiden "%-0,28" yazıyordu.
  assert.ok(!ilk.includes("%-"), ilk);
  assert.match(ilk, /son mumda -\d+,\d\d% değişim/);
  // EMA 200'e uzaklık ortalamaya göre ölçülür (fiyat yarıya inmişse ~%50).
  const ema = sonuc.indicators.ema200 as number;
  const beklenen = Math.abs((sonuc.price - ema) / ema) * 100;
  assert.ok(ilk.includes(`%${beklenen.toFixed(2).replace(".", ",")} altında`), ilk);
});

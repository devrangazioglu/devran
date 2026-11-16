/**
 * Canlı doğruluk ölçümü: kapanmış mum seçimi, sonuç bulma ve istatistik.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  istatistikHesapla,
  kapanmisMumlar,
  sonuclariBul,
  TAKIP_LISTESI,
  UFUK,
  type Kayit,
} from "../lib/sinyal-gunlugu";
import type { Candle } from "../lib/markets/types";

const GUN = 86_400_000;

function mumlar(adet: number, bas: number, fiyat: (i: number) => number): Candle[] {
  return Array.from({ length: adet }, (_, i) => {
    const close = fiyat(i);
    return {
      openTime: bas + i * GUN,
      open: close,
      high: close,
      low: close,
      close,
      volume: 1,
      closeTime: bas + (i + 1) * GUN - 1,
      quoteVolume: close,
      trades: 1,
    };
  });
}

function kayit(ek: Partial<Kayit>): Kayit {
  return {
    id: "x",
    tarih: "2026-11-02",
    market: "abd",
    symbol: "AAPL",
    ticker: "AAPL",
    sinyal: "BUY",
    skor: 25,
    guven: 55,
    fiyat: 100,
    mumZamani: 0,
    kaydedildi: 0,
    sonucFiyat: null,
    sonucZamani: null,
    getiri: null,
    ...ek,
  };
}

test("takip listesi sabit ve dört piyasayı kapsar", () => {
  assert.equal(TAKIP_LISTESI.length, 24);
  for (const market of ["bist", "abd", "emtia", "kripto"]) {
    assert.ok(TAKIP_LISTESI.some((v) => v.market === market), market);
  }
  assert.equal(new Set(TAKIP_LISTESI.map((v) => `${v.market}:${v.symbol}`)).size, 24);
});

test("kriptoda oluşmakta olan günlük mum atılır", () => {
  const bugun = Date.UTC(2026, 10, 16);
  const m = mumlar(5, bugun - 4 * GUN, (i) => 100 + i);
  // Saat 22:30 UTC: bugünün mumu gece yarısına kadar oluşuyor.
  assert.equal(kapanmisMumlar("kripto", m, bugun + 22.5 * 3_600_000).length, 4);
  // Ertesi gün: bugünün mumu kapandı.
  assert.equal(kapanmisMumlar("kripto", m, bugun + GUN + 60_000).length, 5);
});

test("borsada seans bitmeden bugünün mumu kullanılmaz", () => {
  const bugun = Date.UTC(2026, 10, 16);
  const m = mumlar(5, bugun - 4 * GUN + 13.5 * 3_600_000, (i) => 100 + i);
  // 11:00 UTC: BIST açık, ABD açılmadı → bugünün mumu atılır.
  assert.equal(kapanmisMumlar("abd", m, bugun + 11 * 3_600_000).length, 4);
  assert.equal(kapanmisMumlar("bist", m, bugun + 11 * 3_600_000).length, 4);
  // 22:30 UTC: seanslar kapandı → mum tamdır.
  assert.equal(kapanmisMumlar("abd", m, bugun + 22.5 * 3_600_000).length, 5);
});

test("sonuç, sinyal mumundan tam UFUK mum sonraki kapanıştır", () => {
  const bas = Date.UTC(2026, 9, 1);
  const m = mumlar(30, bas, (i) => 100 + i);
  const k = kayit({ id: "a", mumZamani: bas + 5 * GUN, fiyat: 105 });
  const [s] = sonuclariBul([k], m);
  assert.equal(s.fiyat, 105 + UFUK);
  assert.equal(s.zaman, bas + (5 + UFUK) * GUN);
  assert.ok(Math.abs(s.getiri - (UFUK / 105) * 100) < 1e-9);
});

test("süresi dolmamış ya da mumu bulunamayan kayıt değerlendirilmez", () => {
  const bas = Date.UTC(2026, 9, 1);
  const m = mumlar(30, bas, (i) => 100 + i);
  const yeni = kayit({ id: "yeni", mumZamani: bas + 25 * GUN });
  const kayip = kayit({ id: "kayip", mumZamani: bas - 10 * GUN });
  assert.deepEqual(sonuclariBul([yeni, kayip], m), []);
});

test("mum kaynağı değişince aynı günün farklı saatli mumu eşleşir", () => {
  // Kayıt Yahoo mumuyla (seans açılışı 14:30) açıldı, sonuç TradingView
  // mumlarıyla (gece yarısı damgası) aranıyor: aynı gün, aynı mum.
  const bas = Date.UTC(2026, 9, 1);
  const m = mumlar(30, bas, (i) => 100 + i);
  const k = kayit({ id: "saat", mumZamani: bas + 5 * GUN + 14.5 * 3_600_000, fiyat: 105 });
  const [sonuc] = sonuclariBul([k], m);
  assert.equal(sonuc.id, "saat");
  assert.equal(sonuc.fiyat, 115);
});

test("istatistik: isabet taban oranla birlikte hesaplanır, BEKLE isabete girmez", () => {
  const k: Kayit[] = [
    kayit({ id: "1", sinyal: "BUY", getiri: 2 }),
    kayit({ id: "2", sinyal: "STRONG_BUY", getiri: -1 }),
    kayit({ id: "3", sinyal: "SELL", getiri: -3 }),
    kayit({ id: "4", sinyal: "WAIT", getiri: 1 }),
    kayit({ id: "5", sinyal: "WAIT", getiri: -2 }),
    kayit({ id: "6", sinyal: "BUY", getiri: null }),
  ];
  const ist = istatistikHesapla(k);
  assert.equal(ist.toplam, 6);
  assert.equal(ist.degerlendirilen, 5);
  assert.equal(ist.bekleyen, 1);
  assert.equal(ist.al.n, 2);
  assert.equal(ist.al.tutan, 1);
  assert.equal(ist.al.oran, 0.5);
  // Taban: sonucu belli 5 kaydın 2'sinde fiyat yükseldi.
  assert.equal(ist.al.taban, 2 / 5);
  assert.equal(ist.sat.n, 1);
  assert.equal(ist.sat.oran, 1);
  assert.equal(ist.sat.taban, 3 / 5);
  assert.equal(ist.bekle.n, 2);
  assert.equal(ist.ilkSonuc, null);
});

test("sonuç yokken ilk sonucun tahmini tarihi iş günüyle hesaplanır", () => {
  const ist = istatistikHesapla([kayit({ id: "1", tarih: "2026-11-13" })]);
  // 13 Kasım cuma + 11 iş günü = 30 Kasım pazartesi.
  assert.equal(ist.ilkSonuc, "2026-11-30");
  assert.equal(istatistikHesapla([]).baslangic, null);
});

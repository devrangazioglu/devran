/**
 * Yeni ücretsiz veri kaynaklarının testleri.
 *
 * Burada ölçülen şey hız değil **doğruluk**: bu kaynaklarda bir sembol
 * eşlemesi yanlışsa kullanıcı, baktığını sandığı varlığın değil başka bir
 * varlığın fiyatını görür ve ona göre işlem yapar. Sessiz kalan tek hata türü
 * bu olduğu için eşleme, borsa sabitlemesi ve kısmi hata durumları tek tek
 * sınanıyor.
 *
 * Ağa çıkılmaz: `globalThis.fetch` yerine ölçümden alınmış gerçek yanıt
 * biçimleri konur (bkz. `scripts/kaynak-tara.ts` çıktıları).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { aktariciJson } from "../lib/markets/aktarici";
import { fetchMetalQuotes, metalDestekliyor, metalSembolleri } from "../lib/markets/metals";
import { fetchTradingViewQuotes, tradingViewSembolu } from "../lib/markets/tradingview";

// Bu dosya tarayıcı ucunu sahte yanıtlarla sınıyor; anlık katman (WebSocket)
// gerçek ağa çıkıp sahte fiyatların üstüne yazmasın.
process.env.TV_MUM_KAPALI = "1";

/** Çağrıları kaydeden sahte fetch; `yanitla` adrese göre yanıt üretir. */
function fetchKur(yanitla: (url: string, govde: unknown) => unknown | null) {
  const gercek = globalThis.fetch;
  const istekler: string[] = [];

  globalThis.fetch = (async (girdi: RequestInfo | URL, ayar?: RequestInit) => {
    const url = String(girdi);
    istekler.push(url);
    const govde = ayar?.body ? JSON.parse(String(ayar.body)) : null;
    const yanit = yanitla(url, govde);
    if (yanit === null) return new Response("not found", { status: 404 });
    return new Response(JSON.stringify(yanit), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  return { istekler, geriAl: () => void (globalThis.fetch = gercek) };
}

/* ────────────────────── Aktarıcı gövdesi ────────────────────── */

test("aktarıcı gövdesindeki JSON, baştaki notlara rağmen ayrıştırılır", () => {
  // jina ham metin biçiminde bile gövdenin başına başlık satırı ekleyebiliyor;
  // gövdeyi olduğu gibi JSON.parse'a vermek bu yüzden kırılgan.
  const govde = 'Title: Yahoo\nURL Source: https://query1.finance.yahoo.com/...\n\n{"chart":{"result":[1]}}';
  assert.deepEqual(aktariciJson<{ chart: { result: number[] } }>(govde).chart.result, [1]);

  // Dizi ile başlayan gövde de geçerli.
  assert.deepEqual(aktariciJson<number[]>("önsöz\n[1,2]"), [1, 2]);

  assert.throws(() => aktariciJson("hiç JSON yok"), /JSON yok/);
});

/* ────────────────────── TradingView ────────────────────── */

test("hisse taraması BIST sembollerine .IS ekler ve önceki kapanışı türetir", async () => {
  const sahte = fetchKur((url) =>
    url.includes("/turkey/scan")
      ? {
          data: [
            // Ölçümden gelen gerçek biçim: [ad, açıklama, kapanış, değişim, …]
            { s: "BIST:THYAO", d: ["THYAO", "TÜRK HAVA YOLLARI", 320.25, 0.3918495297805642, 323.5, 315, 29_057_838, "TRY"] },
            { s: "BIST:GARAN", d: ["GARAN", "GARANTİ BANKASI", 100, -50, 120, 95, 1000, "TRY"] },
          ],
        }
      : null,
  );

  try {
    const liste = await fetchTradingViewQuotes("bist", ["THYAO.IS", "GARAN.IS"]);

    const thyao = liste.get("THYAO.IS");
    assert.ok(thyao, "sembol .IS ekiyle anahtarlanmalı");
    assert.equal(thyao.price, 320.25);
    assert.equal(thyao.high, 323.5);
    assert.equal(thyao.currency, "TRY");
    assert.equal(thyao.kind, "hisse");
    // Önceki kapanış yüzdeden geri hesaplanır: 320.25 / 1.00391… ≈ 319.0
    assert.ok(Math.abs(thyao.previousClose - 319.0) < 0.1);

    // Yarıya düşen hisse: geri hesap bölme hatası vermemeli.
    const garan = liste.get("GARAN.IS");
    assert.ok(garan);
    assert.equal(Math.round(garan.previousClose), 200);
  } finally {
    sahte.geriAl();
  }
});

test("döviz yalnızca sabitlenmiş borsadan kabul edilir", async () => {
  // Gerçek ölçümde aynı parite 219 satırda, her broker için ayrı fiyatla
  // geliyordu. Borsa sabitlenmezse fiyat her tazelemede oynar.
  const sahte = fetchKur((url) =>
    url.includes("/forex/scan")
      ? {
          data: [
            { s: "FUSIONMARKETS:USDTRY", d: ["USDTRY", "", 50.9, 0.1, 51, 50.8, 11_693, "TRY"] },
            { s: "THINKMARKETS:USDTRY", d: ["USDTRY", "", 50.7, 0.1, 51, 50.6, 694_800_000, "TRY"] },
            { s: "FX:USDTRY", d: ["USDTRY", "", 50.3774, 0.05, 50.41, 50.36, 13_462, "TRY"] },
          ],
        }
      : null,
  );

  try {
    const liste = await fetchTradingViewQuotes("emtia", ["USDTRY=X"]);
    assert.equal(liste.size, 1, "tek satır kalmalı");

    const usd = liste.get("USDTRY=X");
    assert.ok(usd, "sembol Yahoo biçiminde anahtarlanmalı");
    assert.equal(usd.price, 50.3774, "broker fiyatı değil birleşik besleme alınmalı");
    assert.equal(usd.kind, "doviz");
  } finally {
    sahte.geriAl();
  }
});

test("vadeli emtia sembolleri uygulama biçimine çevrilir", async () => {
  const sahte = fetchKur((url) =>
    url.includes("/futures/scan")
      ? {
          data: [
            // Başka borsadaki aynı adlı kontrat: sabitleme onu atmalı.
            { s: "ICEEUR:GC1!", d: ["GC1!", "", 9999, 0, 9999, 9999, 1, "USD"] },
            { s: "COMEX:GC1!", d: ["GC1!", "Altın", 3871.9, -0.37, 3904.3, 3862.5, 12_674, "USD"] },
            { s: "NYMEX:CL1!", d: ["CL1!", "Petrol", 88.35, -0.237, 88.83, 88.15, 5846, "USD"] },
          ],
        }
      : null,
  );

  try {
    const liste = await fetchTradingViewQuotes("emtia", ["GC=F", "CL=F"]);

    assert.equal(liste.get("GC=F")?.price, 3871.9, "COMEX kontratı alınmalı");
    assert.equal(liste.get("CL=F")?.price, 88.35);
    assert.equal(liste.get("GC=F")?.kind, "emtia");
    assert.equal(liste.has("GC1!"), false, "tarayıcı adı anahtar olmamalı");
  } finally {
    sahte.geriAl();
  }
});

test("endeksler tek sembol uç noktasından gelir, boş alanlar varsayılana düşer", async () => {
  const sahte = fetchKur((url) => {
    if (!url.includes("/symbol?")) return null;
    // Ölçümde endekslerde para birimi ve kimi zaman hacim null geliyor.
    if (url.includes("SPX")) {
      return { close: 7561.67, change: -0.4047, high: 7621.78, low: 7499.4, volume: 2_727_332_784, currency: null };
    }
    if (url.includes("DXY")) {
      return { close: 103.438, change: 0.027, high: 103.441, low: 103.368, volume: null, currency: "USD" };
    }
    return null;
  });

  try {
    const liste = await fetchTradingViewQuotes("abd", ["^GSPC"]);
    const spx = liste.get("^GSPC");
    assert.ok(spx);
    assert.equal(spx.price, 7561.67);
    assert.equal(spx.kind, "endeks");
    assert.equal(spx.currency, "USD", "para birimi null gelince piyasanın varsayılanı");

    const dxyListesi = await fetchTradingViewQuotes("emtia", ["DX-Y.NYB"]);
    assert.equal(dxyListesi.get("DX-Y.NYB")?.volume, 0, "hacim null ise sıfır");
  } finally {
    sahte.geriAl();
  }
});

test("bir bölge düşse bile diğerinden gelen fiyatlar kaybolmaz", async () => {
  // Emtia piyasası iki bölgeden besleniyor; vadeli tarafı hata verse kurlar
  // yine gelmeli, yoksa yarısı çalışan bir liste tümden boşalır.
  const sahte = fetchKur((url) =>
    url.includes("/forex/scan")
      ? { data: [{ s: "FX:EURUSD", d: ["EURUSD", "", 1.1, 0.2, 1.11, 1.09, 100, "USD"] }] }
      : null,
  );

  try {
    const liste = await fetchTradingViewQuotes("emtia", ["GC=F", "EURUSD=X"]);
    assert.equal(liste.size, 1);
    assert.ok(liste.has("EURUSD=X"));
  } finally {
    sahte.geriAl();
  }
});

test("hiçbir bölge yanıt vermezse hata atılır", async () => {
  const sahte = fetchKur(() => null);
  try {
    await assert.rejects(() => fetchTradingViewQuotes("emtia", ["GC=F"]));
  } finally {
    sahte.geriAl();
  }
});

test("eşlemede olmayan sembol tarayıcıdan istenmez", () => {
  // Hisse piyasasında bütün borsa tek istekte geldiği için ad eşlemesi gerekmez.
  assert.equal(tradingViewSembolu("bist", "THYAO.IS"), true);
  assert.equal(tradingViewSembolu("abd", "AAPL"), true);
  // Emtia/döviz tarafında yalnızca elle eşlenmiş semboller geçer.
  assert.equal(tradingViewSembolu("emtia", "GC=F"), true);
  assert.equal(tradingViewSembolu("emtia", "USDTRY=X"), true);
  assert.equal(tradingViewSembolu("emtia", "ZZ=F"), false, "bilinmeyen sembol uydurulmamalı");
  assert.equal(tradingViewSembolu("kripto", "BTCUSDT"), false);
});

/* ────────────────────── Metal (spot) ────────────────────── */

test("metal kaynağı yalnızca değerli metalleri karşılar", () => {
  assert.deepEqual(metalSembolleri().sort(), ["GC=F", "PA=F", "PL=F", "SI=F"]);
  assert.equal(metalDestekliyor("GC=F"), true);
  assert.equal(metalDestekliyor("CL=F"), false, "petrol spot kaynakta yok");
});

test("metal fiyatları ayrıştırılır, bir metal düşse diğerleri gelir", async () => {
  const sahte = fetchKur((url) => {
    if (url.endsWith("/price/XAU")) {
      return { name: "Gold", price: 3876.199951, symbol: "XAU", updatedAt: "2026-11-16T01:16:57Z" };
    }
    // Gümüş düşsün: kalanı almaya devam etmeli.
    return null;
  });

  try {
    const satirlar = await fetchMetalQuotes(["GC=F", "SI=F", "CL=F"]);
    assert.equal(satirlar.length, 1);
    assert.equal(satirlar[0].symbol, "GC=F");
    assert.equal(satirlar[0].price, 3876.199951);
    assert.equal(satirlar[0].updatedAt, Date.parse("2026-11-16T01:16:57Z"));
  } finally {
    sahte.geriAl();
  }
});

test("metal kaynağında fiyat sayı değilse satır atılır", async () => {
  const sahte = fetchKur(() => ({ name: "Gold", price: "3876", updatedAt: "2026-11-16T01:16:57Z" }));
  try {
    await assert.rejects(() => fetchMetalQuotes(["GC=F"]), /alınamadı/);
  } finally {
    sahte.geriAl();
  }
});

test("desteklenmeyen sembol istenirse ağa çıkılmaz", async () => {
  const sahte = fetchKur(() => ({ price: 1 }));
  try {
    assert.deepEqual(await fetchMetalQuotes(["CL=F", "NG=F"]), []);
    assert.equal(sahte.istekler.length, 0, "boşa istek atılmamalı");
  } finally {
    sahte.geriAl();
  }
});

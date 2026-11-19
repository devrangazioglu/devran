/**
 * Temel analiz: puanlama (saf fonksiyonlar) ve veri katmanı (sahte ağ ile).
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { analyze } from "../lib/analysis";
import { buildCommentary } from "../lib/commentary";
import { bilesikGorunum, temelPuanla, type TemelSatir } from "../lib/fundamentals";
import { analystLabel, metricDisplay, metricValue, sectorName } from "../lib/fundamentals-text";
import { makeT } from "../lib/i18n";
import { getFundamentals, temelBellegiTemizle } from "../lib/markets/temel";
import type { Candle } from "../lib/markets/types";

function sirket(code: string, ek: Partial<TemelSatir> = {}): TemelSatir {
  return {
    code,
    sector: "Technology Services",
    marketCap: 1e9,
    eps: 2,
    pe: 20,
    pb: 3,
    ps: 4,
    evEbitda: 12,
    roe: 15,
    netMargin: 10,
    operatingMargin: 14,
    revenueGrowth: 10,
    epsGrowth: 10,
    debtToEquity: 0.8,
    currentRatio: 1.5,
    dividendYield: 1,
    analystRating: 2,
    ...ek,
  };
}

/** Oranları sırayla kötüleşen 20 emsal: 0 en iyi, 19 en kötü. */
const EMSALLER: TemelSatir[] = Array.from({ length: 20 }, (_, i) =>
  sirket(`E${i}`, {
    pe: 8 + i * 2,
    pb: 1 + i * 0.3,
    ps: 1 + i * 0.4,
    evEbitda: 5 + i,
    roe: 30 - i,
    netMargin: 25 - i,
    operatingMargin: 30 - i,
    revenueGrowth: 40 - i * 2,
    epsGrowth: 50 - i * 3,
    debtToEquity: 0.1 + i * 0.15,
    currentRatio: 3 - i * 0.1,
  }),
);

test("emsallerinden ucuz, kârlı ve az borçlu şirket yüksek puan alır", () => {
  const iyi = sirket("IYI", {
    pe: 6, pb: 0.8, ps: 0.8, evEbitda: 4, roe: 35, netMargin: 28, operatingMargin: 33,
    revenueGrowth: 45, epsGrowth: 55, debtToEquity: 0.05, currentRatio: 3.2,
  });
  const kotu = sirket("KOTU", {
    pe: 60, pb: 9, ps: 12, evEbitda: 40, roe: 2, netMargin: 1, operatingMargin: 2,
    revenueGrowth: -10, epsGrowth: -30, debtToEquity: 4, currentRatio: 0.6,
  });

  const iyiPuan = temelPuanla(iyi, EMSALLER);
  const kotuPuan = temelPuanla(kotu, EMSALLER);
  assert.ok(iyiPuan && kotuPuan);
  assert.ok(iyiPuan.score >= 90, `iyi şirket: ${iyiPuan.score}`);
  assert.ok(kotuPuan.score <= 10, `kötü şirket: ${kotuPuan.score}`);
  assert.equal(iyiPuan.gradeKey, "fund.grade.strong");
  assert.equal(kotuPuan.gradeKey, "fund.grade.poor");
  assert.equal(iyiPuan.scope, "sector");
  assert.equal(iyiPuan.peers, 20);
  assert.ok(kotuPuan.flags.includes("fund.flag.highDebt"));
});

test("ortadaki şirket ortalama puan alır ve dört sütun da dolar", () => {
  const sonuc = temelPuanla(EMSALLER[10], EMSALLER);
  assert.ok(sonuc);
  assert.ok(sonuc.score >= 40 && sonuc.score <= 60, `puan: ${sonuc.score}`);
  assert.deepEqual(
    sonuc.pillars.map((p) => p.id),
    ["valuation", "profitability", "growth", "health"],
  );
  for (const sutun of sonuc.pillars) assert.ok(sutun.score !== null);
  // Şirketin kendisi emsal sayılmaz.
  assert.equal(sonuc.peers, 19);
});

test("zarardaki şirketin F/K'sı cezasız kalmaz", () => {
  // Kaynak zarardaki şirket için F/K'yı boş verir. "Veri yok" diye atlamak,
  // zarar eden şirketi değerleme sütununda ucuz göstermek demekti.
  const zarar = sirket("ZARAR", { eps: -1, pe: null, pb: 0.5, ps: 0.5, evEbitda: 3 });
  const sonuc = temelPuanla(zarar, EMSALLER);
  assert.ok(sonuc);
  assert.ok(sonuc.flags.includes("fund.flag.loss"));
  const fk = sonuc.pillars[0].metrics.find((m) => m.id === "pe");
  assert.ok(fk, "F/K ölçütü listede olmalı");
  assert.equal(fk.percentile, 0);
  assert.equal(metricDisplay(makeT("tr"), fk, "tr-TR"), "zarar");
});

test("negatif özsermaye ayrıca işaretlenir ve PD/DD en kötü sıraya yazılır", () => {
  const sonuc = temelPuanla(sirket("NEG", { pb: -2 }), EMSALLER);
  assert.ok(sonuc);
  assert.ok(sonuc.flags.includes("fund.flag.negativeEquity"));
  assert.equal(sonuc.pillars[0].metrics.find((m) => m.id === "pb")?.percentile, 0);
});

test("finans şirketlerinde borç oranı ve cari oran kullanılmaz", () => {
  const bankalar = EMSALLER.map((s) => ({ ...s, sector: "Finance" }));
  const sonuc = temelPuanla({ ...bankalar[3], code: "BANKA", debtToEquity: 9 }, bankalar);
  assert.ok(sonuc);
  const olcutler = sonuc.pillars.flatMap((p) => p.metrics.map((m) => m.id));
  for (const id of ["debtToEquity", "currentRatio", "ps", "evEbitda", "operatingMargin"]) {
    assert.ok(!olcutler.includes(id as never), `${id} finans şirketinde kullanılmamalı`);
  }
  // Bankanın "borcu" mevduattır; yüksek diye uyarı verilmez.
  assert.ok(!sonuc.flags.includes("fund.flag.highDebt"));
  assert.equal(sonuc.pillars.find((p) => p.id === "health")?.score, null);
});

test("sektörde yeterli emsal yoksa bütün borsayla kıyaslanır", () => {
  const yalniz = sirket("YALNIZ", { sector: "Utilities" });
  const sonuc = temelPuanla(yalniz, [...EMSALLER, sirket("U1", { sector: "Utilities" })]);
  assert.ok(sonuc);
  assert.equal(sonuc.scope, "market");
  assert.equal(sonuc.peers, 21);
});

test("tek sütunluk veriden temel analiz üretilmez", () => {
  const eksik = sirket("EKSIK", {
    pe: null, pb: null, ps: null, evEbitda: null, revenueGrowth: null, epsGrowth: null,
    debtToEquity: null, currentRatio: null,
  });
  assert.equal(temelPuanla(eksik, EMSALLER), null);
});

test("teknik ve temel birlikte okunur, tek sayıya karıştırılmaz", () => {
  assert.equal(bilesikGorunum("buy", 80), "overall.buyStrong");
  assert.equal(bilesikGorunum("buy", 30), "overall.buyWeak");
  assert.equal(bilesikGorunum("sell", 80), "overall.sellStrong");
  assert.equal(bilesikGorunum("wait", 50), "overall.waitMid");

  // Dokuz birleşimin hepsinin Türkçe ve İngilizce metni olmalı.
  for (const dil of ["tr", "en"] as const) {
    const t = makeT(dil);
    for (const teknik of ["buy", "sell", "wait"] as const) {
      for (const puan of [80, 50, 20]) {
        const anahtar = bilesikGorunum(teknik, puan);
        assert.notEqual(t(anahtar as "overall.waitMid"), anahtar, `çeviri eksik: ${anahtar} (${dil})`);
      }
    }
  }
});

test("temel analiz metinleri: sektör adı, birim ve analist etiketi", () => {
  const tr = makeT("tr");
  assert.equal(sectorName(tr, "Finance"), "Finans");
  assert.equal(sectorName(tr, "Non-Energy Minerals"), "Madencilik ve Metal");
  // Bilinmeyen sektör olduğu gibi gösterilir, anahtar sızmaz.
  assert.equal(sectorName(tr, "Space Mining"), "Space Mining");
  assert.equal(sectorName(tr, null), "—");

  assert.equal(metricValue("pe", 12.4, "tr-TR"), "12,40");
  assert.equal(metricValue("roe", 18.26, "tr-TR"), "%18,3");
  assert.equal(metricValue("roe", null, "tr-TR"), "—");

  assert.equal(analystLabel(tr, 1.2), "Çok olumlu");
  assert.equal(analystLabel(tr, 3), "Nötr");
  assert.equal(analystLabel(tr, 4.8), "Çok olumsuz");
  assert.equal(analystLabel(tr, null), null);
});

test("bütün ölçüt, sütun ve bayrak anahtarlarının sekiz dilde karşılığı var", () => {
  const sonuc = temelPuanla(sirket("X", { eps: -1, pe: null, pb: -1, debtToEquity: 9 }), EMSALLER);
  assert.ok(sonuc);
  for (const dil of ["tr", "en", "de", "es", "fr", "ru", "ar", "zh"] as const) {
    const t = makeT(dil);
    const anahtarlar = [
      sonuc.gradeKey,
      ...sonuc.pillars.map((p) => `fund.pillar.${p.id}`),
      ...sonuc.pillars.flatMap((p) => p.metrics.map((m) => `fund.metric.${m.id}`)),
      ...sonuc.flags,
    ];
    for (const anahtar of anahtarlar) {
      assert.notEqual(t(anahtar as "fund.title"), anahtar, `çeviri eksik: ${anahtar} (${dil})`);
    }
  }
});

test("yorum temel analizi ve birleşik görünümü anlatır", () => {
  const mumlar: Candle[] = Array.from({ length: 260 }, (_, i) => {
    const close = 100 + Math.sin(i / 9) * 6 + i * 0.05;
    return {
      openTime: Date.UTC(2025, 0, 1) + i * 86_400_000,
      open: close - 0.3, high: close + 1, low: close - 1, close,
      volume: 1000, closeTime: Date.UTC(2025, 0, 1) + (i + 1) * 86_400_000 - 1,
      quoteVolume: 1000 * close, trades: 10,
    };
  });
  const analiz = analyze(
    { id: "bist:THYAO.IS", market: "bist", symbol: "THYAO.IS", name: "THY", ticker: "THYAO", currency: "TRY", kind: "hisse" },
    "1d", mumlar, "canli",
  );
  const temel = temelPuanla(sirket("THYAO", { eps: -1, pe: null }), EMSALLER);
  assert.ok(temel);

  const yorum = buildCommentary(analiz, "tr", { fundamentals: temel, overallKey: bilesikGorunum("wait", temel.score) });
  const metin = yorum.paragraphs.join("\n");
  assert.ok(metin.includes("Temel analiz: THYAO"), "temel analiz paragrafı yok");
  assert.ok(metin.includes("Yazılım ve Teknoloji Hizmetleri"), "sektör adı çevrilmemiş");
  assert.ok(metin.includes("zarar etti"), "zarar bayrağı yoruma girmemiş");
  assert.ok(yorum.risks.some((r) => r.includes("zarar etti")), "zarar bayrağı risklere girmemiş");
  assert.ok(!metin.includes("{"));

  // Temel veri yoksa paragraf da yok.
  const temelsiz = buildCommentary(analiz, "tr").paragraphs.join("\n");
  assert.ok(!temelsiz.includes("Temel analiz:"));
});

/* ────────────────────────── Veri katmanı ────────────────────────── */

const gercekFetch = globalThis.fetch;
let istekler: { url: string; govde: { range: number[]; columns: string[]; filter: unknown[] } }[] = [];

/** Tarayıcının yanıt biçimi: her satır `d` dizisi, sütun sırası istekle aynı. */
function sahteTarayici(satirlar: TemelSatir[], durum = 200): void {
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const govde = JSON.parse(String(init?.body ?? "{}"));
    istekler.push({ url: String(url), govde });
    const alan: Record<string, keyof TemelSatir> = {
      name: "code", sector: "sector", market_cap_basic: "marketCap",
      earnings_per_share_diluted_ttm: "eps", price_earnings_ttm: "pe", price_book_fq: "pb",
      price_sales_current: "ps", enterprise_value_ebitda_ttm: "evEbitda", return_on_equity: "roe",
      net_margin: "netMargin", operating_margin: "operatingMargin",
      total_revenue_yoy_growth_ttm: "revenueGrowth",
      earnings_per_share_diluted_yoy_growth_ttm: "epsGrowth", debt_to_equity: "debtToEquity",
      current_ratio: "currentRatio", dividends_yield_current: "dividendYield",
      recommendation_mark: "analystRating",
    };
    const data = satirlar.map((s) => ({
      s: `BIST:${s.code}`,
      d: (govde.columns as string[]).map((sutun) => s[alan[sutun]] ?? null),
    }));
    return new Response(JSON.stringify({ totalCount: data.length, data }), { status: durum });
  }) as typeof fetch;
}

beforeEach(() => {
  istekler = [];
  temelBellegiTemizle();
  delete process.env.TRADINGVIEW_KAPALI;
});

afterEach(() => {
  globalThis.fetch = gercekFetch;
  temelBellegiTemizle();
});

test("temel veri borsanın tamamı için tek istekle alınır ve bellekte tutulur", async () => {
  sahteTarayici([...EMSALLER, sirket("THYAO", { sector: "Transportation" })]);

  const ilk = await getFundamentals("bist", "THYAO.IS");
  assert.ok(ilk, "THYAO.IS → THYAO eşlemesi çalışmalı");
  assert.equal(ilk.sector, "Transportation");
  assert.equal(ilk.scope, "market", "tek ulaştırma şirketi borsayla kıyaslanmalı");

  // Aynı borsadan ikinci hisse yeni istek atmaz.
  assert.ok(await getFundamentals("bist", "E3.IS"));
  assert.equal(istekler.length, 1);
  assert.match(istekler[0].url, /\/turkey\/scan$/);
  assert.ok(istekler[0].govde.columns.includes("price_earnings_ttm"));
});

test("eşzamanlı istekler tek çağrıyı paylaşır", async () => {
  sahteTarayici(EMSALLER);
  const sonuclar = await Promise.all(
    ["E1.IS", "E2.IS", "E3.IS", "E4.IS"].map((s) => getFundamentals("bist", s)),
  );
  assert.ok(sonuclar.every((s) => s !== null));
  assert.equal(istekler.length, 1, "tarama bir kez yapılmalı");
});

test("temel veri hisse dışı piyasalar için istenmez", async () => {
  sahteTarayici(EMSALLER);
  assert.equal(await getFundamentals("kripto", "BTCUSDT"), null);
  assert.equal(await getFundamentals("emtia", "GC=F"), null);
  assert.equal(istekler.length, 0);
});

test("kaynak düşerse temel analiz sessizce boş döner", async () => {
  // Temel analiz ek bilgidir; eksikliği teknik analizi düşürmemeli.
  sahteTarayici([], 500);
  assert.equal(await getFundamentals("bist", "THYAO.IS"), null);

  globalThis.fetch = (async () => {
    throw new Error("ağ yok");
  }) as typeof fetch;
  assert.equal(await getFundamentals("abd", "AAPL"), null);
});

test("listede olmayan hisse için boş döner", async () => {
  sahteTarayici(EMSALLER);
  assert.equal(await getFundamentals("bist", "YOKBOYLE.IS"), null);
});

test("kaynak kapatıldıysa hiç istek atılmaz", async () => {
  sahteTarayici(EMSALLER);
  process.env.TRADINGVIEW_KAPALI = "1";
  assert.equal(await getFundamentals("bist", "E1.IS"), null);
  assert.equal(istekler.length, 0);
  delete process.env.TRADINGVIEW_KAPALI;
});

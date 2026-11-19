/**
 * Hisseler için temel analiz verisi (bilanço oranları).
 *
 * Kaynak, fiyat listesiyle aynı tarayıcı (bkz. `tradingview.ts`). Ölçüldü
 * (2026-11-16, `scripts/kaynak-tara.ts` yedinci tur): F/K, PD/DD, özsermaye
 * kârlılığı, marjlar, büyüme, borçluluk ve sektör alanlarının tamamı hem BIST
 * hem ABD hisseleri için geliyor; 625 BIST hissesi tek istekte, 96 ms.
 *
 * Borsanın tamamı tek seferde alınır, çünkü puanlama emsallerle kıyaslayarak
 * yapılıyor (bkz. `lib/fundamentals.ts`): tek bir şirketin oranı, sektörünün
 * dağılımı bilinmeden yorumlanamaz. Bilançolar üç ayda bir değiştiği için
 * sonuç uzun süre bellekte tutulur.
 *
 * Yalnızca oranlar ve yüzdeler kullanılır. Kaynak mutlak tutarları (piyasa
 * değeri, hasılat) dolar cinsinden veriyor; TL fiyatla yan yana konduğunda
 * yanıltıcı olur (analist hedef fiyatı da aynı nedenle alınmıyor).
 *
 * Endeks, emtia, döviz ve kriptonun bilançosu yoktur; bu modül onlar için
 * veri döndürmez.
 */

import { temelPuanla, type Fundamentals, type TemelSatir } from "../fundamentals";
import { borsa } from "./borsalar";
import { tradingViewAcik } from "./tradingview";
import type { MarketId } from "./types";

const BASE = process.env.TRADINGVIEW_API_BASE ?? "https://scanner.tradingview.com";

const BASLIK = {
  "content-type": "application/json",
  accept: "application/json",
  origin: "https://www.tradingview.com",
  referer: "https://www.tradingview.com/",
  "user-agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

/** Tarayıcı sütunu → satır alanı. Sıra önemli: yanıt dizi olarak geliyor. */
const SUTUNLAR: [string, keyof TemelSatir][] = [
  ["name", "code"],
  ["sector", "sector"],
  ["market_cap_basic", "marketCap"],
  ["earnings_per_share_diluted_ttm", "eps"],
  ["price_earnings_ttm", "pe"],
  ["price_book_fq", "pb"],
  ["price_sales_current", "ps"],
  ["enterprise_value_ebitda_ttm", "evEbitda"],
  ["return_on_equity", "roe"],
  ["net_margin", "netMargin"],
  ["operating_margin", "operatingMargin"],
  ["total_revenue_yoy_growth_ttm", "revenueGrowth"],
  ["earnings_per_share_diluted_yoy_growth_ttm", "epsGrowth"],
  ["debt_to_equity", "debtToEquity"],
  ["current_ratio", "currentRatio"],
  ["dividends_yield_current", "dividendYield"],
  ["recommendation_mark", "analystRating"],
];

/**
 * Kıyas evreni: borsa tanımından (`borsalar.ts`). ABD'de 5000'i aşkın hisse
 * var; emsal dağılımı için piyasa değerine göre ilk birkaç bin fazlasıyla
 * yeter ve yanıtı küçük tutar.
 */
function evrenTanimi(market: MarketId): { yol: string; borsalar: string[]; adet: number } | null {
  const tanim = borsa(market);
  return tanim ? { yol: tanim.tvYol, borsalar: tanim.tvBorsalar, adet: tanim.temelAdet } : null;
}

/** Bilançolar üç ayda bir değişir; yarım gün fazlasıyla taze. */
const TTL_MS = 12 * 60 * 60_000;

type Kayit = { expires: number; satirlar: Map<string, TemelSatir> };
const bellek = new Map<MarketId, Kayit>();
/** Aynı anda gelen istekler tek bir çağrıyı paylaşsın. */
const bekleyen = new Map<MarketId, Promise<Map<string, TemelSatir>>>();

export function temelDestekliyor(market: MarketId): boolean {
  return tradingViewAcik() && evrenTanimi(market) !== null;
}

/** Testler için. */
export function temelBellegiTemizle(): void {
  bellek.clear();
  bekleyen.clear();
}

function satirYap(degerler: unknown[]): TemelSatir | null {
  const satir: Record<string, string | number | null> = {};
  SUTUNLAR.forEach(([, alan], index) => {
    const deger = degerler[index];
    if (alan === "code" || alan === "sector") {
      satir[alan] = typeof deger === "string" && deger ? deger : null;
    } else {
      satir[alan] = typeof deger === "number" && Number.isFinite(deger) ? deger : null;
    }
  });
  if (typeof satir.code !== "string") return null;
  return satir as unknown as TemelSatir;
}

async function evreniCek(market: MarketId): Promise<Map<string, TemelSatir>> {
  const evren = evrenTanimi(market);
  if (!evren) return new Map();

  const yanit = await fetch(`${BASE}/${evren.yol}/scan`, {
    method: "POST",
    headers: BASLIK,
    body: JSON.stringify({
      filter: [
        { left: "exchange", operation: "in_range", right: evren.borsalar },
        // Yalnızca hisseler: fon ve varantların bilanço oranı yoktur ve
        // sektör dağılımını bozarlar.
        { left: "type", operation: "equal", right: "stock" },
      ],
      options: { lang: "en" },
      columns: SUTUNLAR.map(([sutun]) => sutun),
      sort: { sortBy: "market_cap_basic", sortOrder: "desc" },
      range: [0, evren.adet],
    }),
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!yanit.ok) throw new Error(`temel veri alınamadı (${yanit.status})`);

  const govde = (await yanit.json()) as { data?: { s: string; d: unknown[] }[] };
  const satirlar = new Map<string, TemelSatir>();
  for (const kayit of govde.data ?? []) {
    const satir = satirYap(kayit.d);
    // Aynı kod iki borsada varsa ilki (piyasa değeri büyük olan) kalır.
    if (satir && !satirlar.has(satir.code)) satirlar.set(satir.code, satir);
  }
  if (satirlar.size === 0) throw new Error("temel veri boş döndü");
  return satirlar;
}

async function evren(market: MarketId): Promise<Map<string, TemelSatir>> {
  const kayit = bellek.get(market);
  if (kayit && kayit.expires > Date.now()) return kayit.satirlar;

  let istek = bekleyen.get(market);
  if (!istek) {
    istek = evreniCek(market)
      .then((satirlar) => {
        bellek.set(market, { expires: Date.now() + TTL_MS, satirlar });
        return satirlar;
      })
      .finally(() => bekleyen.delete(market));
    bekleyen.set(market, istek);
  }
  return istek;
}

/** Uygulama sembolünden borsadaki kısa kodu çıkarır ("THYAO.IS" → "THYAO"). */
function kod(market: MarketId, symbol: string): string {
  return borsa(market)?.tvAdi(symbol) ?? symbol;
}

/**
 * Bir hissenin temel analizini döndürür.
 *
 * Veri yoksa ya da kaynak düşerse null: temel analiz bir ek bilgidir, eksik
 * olması teknik analizi engellememeli. Çağıran hata yakalamak zorunda kalmaz.
 */
export async function getFundamentals(
  market: MarketId,
  symbol: string,
): Promise<Fundamentals | null> {
  if (!temelDestekliyor(market)) return null;
  try {
    const satirlar = await evren(market);
    const sirket = satirlar.get(kod(market, symbol));
    if (!sirket) return null;
    return temelPuanla(sirket, [...satirlar.values()]);
  } catch {
    return null;
  }
}

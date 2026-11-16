/**
 * Borsa İstanbul ve ABD borsası için anlık fiyat listesi.
 *
 * Neden bu kaynak: ölçüldü (2026-11-16, `scripts/kaynak-tara.ts`), tek bir
 * istekte **649 BIST**, **5012 NASDAQ** ve **2716 NYSE** sembolü 70–140 ms'de
 * geliyor; anahtar istemiyor ve bizim IP aralığımızı engellemiyor. Sembol
 * başına istek atan kaynaklarda 46 sembollük bir liste bile ücretsiz kotayı
 * bitiriyordu; burada liste tek istek.
 *
 * Ne verir, ne vermez:
 *   • verir  → son fiyat, günlük değişim, gün içi en yüksek/düşük, hacim
 *   • vermez → mum geçmişi. Teknik analiz 300 mum istiyor; o yüzden geçmiş
 *     `yahoo.ts` (aktarıcı üzerinden) ve paylaşımlı önbellekten gelir.
 *
 * Dikkat: bu uç nokta TradingView'ın kendi arayüzünün kullandığı, resmî
 * olarak dokümante edilmemiş bir adrestir. Sözleşme değişirse yalnızca bu
 * dosya güncellenir; `TRADINGVIEW_KAPALI=1` ile tümüyle devre dışı kalır ve
 * uygulama eski kaynaklara düşer.
 */

import { instrumentId, MarketDataError, type MarketId, type Quote } from "./types";

const BASE = process.env.TRADINGVIEW_API_BASE ?? "https://scanner.tradingview.com";

/** Hangi piyasa hangi tarayıcı bölgesinde ve hangi borsalarda. */
const BOLGE: Partial<Record<MarketId, { yol: string; borsalar: string[]; paraBirimi: string }>> = {
  bist: { yol: "turkey", borsalar: ["BIST"], paraBirimi: "TRY" },
  abd: { yol: "america", borsalar: ["NASDAQ", "NYSE", "AMEX"], paraBirimi: "USD" },
};

/** İstenen sütunlar; sıra önemli, yanıt dizi olarak geliyor. */
const SUTUNLAR = ["name", "description", "close", "change", "high", "low", "volume", "currency"] as const;

type TarayiciYanit = {
  totalCount?: number;
  data?: { s: string; d: (string | number | null)[] }[];
};

export function tradingViewAcik(): boolean {
  return process.env.TRADINGVIEW_KAPALI !== "1";
}

export function tradingViewDestekliyor(market: MarketId): boolean {
  return tradingViewAcik() && BOLGE[market] !== undefined;
}

/**
 * Bir piyasanın tamamını tek istekte çeker.
 *
 * `enFazla` yalnızca yanıtı küçültmek için: hacme göre sıralandığı için ilk N
 * zaten piyasanın işlem gören kısmı. Çağıran kendi kataloğuyla eşleştirir.
 */
export async function fetchTradingViewQuotes(
  market: MarketId,
  enFazla = 2000,
): Promise<Map<string, Quote>> {
  const bolge = BOLGE[market];
  if (!bolge) throw new MarketDataError("Bu piyasa için tarayıcı tanımlı değil.", 400);

  const yanit = await fetch(`${BASE}/${bolge.yol}/scan`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      origin: "https://www.tradingview.com",
      referer: "https://www.tradingview.com/",
      "user-agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
    body: JSON.stringify({
      filter: [{ left: "exchange", operation: "in_range", right: bolge.borsalar }],
      options: { lang: "tr" },
      columns: SUTUNLAR,
      sort: { sortBy: "volume", sortOrder: "desc" },
      range: [0, enFazla],
    }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });

  if (!yanit.ok) {
    throw new MarketDataError(`Fiyat listesi alınamadı (${yanit.status}).`, 502);
  }

  const govde = (await yanit.json()) as TarayiciYanit;
  const satirlar = govde.data ?? [];
  if (satirlar.length === 0) {
    throw new MarketDataError("Fiyat listesi boş döndü.", 502);
  }

  const simdi = Date.now();
  const sonuc = new Map<string, Quote>();

  for (const satir of satirlar) {
    const [ad, aciklama, kapanis, degisim, yuksek, dusuk, hacim, paraBirimi] = satir.d;
    if (typeof ad !== "string" || typeof kapanis !== "number") continue;

    const sembol = uygulamaSembolu(market, ad);
    const yuzde = typeof degisim === "number" ? degisim : 0;

    sonuc.set(sembol, {
      id: instrumentId(market, sembol),
      market,
      symbol: sembol,
      name: typeof aciklama === "string" && aciklama ? aciklama : ad,
      ticker: ad,
      currency: typeof paraBirimi === "string" && paraBirimi ? paraBirimi : bolge.paraBirimi,
      kind: "hisse",
      price: kapanis,
      // Önceki kapanış doğrudan gelmiyor; yüzde değişimden geri hesaplanır.
      previousClose: yuzde === -100 ? kapanis : kapanis / (1 + yuzde / 100),
      changePercent: yuzde,
      high: typeof yuksek === "number" ? yuksek : kapanis,
      low: typeof dusuk === "number" ? dusuk : kapanis,
      volume: typeof hacim === "number" ? hacim : 0,
      updatedAt: simdi,
    });
  }

  return sonuc;
}

/**
 * Tarayıcı sembolünü uygulamanınkine çevirir.
 *
 * BIST sembolleri uygulamada Yahoo biçiminde (".IS" ekli) tutuluyor; iki
 * kaynağın aynı varlığı aynı kimlikle göstermesi şart, yoksa önbellek ve
 * takip listesi ikiye bölünür.
 */
function uygulamaSembolu(market: MarketId, tarayiciSembolu: string): string {
  if (market === "bist") return `${tarayiciSembolu}.IS`;
  return tarayiciSembolu;
}

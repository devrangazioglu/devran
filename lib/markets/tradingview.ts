/**
 * Hisse, endeks, emtia ve döviz için anlık fiyat (TradingView tarayıcısı).
 *
 * Neden bu kaynak: ölçüldü (2026-11-16, `scripts/kaynak-tara.ts`), tek bir
 * istekte **649 BIST**, **5012 NASDAQ** ve **2716 NYSE** sembolü 20–140 ms'de
 * geliyor; anahtar istemiyor ve bizim IP aralığımızı engellemiyor. Sembol
 * başına istek atan kaynaklarda 46 sembollük bir liste bile ücretsiz kotayı
 * bitiriyordu; burada bütün borsa tek istek.
 *
 * Gecikme — kaynağın kendi bildirdiği `update_mode` alanından, ölçümle:
 *   • hisse (BIST, NASDAQ, NYSE) → 15 dakika (`delayed_streaming_900`)
 *   • vadeli emtia               → 10 dakika (`delayed_streaming_600`)
 *   • döviz ve dolar endeksi     → **gerçek zamanlı** (`streaming`)
 * Hisse tarafında bu gizlenmeyecek bir sınır: ücretsiz ve gerçek zamanlı
 * borsa verisi yok. Gecikme arayüzde yazılır (bkz. `MARKETS[...].gecikmeDk`).
 *
 * Ne verir, ne vermez:
 *   • verir  → son fiyat, günlük değişim, gün içi en yüksek/düşük, hacim
 *   • vermez → mum geçmişi. Teknik analiz 300 mum istiyor; geçmiş `yahoo.ts`
 *     (aktarıcı üzerinden) ve paylaşımlı önbellekten gelir.
 *
 * Borsa neden sabitlendi: döviz süzgeci tek pariteyi 219 satırda, her broker
 * için ayrı fiyatla döndürüyor (FX:AUDUSD 0.6767, THINKMARKETS:AUDUSD
 * 0.67666, FUSIONMARKETS:AUDUSD 0.67673). Hangisinin geleceği sabit olmazsa
 * fiyat her tazelemede birkaç pip oynar ve hacim alanı broker hacmi olur.
 * Bu yüzden her sembolün borsası elle yazıldı; eşleşmeyen satır atılır.
 *
 * Dikkat: bu uç nokta TradingView'ın kendi arayüzünün kullandığı, resmî
 * olarak dokümante edilmemiş bir adrestir. Sözleşme değişirse yalnızca bu
 * dosya güncellenir; `TRADINGVIEW_KAPALI=1` ile tümüyle devre dışı kalır ve
 * uygulama eski kaynaklara düşer.
 */

import { instrumentId, MarketDataError, type MarketId, type Quote } from "./types";

const BASE = process.env.TRADINGVIEW_API_BASE ?? "https://scanner.tradingview.com";

/** Tarama sütunları; sıra önemli, yanıt dizi olarak geliyor. */
const SUTUNLAR = ["name", "description", "close", "change", "high", "low", "volume", "currency"] as const;

/** Tek sembol uç noktasının alanları (endeksler için). */
const ALANLAR = "close,change,high,low,volume,currency";

const TARAYICI_BASLIK = {
  "content-type": "application/json",
  accept: "application/json",
  origin: "https://www.tradingview.com",
  referer: "https://www.tradingview.com/",
  "user-agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

/** Borsaya göre taranan piyasalar: tek istekte bütün liste. */
const BORSA_TARAMASI: Partial<Record<MarketId, { yol: string; borsalar: string[] }>> = {
  bist: { yol: "turkey", borsalar: ["BIST"] },
  abd: { yol: "america", borsalar: ["NASDAQ", "NYSE", "AMEX"] },
};

/**
 * Uygulama sembolü → tarayıcıdaki tam ad ("BORSA:AD").
 *
 * Uygulama sembolleri Yahoo biçiminde tutuluyor (`GC=F`, `USDTRY=X`,
 * `^GSPC`); tarayıcı vadelide ön ay kontratını (`GC1!`), dövizde pariteyi
 * (`USDTRY`), endekste kendi kodunu (`SPX`) kullanıyor. Eşleme elle yazıldı:
 * türetilebilir bir kural yok ve yanlış eşleşen bir sembol kullanıcıya
 * **başka bir varlığın fiyatını** gösterir. Listede olmayan sembol buradan
 * geçmez, Yahoo yoluna düşer.
 */
const VADELI: Record<string, string> = {
  "GC=F": "COMEX:GC1!",
  "SI=F": "COMEX:SI1!",
  "HG=F": "COMEX:HG1!",
  "PL=F": "NYMEX:PL1!",
  "PA=F": "NYMEX:PA1!",
  "CL=F": "NYMEX:CL1!",
  "BZ=F": "NYMEX:BZ1!",
  "NG=F": "NYMEX:NG1!",
  "ZW=F": "CBOT:ZW1!",
  "KC=F": "ICEUS:KC1!",
};

/** Döviz: TradingView'ın kendi birleşik beslemesi (broker fiyatı değil). */
const DOVIZ: Record<string, string> = {
  "USDTRY=X": "FX:USDTRY",
  "EURTRY=X": "FX:EURTRY",
  "GBPTRY=X": "FX:GBPTRY",
  "EURUSD=X": "FX:EURUSD",
  "GBPUSD=X": "FX:GBPUSD",
  "USDJPY=X": "FX:USDJPY",
  "USDCHF=X": "FX:USDCHF",
  "AUDUSD=X": "FX:AUDUSD",
  "USDCAD=X": "FX:USDCAD",
};

/**
 * Endeksler. Tarama bunları vermiyor (`type=index` süzgeci sıfır satır
 * döndürüyor), ama tek sembol uç noktası veriyor; sayıları az olduğu için
 * sembol başına istek burada sorun değil.
 */
const ENDEKS: Record<string, string> = {
  "^GSPC": "SP:SPX",
  "^IXIC": "NASDAQ:IXIC",
  "^DJI": "DJ:DJI",
  "XU100.IS": "BIST:XU100",
  "XU030.IS": "BIST:XU030",
  "DX-Y.NYB": "TVC:DXY",
};

type TarayiciYanit = {
  data?: { s: string; d: (string | number | null)[] }[];
};

type TekSembolYanit = {
  close?: number | null;
  change?: number | null;
  high?: number | null;
  low?: number | null;
  volume?: number | null;
  currency?: string | null;
};

export function tradingViewAcik(): boolean {
  return process.env.TRADINGVIEW_KAPALI !== "1";
}

/** Tek bir sembol tarayıcıdan gelebilir mi? */
export function tradingViewSembolu(market: MarketId, symbol: string): boolean {
  if (!tradingViewAcik()) return false;
  if (ENDEKS[symbol] || VADELI[symbol] || DOVIZ[symbol]) return true;
  // Borsa taraması bütün listeyi getirdiği için hisseler ad eşlemesi istemez.
  return BORSA_TARAMASI[market] !== undefined;
}

/**
 * İstenen sembollerin fiyatlarını çeker; anahtarı uygulama sembolü olan bir
 * eşlem döner. Gelmeyen sembol eşlemde yoktur — çağıran onu başka kaynaktan
 * tamamlar.
 *
 * İstek sayısı: hisse piyasasında 1 (bütün borsa), artı endeks sayısı kadar;
 * emtia piyasasında en çok 2 (vadeli + döviz) artı endeks.
 */
export async function fetchTradingViewQuotes(
  market: MarketId,
  semboller: string[],
): Promise<Map<string, Quote>> {
  if (!tradingViewAcik()) throw new MarketDataError("Kaynak kapalı.", 503);

  const borsa = BORSA_TARAMASI[market];
  const endeksler = semboller.filter((s) => ENDEKS[s]);
  const vadeli = semboller.filter((s) => VADELI[s]);
  const doviz = semboller.filter((s) => DOVIZ[s]);

  const isler: Promise<Map<string, Quote>>[] = [];

  if (borsa) {
    isler.push(tarama(market, borsa.yol, "exchange", borsa.borsalar, null));
  }
  if (vadeli.length > 0) {
    isler.push(tarama(market, "futures", "name", null, secilenler(vadeli, VADELI)));
  }
  if (doviz.length > 0) {
    isler.push(tarama(market, "forex", "name", null, secilenler(doviz, DOVIZ)));
  }
  for (const sembol of endeksler) {
    isler.push(tekSembol(market, sembol, ENDEKS[sembol]));
  }

  if (isler.length === 0) return new Map();

  // `allSettled`: bir bölge düşse bile diğerlerinden gelen satırlar kalsın.
  // `all` kullanmak, yarısı çalışan bir listeyi tümden hataya çevirirdi.
  const parcalar = await Promise.allSettled(isler);
  const sonuc = new Map<string, Quote>();
  for (const parca of parcalar) {
    if (parca.status !== "fulfilled") continue;
    for (const [sembol, quote] of parca.value) sonuc.set(sembol, quote);
  }

  if (sonuc.size === 0) {
    const ilk = parcalar.find((p) => p.status === "rejected");
    throw ilk && ilk.status === "rejected" && ilk.reason instanceof Error
      ? ilk.reason
      : new MarketDataError("Fiyat listesi boş döndü.", 502);
  }
  return sonuc;
}

/** Seçilen sembollerin tarayıcıdaki adları ve tam adları. */
function secilenler(semboller: string[], tablo: Record<string, string>) {
  const tamAdlar = new Set(semboller.map((s) => tablo[s]));
  const adlar = [...tamAdlar].map((tam) => tam.split(":")[1]);
  return { tamAdlar, adlar };
}

/** Bir bölgeyi tarar. */
async function tarama(
  market: MarketId,
  yol: string,
  sutun: "exchange" | "name",
  borsalar: string[] | null,
  secim: { tamAdlar: Set<string>; adlar: string[] } | null,
): Promise<Map<string, Quote>> {
  const sagTaraf = sutun === "exchange" ? borsalar : secim?.adlar;
  const yanit = await fetch(`${BASE}/${yol}/scan`, {
    method: "POST",
    headers: TARAYICI_BASLIK,
    body: JSON.stringify({
      filter: sagTaraf && sagTaraf.length > 0
        ? [{ left: sutun, operation: "in_range", right: sagTaraf }]
        : [],
      options: { lang: "tr" },
      columns: SUTUNLAR,
      sort:
        sutun === "exchange"
          ? { sortBy: "volume", sortOrder: "desc" }
          : { sortBy: "name", sortOrder: "asc" },
      // Ada göre süzülen bölgede aynı ad onlarca borsada çıkıyor; aralık bol
      // tutulur, istediğimiz borsa listenin neresinde olursa olsun yakalanır.
      range: [0, sutun === "exchange" ? 3000 : 400],
    }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });

  if (!yanit.ok) throw new MarketDataError(`Fiyat listesi alınamadı (${yanit.status}).`, 502);

  const govde = (await yanit.json()) as TarayiciYanit;
  const satirlar = govde.data ?? [];
  if (satirlar.length === 0) throw new MarketDataError("Fiyat listesi boş döndü.", 502);

  const sonuc = new Map<string, Quote>();
  for (const satir of satirlar) {
    // `satir.s` tam ad: "NYMEX:CL1!". Borsası sabitlenmiş semboller yalnızca
    // kendi borsalarından kabul edilir; gerisi atılır.
    if (secim && !secim.tamAdlar.has(satir.s)) continue;

    const [ad, aciklama, kapanis, degisim, yuksek, dusuk, hacim, paraBirimi] = satir.d;
    if (typeof ad !== "string" || typeof kapanis !== "number") continue;

    const sembol = secim ? uygulamaSembolu(satir.s) : borsaSembolu(market, ad);
    if (!sembol || sonuc.has(sembol)) continue;

    sonuc.set(
      sembol,
      quoteYap(market, sembol, {
        ad: typeof aciklama === "string" && aciklama ? aciklama : ad,
        ticker: ad,
        kapanis,
        degisim: typeof degisim === "number" ? degisim : 0,
        yuksek: typeof yuksek === "number" ? yuksek : kapanis,
        dusuk: typeof dusuk === "number" ? dusuk : kapanis,
        hacim: typeof hacim === "number" ? hacim : 0,
        paraBirimi: typeof paraBirimi === "string" ? paraBirimi : null,
      }),
    );
  }

  return sonuc;
}

/** Tek sembol uç noktası (endeksler). */
async function tekSembol(
  market: MarketId,
  sembol: string,
  tamAd: string,
): Promise<Map<string, Quote>> {
  const yanit = await fetch(
    `${BASE}/symbol?symbol=${encodeURIComponent(tamAd)}&fields=${encodeURIComponent(ALANLAR)}`,
    { headers: TARAYICI_BASLIK, signal: AbortSignal.timeout(8_000), cache: "no-store" },
  );
  if (!yanit.ok) throw new MarketDataError(`Fiyat alınamadı (${yanit.status}).`, 502);

  const govde = (await yanit.json()) as TekSembolYanit;
  if (typeof govde.close !== "number") {
    throw new MarketDataError("Fiyat boş döndü.", 502);
  }

  const ad = tamAd.split(":")[1];
  return new Map([
    [
      sembol,
      quoteYap(market, sembol, {
        ad,
        ticker: ad,
        kapanis: govde.close,
        degisim: typeof govde.change === "number" ? govde.change : 0,
        yuksek: typeof govde.high === "number" ? govde.high : govde.close,
        dusuk: typeof govde.low === "number" ? govde.low : govde.close,
        // Endekslerde hacim alanı boş gelebiliyor (DXY'de null).
        hacim: typeof govde.volume === "number" ? govde.volume : 0,
        // Endekslerde para birimi null geliyor; katalogdaki değer korunur.
        paraBirimi: typeof govde.currency === "string" ? govde.currency : null,
      }),
    ],
  ]);
}

function quoteYap(
  market: MarketId,
  sembol: string,
  v: {
    ad: string;
    ticker: string;
    kapanis: number;
    degisim: number;
    yuksek: number;
    dusuk: number;
    hacim: number;
    paraBirimi: string | null;
  },
): Quote {
  return {
    id: instrumentId(market, sembol),
    market,
    symbol: sembol,
    name: v.ad,
    ticker: v.ticker,
    // Para birimi bilinmiyorsa katalogdaki değer kullanılacak: çağıran
    // enstrümanı bu quote'un üstüne yaydığı için boş bırakmak yeterli değil,
    // bu yüzden piyasanın varsayılanı yazılır.
    currency: v.paraBirimi ?? (market === "bist" ? "TRY" : "USD"),
    kind: ENDEKS[sembol]
      ? "endeks"
      : DOVIZ[sembol]
        ? "doviz"
        : VADELI[sembol]
          ? "emtia"
          : "hisse",
    price: v.kapanis,
    // Önceki kapanış doğrudan gelmiyor; yüzde değişimden geri hesaplanır.
    previousClose: v.degisim === -100 ? v.kapanis : v.kapanis / (1 + v.degisim / 100),
    changePercent: v.degisim,
    high: v.yuksek,
    low: v.dusuk,
    volume: v.hacim,
    updatedAt: Date.now(),
  };
}

/** Borsa taramasındaki adı uygulamanın sembolüne çevirir. */
function borsaSembolu(market: MarketId, tarayiciAdi: string): string {
  return market === "bist" ? `${tarayiciAdi}.IS` : tarayiciAdi;
}

/** Tam addan ("FX:USDTRY") uygulama sembolünü bulur. */
function uygulamaSembolu(tamAd: string): string | null {
  for (const tablo of [VADELI, DOVIZ, ENDEKS]) {
    for (const [sembol, ad] of Object.entries(tablo)) {
      if (ad === tamAd) return sembol;
    }
  }
  return null;
}

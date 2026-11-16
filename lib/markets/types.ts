/**
 * Tüm piyasalar için ortak tipler.
 *
 * Uygulama dört piyasa sınıfını aynı arayüzle işler: kripto, ABD borsası,
 * Türkiye borsası (BIST) ve emtia/döviz. Analiz motoru yalnızca `Candle`
 * dizisiyle çalıştığı için piyasadan bağımsızdır.
 */

export type Candle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  quoteVolume: number;
  trades: number;
};

export type DataSource = "canli" | "demo";

/* ────────────────────────── Zaman dilimleri ────────────────────────── */

export type Interval = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d" | "1w";

export const INTERVALS: { value: Interval; minutes: number }[] = [
  { value: "1m", minutes: 1 },
  { value: "5m", minutes: 5 },
  { value: "15m", minutes: 15 },
  { value: "30m", minutes: 30 },
  { value: "1h", minutes: 60 },
  { value: "4h", minutes: 240 },
  { value: "1d", minutes: 1440 },
  { value: "1w", minutes: 10080 },
];

export function isInterval(value: string): value is Interval {
  return INTERVALS.some((i) => i.value === value);
}

export function intervalMinutes(interval: Interval): number {
  return INTERVALS.find((i) => i.value === interval)?.minutes ?? 60;
}

/* ────────────────────────── Piyasalar ────────────────────────── */

export type MarketId = "kripto" | "abd" | "bist" | "emtia";

/** Uygulamanın tanıdığı tüm piyasalar (kapalı olanlar dâhil). */
export const MARKET_IDS: MarketId[] = ["kripto", "abd", "bist", "emtia"];

/**
 * Şu an açık olan piyasalar.
 *
 * Dördü de açık. Üçü (ABD, BIST, emtia/döviz) bir süre kapalıydı: verisi
 * sembol başına kredi harcayan bir sağlayıcıdan geliyordu ve ücretsiz kota
 * listeyi doldurmaya yetmediği için kullanıcı yarı dolu tablo görüyordu.
 * Ölçümle (bkz. `scripts/kaynak-tara.ts`) tek istekte bütün borsayı veren,
 * kota harcamayan bir kaynak bulununca tekrar açıldılar.
 *
 * Gecikme konusunda dürüst olmak gerekiyor: BIST ve ABD hisse fiyatları
 * **15 dakika gecikmeli** geliyor (kaynağın kendi bildirimi:
 * `update_mode = "delayed_streaming_900"`). Ücretsiz ve gerçek zamanlı borsa
 * verisi yok; gecikme arayüzde yazılır, gizlenmez. Kripto gerçek zamanlıdır.
 */
export const AKTIF_MARKET_IDS: MarketId[] = ["kripto", "abd", "bist", "emtia"];

export function isMarketId(value: string): value is MarketId {
  return (MARKET_IDS as string[]).includes(value);
}

/** Piyasa şu an kullanıcıya açık mı? */
export function marketAktif(value: string): value is MarketId {
  return (AKTIF_MARKET_IDS as string[]).includes(value);
}

export type MarketMeta = {
  id: MarketId;
  /** Arayüzde kullanılacak çeviri anahtarı. */
  labelKey: string;
  /** Sayfa yolu: /piyasa/<slug> */
  slug: string;
  /**
   * Bu piyasada desteklenen zaman dilimleri.
   *
   * Kripto dışı piyasalarda gün içi periyotlar aktarıcı üzerinden geliyor
   * (ölçüldü 2026-11-16, `scripts/kaynak-tara.ts`: BIST, ABD, vadeli emtia ve
   * kurlarda 15 dk / 1 sa / 4 sa için 300'er mum). 1 ve 5 dakika bilerek yok:
   * hisse fiyatı 15 dakika gecikmeli geliyor, 1 dakikalık grafikte bu 15 mum
   * geride olmak demek ve sinyal anlamını yitirir.
   */
  intervals: Interval[];
  /** Fiyatların varsayılan para birimi. */
  currency: string;
  /** 7/24 açık mı (kripto) yoksa seans saatleri mi var. */
  alwaysOpen: boolean;
  /**
   * Hazır listelerde gösterilecek enstrüman sayısı; tanımsızsa tamamı.
   *
   * Liste bir dönem kısa tutulmuştu: veri ücretsiz katmandan sembol başına
   * kredi harcayarak geliyordu ve 46 sembol kotaya sığmadığı için ekran boş
   * kalıyordu. Artık veriyi günlük besleme dolduruyor (bkz. `scripts/besle.ts`)
   * ve önbellekten okumak kota harcamadığı için sınır kaldırıldı. Besleme
   * çalışmazsa kredi bütçesi devreye girer ve liste yine kademeli dolar.
   */
  listSize?: number;
  /**
   * Fiyatların kaç dakika gecikmeli geldiği; 0 ise gerçek zamanlı.
   *
   * Ücretsiz ve gerçek zamanlı borsa verisi yok: kaynak gecikmeyi kendi
   * bildiriyor (`update_mode`) ve ölçüldü — hisse 15 dakika, vadeli emtia
   * 10 dakika, döviz ve kripto gerçek zamanlı. Bu sayı arayüzde yazılır;
   * gecikmeyi gizlemek, kullanıcının 15 dakika önceki fiyata göre işlem
   * yapması demek olurdu.
   */
  gecikmeDk: number;
};

export const MARKETS: Record<MarketId, MarketMeta> = {
  kripto: {
    id: "kripto",
    labelKey: "market.kripto",
    slug: "kripto",
    intervals: ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"],
    currency: "USDT",
    alwaysOpen: true,
    gecikmeDk: 0,
  },
  abd: {
    id: "abd",
    labelKey: "market.abd",
    slug: "abd-borsasi",
    intervals: ["15m", "30m", "1h", "4h", "1d", "1w"],
    currency: "USD",
    alwaysOpen: false,
    gecikmeDk: 15,
  },
  bist: {
    id: "bist",
    labelKey: "market.bist",
    slug: "turkiye-borsasi",
    intervals: ["15m", "30m", "1h", "4h", "1d", "1w"],
    currency: "TRY",
    alwaysOpen: false,
    gecikmeDk: 15,
  },
  emtia: {
    id: "emtia",
    labelKey: "market.emtia",
    // Bu piyasa hem vadeli emtiayı (10 dk gecikmeli) hem kurları (gerçek
    // zamanlı) barındırıyor; kullanıcıyı yanıltmamak için kötü olan yazılır.
    slug: "dovizler",
    intervals: ["15m", "30m", "1h", "4h", "1d", "1w"],
    currency: "USD",
    alwaysOpen: false,
    gecikmeDk: 10,
  },
};

/**
 * Piyasaya geçildiğinde seçilecek periyot.
 *
 * Borsa ve emtiada günlük: günlük mumlar her gece veritabanına yazılıyor ve
 * veri kaynağına hiç gidilmiyor. Gün içi periyotlar her açılışta kaynaktan
 * çekilir ve kaynak dakikada ~20 istekle sınırlı; 30 hisselik bir tarama bu
 * sınıra takılır. Kullanıcı gün içini kendisi seçebilir, varsayılan olmaz.
 */
export function varsayilanPeriyot(market: MarketId, mevcut: Interval): Interval {
  if (market === "kripto") return MARKETS.kripto.intervals.includes(mevcut) ? mevcut : "4h";
  return "1d";
}

/** Yalnızca açık piyasaları çözer; kapalı bir piyasanın adresi 404 olur. */
export function marketBySlug(slug: string): MarketMeta | null {
  return AKTIF_MARKET_IDS.map((id) => MARKETS[id]).find((m) => m.slug === slug) ?? null;
}

/* ────────────────────────── Enstrümanlar ────────────────────────── */

export type AssetKind = "kripto" | "hisse" | "endeks" | "emtia" | "doviz";

export type Instrument = {
  /** Piyasa + sembol birleşimi: "abd:AAPL". */
  id: string;
  market: MarketId;
  /** Veri sağlayıcısına gönderilen sembol. */
  symbol: string;
  /** Tam ad: "Bitcoin", "Apple Inc.", "Türk Hava Yolları". */
  name: string;
  /** Kısa gösterim: "BTC/USDT", "AAPL", "THYAO", "Altın (ons)". */
  ticker: string;
  currency: string;
  kind: AssetKind;
};

export type Quote = Instrument & {
  price: number;
  previousClose: number;
  changePercent: number;
  high: number;
  low: number;
  /** İşlem hacmi (kriptoda kotasyon cinsinden, hisselerde adet). */
  volume: number;
  updatedAt: number;
};

export function instrumentId(market: MarketId, symbol: string): string {
  return `${market}:${symbol}`;
}

/**
 * Aramada karşılaştırılacak biçime indirger: küçük harf + aksan temizliği.
 * Böylece klavyeden aksansız yazılan "altin" → "Altın", "sisecam" → "Şişecam",
 * "turk hava" → "Türk Hava Yolları" eşleşmesi çalışır.
 */
export function foldText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function parseInstrumentId(
  id: string,
): { market: MarketId; symbol: string } | null {
  const [market, ...rest] = id.split(":");
  const symbol = rest.join(":");
  if (!isMarketId(market) || !symbol) return null;
  return { market, symbol };
}

/* ────────────────────────── Hatalar ────────────────────────── */

export class MarketDataError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "MarketDataError";
  }
}

/** Ağ erişimi yoksa sentetik veriye düşülsün mü? */
export function demoEnabled(): boolean {
  return process.env.DEMO_DATA === "1";
}

/* ────────────────────────── Mum toplama ────────────────────────── */

/**
 * Küçük periyotlu mumları birleştirerek daha büyük periyot üretir
 * (ör. 4 adet 1 saatlik mumdan 1 adet 4 saatlik mum). Sağlayıcı 4 saatlik
 * veri sunmadığında kullanılır.
 */
export function aggregateCandles(candles: Candle[], factor: number): Candle[] {
  if (factor <= 1) return candles;
  const out: Candle[] = [];

  for (let i = 0; i < candles.length; i += factor) {
    const group = candles.slice(i, i + factor);
    if (group.length === 0) continue;
    out.push({
      openTime: group[0].openTime,
      open: group[0].open,
      high: Math.max(...group.map((c) => c.high)),
      low: Math.min(...group.map((c) => c.low)),
      close: group[group.length - 1].close,
      volume: group.reduce((sum, c) => sum + c.volume, 0),
      closeTime: group[group.length - 1].closeTime,
      quoteVolume: group.reduce((sum, c) => sum + c.quoteVolume, 0),
      trades: group.reduce((sum, c) => sum + c.trades, 0),
    });
  }
  return out;
}

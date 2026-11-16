/**
 * Temel analiz puanlaması — saf fonksiyonlar, ağdan bağımsız.
 *
 * Teknik analiz "ne zaman" sorusuna, temel analiz "neyi" sorusuna bakar:
 * şirket ucuz mu, kâr ediyor mu, büyüyor mu, borcunu taşıyabiliyor mu.
 *
 * Puanlamanın temel kararı: oranlar **mutlak eşiklerle değil, emsallerle**
 * kıyaslanır. F/K 8 bir banka için sıradan, bir yazılım şirketi için çok
 * ucuzdur; "F/K 10'un altı ucuzdur" gibi bir kural sektörler arasında yanlış
 * sonuç verir. Her ölçüt için şirketin kendi sektöründeki yüzdelik sırası
 * hesaplanır (sektörde yeterli şirket yoksa bütün borsa kullanılır).
 *
 * Bilinen sınırlar — gizlenmemeli:
 *   • Veri üç aylık bilançolardan gelir; fiyat kadar taze değildir.
 *   • Yüksek enflasyonda yıllık büyüme oranları yanıltıcı olabilir (kaynak
 *     bilanço kalemlerini dolar cinsinden verdiği için etki azalır ama
 *     kaybolmaz).
 *   • Sektöre göre sıra, sektörün tamamı pahalıysa "ucuz" göstermez; yalnızca
 *     emsallerine göre nerede durduğunu söyler.
 *   • Oranlar geçmişi anlatır; şirketin geleceğini bilmez.
 */

/** Tek bir şirketin ham temel verisi. Bilinmeyen alan null'dır. */
export type TemelSatir = {
  /** Borsadaki kısa kod ("THYAO", "AAPL"). */
  code: string;
  sector: string | null;
  marketCap: number | null;
  /** Hisse başına kâr (son 12 ay); işareti zararı gösterir. */
  eps: number | null;
  pe: number | null;
  pb: number | null;
  ps: number | null;
  evEbitda: number | null;
  roe: number | null;
  netMargin: number | null;
  operatingMargin: number | null;
  revenueGrowth: number | null;
  epsGrowth: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  dividendYield: number | null;
  /** Analist ortalaması: 1 = güçlü al … 5 = güçlü sat. */
  analystRating: number | null;
};

export type PillarId = "valuation" | "profitability" | "growth" | "health";

export type TemelOlcut = {
  id: keyof TemelSatir;
  value: number;
  /** Emsallerin ortancası (kıyas için gösterilir). */
  median: number | null;
  /** 0–100: emsallerin yüzde kaçından daha iyi. Hesaplanamadıysa null. */
  percentile: number | null;
};

export type TemelSutun = {
  id: PillarId;
  /** 0–100; hiç ölçüt hesaplanamadıysa null. */
  score: number | null;
  metrics: TemelOlcut[];
};

export type Fundamentals = {
  /** 0–100 bileşik puan. */
  score: number;
  gradeKey: "fund.grade.strong" | "fund.grade.good" | "fund.grade.neutral" | "fund.grade.weak" | "fund.grade.poor";
  pillars: TemelSutun[];
  sector: string | null;
  /** Kıyaslanan şirket sayısı. */
  peers: number;
  /** Kıyas sektörle mi yapıldı, bütün borsayla mı? */
  scope: "sector" | "market";
  marketCap: number | null;
  dividendYield: number | null;
  analystRating: number | null;
  /** Dikkat edilmesi gereken durumlar (çeviri anahtarı). */
  flags: string[];
};

/** Bir sektörde en az bu kadar emsal yoksa bütün borsayla kıyaslanır. */
const MIN_SECTOR_PEERS = 8;

/**
 * Hangi ölçüt hangi sütunda ve "iyi" hangi yönde.
 *
 * `positiveOnly`: değer ancak pozitifken anlamlıdır. Negatif F/K "çok ucuz"
 * demek değildir; şirket zarardadır ve oranın kendisi tanımsızdır.
 */
type OlcutTanimi = {
  id: keyof TemelSatir;
  pillar: PillarId;
  higherIsBetter: boolean;
  positiveOnly?: boolean;
  /** Finans sektöründe anlamsız (bankanın "borcu" mevduattır, işin kendisidir). */
  skipForFinance?: boolean;
};

const OLCUTLER: OlcutTanimi[] = [
  { id: "pe", pillar: "valuation", higherIsBetter: false, positiveOnly: true },
  { id: "pb", pillar: "valuation", higherIsBetter: false, positiveOnly: true },
  { id: "ps", pillar: "valuation", higherIsBetter: false, positiveOnly: true, skipForFinance: true },
  { id: "evEbitda", pillar: "valuation", higherIsBetter: false, positiveOnly: true, skipForFinance: true },
  { id: "roe", pillar: "profitability", higherIsBetter: true },
  { id: "netMargin", pillar: "profitability", higherIsBetter: true },
  { id: "operatingMargin", pillar: "profitability", higherIsBetter: true, skipForFinance: true },
  { id: "revenueGrowth", pillar: "growth", higherIsBetter: true },
  { id: "epsGrowth", pillar: "growth", higherIsBetter: true },
  { id: "debtToEquity", pillar: "health", higherIsBetter: false, skipForFinance: true },
  { id: "currentRatio", pillar: "health", higherIsBetter: true, skipForFinance: true },
];

const SUTUN_AGIRLIGI: Record<PillarId, number> = {
  valuation: 0.3,
  profitability: 0.3,
  growth: 0.2,
  health: 0.2,
};

const SUTUN_SIRASI: PillarId[] = ["valuation", "profitability", "growth", "health"];

function sayi(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function ortanca(values: number[]): number | null {
  if (values.length === 0) return null;
  const sirali = [...values].sort((a, b) => a - b);
  const orta = Math.floor(sirali.length / 2);
  return sirali.length % 2 === 1 ? sirali[orta] : (sirali[orta - 1] + sirali[orta]) / 2;
}

/** `value`'nun `values` içindeki yüzdelik sırası (0–100); eşitlikler yarım sayılır. */
function yuzdelik(value: number, values: number[]): number {
  if (values.length === 0) return 50;
  let kucuk = 0;
  let esit = 0;
  for (const v of values) {
    if (v < value) kucuk++;
    else if (v === value) esit++;
  }
  return ((kucuk + esit / 2) / values.length) * 100;
}

export function finansSektoru(sector: string | null): boolean {
  return sector === "Finance";
}

/**
 * Bir şirketi emsalleriyle kıyaslayıp puanlar.
 *
 * `evren` aynı borsadaki şirketlerdir (şirketin kendisi dahil olabilir).
 * En az iki sütunda veri yoksa null döner: tek bir orandan "temel analiz"
 * çıkarmak, olmayan bir bütünlük izlenimi verirdi.
 */
export function temelPuanla(sirket: TemelSatir, evren: TemelSatir[]): Fundamentals | null {
  const finans = finansSektoru(sirket.sector);
  const sektorEmsalleri = sirket.sector
    ? evren.filter((s) => s.sector === sirket.sector && s.code !== sirket.code)
    : [];
  const sektorle = sektorEmsalleri.length >= MIN_SECTOR_PEERS;
  const emsaller = sektorle ? sektorEmsalleri : evren.filter((s) => s.code !== sirket.code);

  const sutunlar = new Map<PillarId, TemelOlcut[]>();
  for (const id of SUTUN_SIRASI) sutunlar.set(id, []);

  const flags: string[] = [];
  const zararda = sirket.eps !== null && sirket.eps < 0;
  if (zararda) flags.push("fund.flag.loss");
  if (sirket.pb !== null && sirket.pb < 0) flags.push("fund.flag.negativeEquity");

  for (const tanim of OLCUTLER) {
    if (finans && tanim.skipForFinance) continue;
    const deger = sayi(sirket[tanim.id]);
    const emsalDegerleri = emsaller
      .map((s) => sayi(s[tanim.id]))
      .filter((v): v is number => v !== null && (!tanim.positiveOnly || v > 0));

    // Zarardaki şirketin F/K'sı tanımsız gelir; "veri yok" diye atlamak onu
    // değerleme sütununda cezasız bırakırdı. En kötü sıraya yazılır.
    if (tanim.id === "pe" && zararda) {
      sutunlar.get(tanim.pillar)?.push({
        id: tanim.id,
        value: deger ?? 0,
        median: ortanca(emsalDegerleri),
        percentile: 0,
      });
      continue;
    }

    if (deger === null) continue;
    if (tanim.positiveOnly && deger <= 0) {
      sutunlar.get(tanim.pillar)?.push({
        id: tanim.id,
        value: deger,
        median: ortanca(emsalDegerleri),
        percentile: 0,
      });
      continue;
    }

    const sira = emsalDegerleri.length >= 5 ? yuzdelik(deger, emsalDegerleri) : null;
    sutunlar.get(tanim.pillar)?.push({
      id: tanim.id,
      value: deger,
      median: ortanca(emsalDegerleri),
      percentile: sira === null ? null : tanim.higherIsBetter ? sira : 100 - sira,
    });
  }

  const pillars: TemelSutun[] = SUTUN_SIRASI.map((id) => {
    const metrics = sutunlar.get(id) ?? [];
    const puanlar = metrics.map((m) => m.percentile).filter((p): p is number => p !== null);
    return {
      id,
      score: puanlar.length === 0 ? null : puanlar.reduce((a, b) => a + b, 0) / puanlar.length,
      metrics,
    };
  });

  const dolu = pillars.filter((p) => p.score !== null);
  if (dolu.length < 2) return null;

  const agirlik = dolu.reduce((sum, p) => sum + SUTUN_AGIRLIGI[p.id], 0);
  const score = dolu.reduce((sum, p) => sum + (p.score as number) * SUTUN_AGIRLIGI[p.id], 0) / agirlik;

  // Borç yükü emsallerine göre en ağır beşte birdeyse ayrıca belirtilir.
  const borc = pillars
    .find((p) => p.id === "health")
    ?.metrics.find((m) => m.id === "debtToEquity");
  if (borc && borc.percentile !== null && borc.percentile <= 20) flags.push("fund.flag.highDebt");

  return {
    score: Math.round(score),
    gradeKey:
      score >= 70
        ? "fund.grade.strong"
        : score >= 57
          ? "fund.grade.good"
          : score >= 43
            ? "fund.grade.neutral"
            : score >= 30
              ? "fund.grade.weak"
              : "fund.grade.poor",
    pillars,
    sector: sirket.sector,
    peers: emsaller.length,
    scope: sektorle ? "sector" : "market",
    marketCap: sirket.marketCap,
    dividendYield: sirket.dividendYield,
    analystRating: sirket.analystRating,
    flags,
  };
}

/**
 * Teknik sinyal ile temel puanı yan yana koyar.
 *
 * İkisi tek bir sayıya **karıştırılmaz**: farklı sorulara, farklı vadelerde
 * yanıt verirler. Teknik alış + zayıf temel "spekülatif hareket", teknik
 * satış + güçlü temel "sağlam şirkette düşüş" demektir; ortalaması alınınca
 * ikisi de "nötr" görünür ve asıl bilgi kaybolur.
 */
export function bilesikGorunum(
  teknik: "buy" | "sell" | "wait",
  temelPuani: number,
): string {
  const temel = temelPuani >= 57 ? "Strong" : temelPuani < 43 ? "Weak" : "Mid";
  return `overall.${teknik}${temel}`;
}

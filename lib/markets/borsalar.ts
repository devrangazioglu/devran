/**
 * Hisse borsalarının ortak tanımı.
 *
 * Bir borsayı eklemek, birbirinden habersiz beş yerde aynı bilgiyi yazmak
 * demekti: anlık fiyatın tarandığı bölge (TradingView), mum geçmişinin
 * sembol biçimi (Yahoo soneki), temel analizin kıyas evreni, göreli güç için
 * endeks ve arama sonucunun hangi piyasaya düşeceği. Biri unutulunca o
 * borsada sessizce bir özellik eksik kalıyordu. Hepsi burada, tek satırda.
 *
 * Sembol biçimi: uygulama sembolleri Yahoo biçimindedir ("SAP.DE",
 * "7203.T", "0700.HK"), çünkü mum geçmişi oradan gelir. TradingView aynı
 * hisseyi yalnızca borsa koduyla ("SAP", "7203", "700") verir. İki yön de
 * elle yazıldı ve `scripts/ulke-tara.ts` ile iki kaynağın fiyatı
 * karşılaştırılarak doğrulandı: yanlış eşlenen bir sembol kullanıcıya başka
 * bir şirketin grafiğini gösterir.
 */

import type { MarketId } from "./types";

export type BorsaTanimi = {
  /** TradingView tarayıcısındaki bölge: `/<yol>/scan`. */
  tvYol: string;
  /** Bölgede kabul edilen borsa kodları; diğerleri (ikincil pazarlar) atılır. */
  tvBorsalar: string[];
  /**
   * Bütün borsayı hacme göre mi çekelim, yoksa yalnızca listedeki adları mı?
   * ABD ve BIST'te bütün borsa tek istekte geliyor; Japonya ve Çin'de 4–5
   * bin hisse var ve hacme göre ilk 3000 bazı büyük ama sakin hisseleri
   * dışarıda bırakabiliyor. Adla süzmek hem kesin hem küçük bir yanıt.
   */
  adaGore: boolean;
  /** Tarayıcı adı → uygulama (Yahoo) sembolü. */
  uygulamaSembolu: (tvAdi: string, tvBorsa: string) => string;
  /** Uygulama sembolü → tarayıcı adı. */
  tvAdi: (symbol: string) => string;
  /** Göreli güç kıyası ve listenin başındaki endeks. */
  endeks: { symbol: string; tv: string; ticker: string };
  /** Yahoo aramasındaki borsa kodları (aramada hangi piyasaya düşeceği). */
  yahooBorsalar: string[];
  /** Temel analizde emsal dağılımı için piyasa değerine göre ilk N hisse. */
  temelAdet: number;
};

/** "SAP.DE" → "SAP": son noktadan sonrasını atar. */
const sonekAt = (symbol: string) => symbol.replace(/\.[A-Z]+$/, "");

export const BORSALAR: Partial<Record<MarketId, BorsaTanimi>> = {
  abd: {
    tvYol: "america",
    tvBorsalar: ["NASDAQ", "NYSE", "AMEX"],
    adaGore: false,
    uygulamaSembolu: (ad) => ad,
    tvAdi: (s) => s,
    endeks: { symbol: "^GSPC", tv: "TVC:SPX", ticker: "S&P 500" },
    yahooBorsalar: ["NMS", "NYQ", "NGM", "PCX", "ASE", "BTS", "NCM", "NYS"],
    temelAdet: 2500,
  },
  bist: {
    tvYol: "turkey",
    tvBorsalar: ["BIST"],
    adaGore: false,
    uygulamaSembolu: (ad) => `${ad}.IS`,
    tvAdi: sonekAt,
    endeks: { symbol: "XU100.IS", tv: "BIST:XU100", ticker: "BIST 100" },
    yahooBorsalar: ["IST"],
    temelAdet: 1000,
  },
  almanya: {
    tvYol: "germany",
    tvBorsalar: ["XETR"],
    adaGore: true,
    uygulamaSembolu: (ad) => `${ad}.DE`,
    tvAdi: sonekAt,
    endeks: { symbol: "^GDAXI", tv: "TVC:DAX", ticker: "DAX" },
    yahooBorsalar: ["GER", "FRA"],
    temelAdet: 800,
  },
  ingiltere: {
    tvYol: "uk",
    tvBorsalar: ["LSE"],
    adaGore: true,
    // Tarayıcı "BT.A" gibi sınıf harfini noktayla, Yahoo tireyle yazar.
    uygulamaSembolu: (ad) => `${ad.replace(/\.$/, "").replace(/\./g, "-")}.L`,
    // Londra'nın iki harfli kodları tarayıcıda noktayla biter ("BP.", "RR.").
    tvAdi: (s) => {
      const kod = sonekAt(s).replace(/-/g, ".");
      return kod.length <= 2 ? `${kod}.` : kod;
    },
    endeks: { symbol: "^FTSE", tv: "TVC:UKX", ticker: "FTSE 100" },
    yahooBorsalar: ["LSE"],
    temelAdet: 1000,
  },
  fransa: {
    tvYol: "france",
    tvBorsalar: ["EURONEXT"],
    adaGore: true,
    uygulamaSembolu: (ad) => `${ad}.PA`,
    tvAdi: sonekAt,
    endeks: { symbol: "^FCHI", tv: "TVC:CAC40", ticker: "CAC 40" },
    yahooBorsalar: ["PAR"],
    temelAdet: 600,
  },
  japonya: {
    tvYol: "japan",
    tvBorsalar: ["TSE"],
    adaGore: true,
    uygulamaSembolu: (ad) => `${ad}.T`,
    tvAdi: sonekAt,
    endeks: { symbol: "^N225", tv: "TVC:NI225", ticker: "Nikkei 225" },
    yahooBorsalar: ["JPX"],
    temelAdet: 2500,
  },
  hongkong: {
    tvYol: "hongkong",
    tvBorsalar: ["HKEX"],
    adaGore: true,
    // Tarayıcı "700", Yahoo dört haneye tamamlanmış "0700.HK" yazar.
    uygulamaSembolu: (ad) => `${ad.padStart(4, "0")}.HK`,
    tvAdi: (s) => sonekAt(s).replace(/^0+(?=\d)/, ""),
    endeks: { symbol: "^HSI", tv: "TVC:HSI", ticker: "Hang Seng" },
    yahooBorsalar: ["HKG"],
    temelAdet: 1500,
  },
  cin: {
    tvYol: "china",
    tvBorsalar: ["SSE", "SZSE"],
    adaGore: true,
    // Şanghay → ".SS", Shenzhen → ".SZ"; kod iki borsada çakışmaz.
    uygulamaSembolu: (ad, borsa) => `${ad}.${borsa === "SSE" ? "SS" : "SZ"}`,
    tvAdi: sonekAt,
    endeks: { symbol: "000001.SS", tv: "SSE:000001", ticker: "SSE Composite" },
    yahooBorsalar: ["SHH", "SHZ"],
    temelAdet: 2500,
  },
  hindistan: {
    tvYol: "india",
    tvBorsalar: ["NSE"],
    adaGore: true,
    // "M&M" gibi adlar Yahoo'da da aynı yazılır.
    uygulamaSembolu: (ad) => `${ad}.NS`,
    tvAdi: sonekAt,
    endeks: { symbol: "^NSEI", tv: "NSE:NIFTY", ticker: "Nifty 50" },
    yahooBorsalar: ["NSI"],
    temelAdet: 2000,
  },
  kanada: {
    tvYol: "canada",
    tvBorsalar: ["TSX"],
    adaGore: true,
    uygulamaSembolu: (ad) => `${ad.replace(/\./g, "-")}.TO`,
    tvAdi: (s) => sonekAt(s).replace(/-/g, "."),
    endeks: { symbol: "^GSPTSE", tv: "TSX:TSX", ticker: "S&P/TSX" },
    yahooBorsalar: ["TOR"],
    temelAdet: 1000,
  },
  kore: {
    tvYol: "korea",
    tvBorsalar: ["KRX"],
    adaGore: true,
    uygulamaSembolu: (ad) => `${ad}.KS`,
    tvAdi: sonekAt,
    endeks: { symbol: "^KS11", tv: "KRX:KOSPI", ticker: "KOSPI" },
    yahooBorsalar: ["KSC"],
    temelAdet: 1000,
  },
  tayvan: {
    tvYol: "taiwan",
    tvBorsalar: ["TWSE"],
    adaGore: true,
    uygulamaSembolu: (ad) => `${ad}.TW`,
    tvAdi: sonekAt,
    endeks: { symbol: "^TWII", tv: "TWSE:IX0001", ticker: "TAIEX" },
    yahooBorsalar: ["TAI"],
    temelAdet: 1000,
  },
  suudi: {
    tvYol: "ksa",
    tvBorsalar: ["TADAWUL"],
    adaGore: false,
    uygulamaSembolu: (ad) => `${ad}.SR`,
    tvAdi: sonekAt,
    endeks: { symbol: "^TASI.SR", tv: "TADAWUL:TASI", ticker: "TASI" },
    yahooBorsalar: ["SAU"],
    temelAdet: 400,
  },
};

export function borsa(market: MarketId): BorsaTanimi | null {
  return BORSALAR[market] ?? null;
}

/** Yahoo arama sonucunun borsa kodundan piyasayı bulur. */
export function yahooBorsasindanPiyasa(kod: string): MarketId | null {
  for (const [market, tanim] of Object.entries(BORSALAR)) {
    if (tanim?.yahooBorsalar.includes(kod)) return market as MarketId;
  }
  return null;
}

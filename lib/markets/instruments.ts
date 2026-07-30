/**
 * Kripto dışındaki piyasaların enstrüman listeleri.
 *
 * Kripto pariteleri sağlayıcıdan dinamik olarak gelir; hisse, endeks, emtia ve
 * döviz enstrümanları burada tanımlıdır. Yeni bir enstrüman eklemek için
 * listeye bir satır yazmak yeterlidir.
 */

import { foldText, instrumentId, type AssetKind, type Instrument, type MarketId } from "./types";

type Entry = {
  symbol: string;
  name: string;
  ticker?: string;
  kind?: AssetKind;
  currency?: string;
  /**
   * Aramada ek olarak eşleşecek kelimeler. Adlar Türkçe olduğu için
   * İngilizce ve yaygın diğer yazımlar buraya yazılır ("gold", "oil").
   */
  aliases?: string[];
};

/** Enstrüman kimliği → aranabilir ek kelimeler (indirgenmiş biçimde). */
const ALIASES = new Map<string, string>();

function build(market: MarketId, currency: string, kind: AssetKind, entries: Entry[]): Instrument[] {
  return entries.map((entry) => {
    const instrument: Instrument = {
      id: instrumentId(market, entry.symbol),
      market,
      symbol: entry.symbol,
      name: entry.name,
      ticker: entry.ticker ?? entry.symbol,
      currency: entry.currency ?? currency,
      kind: entry.kind ?? kind,
    };
    if (entry.aliases?.length) {
      ALIASES.set(instrument.id, foldText(entry.aliases.join(" ")));
    }
    return instrument;
  });
}

/** Verilen enstrüman için aranabilir ek kelimeler; yoksa boş metin. */
export function instrumentAliases(id: string): string {
  return ALIASES.get(id) ?? "";
}

/* ────────────────────────── ABD borsası ────────────────────────── */

export const US_INSTRUMENTS: Instrument[] = build("abd", "USD", "hisse", [
  {
    symbol: "^GSPC",
    name: "S&P 500",
    ticker: "S&P 500",
    kind: "endeks",
    aliases: ["sp500", "s&p", "standard poors", "spx", "endeks", "index"],
  },
  {
    symbol: "^IXIC",
    name: "Nasdaq Composite",
    ticker: "NASDAQ",
    kind: "endeks",
    aliases: ["nasdaq", "ixic", "teknoloji", "endeks", "index"],
  },
  {
    symbol: "^DJI",
    name: "Dow Jones Industrial",
    ticker: "DOW 30",
    kind: "endeks",
    aliases: ["dow jones", "dji", "endeks", "index"],
  },
  { symbol: "AAPL", name: "Apple Inc.", aliases: ["iphone", "elma"] },
  { symbol: "MSFT", name: "Microsoft", aliases: ["windows", "azure"] },
  { symbol: "NVDA", name: "NVIDIA", aliases: ["yapay zeka", "ai", "gpu", "ekran karti"] },
  { symbol: "GOOGL", name: "Alphabet (Google)", aliases: ["google", "youtube"] },
  { symbol: "AMZN", name: "Amazon", aliases: ["aws"] },
  { symbol: "META", name: "Meta Platforms", aliases: ["facebook", "instagram", "whatsapp"] },
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "AVGO", name: "Broadcom" },
  { symbol: "JPM", name: "JPMorgan Chase" },
  { symbol: "V", name: "Visa" },
  { symbol: "MA", name: "Mastercard" },
  { symbol: "UNH", name: "UnitedHealth" },
  { symbol: "XOM", name: "Exxon Mobil" },
  { symbol: "WMT", name: "Walmart" },
  { symbol: "JNJ", name: "Johnson & Johnson" },
  { symbol: "PG", name: "Procter & Gamble" },
  { symbol: "HD", name: "Home Depot" },
  { symbol: "COST", name: "Costco" },
  { symbol: "ORCL", name: "Oracle" },
  { symbol: "KO", name: "Coca-Cola" },
  { symbol: "PEP", name: "PepsiCo" },
  { symbol: "BAC", name: "Bank of America" },
  { symbol: "NFLX", name: "Netflix" },
  { symbol: "AMD", name: "AMD" },
  { symbol: "CRM", name: "Salesforce" },
  { symbol: "ADBE", name: "Adobe" },
  { symbol: "INTC", name: "Intel" },
  { symbol: "DIS", name: "Walt Disney" },
  { symbol: "PFE", name: "Pfizer" },
  { symbol: "CSCO", name: "Cisco" },
  { symbol: "MCD", name: "McDonald's" },
  { symbol: "NKE", name: "Nike" },
  { symbol: "BA", name: "Boeing" },
  { symbol: "CAT", name: "Caterpillar" },
  { symbol: "IBM", name: "IBM" },
  { symbol: "QCOM", name: "Qualcomm" },
  { symbol: "T", name: "AT&T" },
  { symbol: "UBER", name: "Uber" },
  { symbol: "SBUX", name: "Starbucks" },
  { symbol: "GM", name: "General Motors" },
  { symbol: "F", name: "Ford Motor" },
  { symbol: "PLTR", name: "Palantir" },
  { symbol: "COIN", name: "Coinbase" },
]);

/* ────────────────────────── Türkiye borsası (BIST) ────────────────────────── */

export const BIST_INSTRUMENTS: Instrument[] = build("bist", "TRY", "hisse", [
  {
    symbol: "XU100.IS",
    name: "BIST 100 Endeksi",
    ticker: "BIST 100",
    kind: "endeks",
    aliases: ["bist100", "borsa istanbul", "xu100", "index"],
  },
  {
    symbol: "XU030.IS",
    name: "BIST 30 Endeksi",
    ticker: "BIST 30",
    kind: "endeks",
    aliases: ["bist30", "borsa istanbul", "xu030", "index"],
  },
  {
    symbol: "THYAO.IS",
    name: "Türk Hava Yolları",
    ticker: "THYAO",
    aliases: ["turkish airlines", "thy", "havayolu", "airline"],
  },
  { symbol: "ASELS.IS", name: "Aselsan", ticker: "ASELS", aliases: ["savunma", "defence"] },
  { symbol: "BIMAS.IS", name: "BİM Birleşik Mağazalar", ticker: "BIMAS" },
  { symbol: "EREGL.IS", name: "Erdemir", ticker: "EREGL" },
  { symbol: "KCHOL.IS", name: "Koç Holding", ticker: "KCHOL" },
  { symbol: "SAHOL.IS", name: "Sabancı Holding", ticker: "SAHOL" },
  { symbol: "SISE.IS", name: "Şişecam", ticker: "SISE" },
  { symbol: "TUPRS.IS", name: "Tüpraş", ticker: "TUPRS" },
  { symbol: "FROTO.IS", name: "Ford Otosan", ticker: "FROTO" },
  { symbol: "TOASO.IS", name: "Tofaş", ticker: "TOASO" },
  { symbol: "GARAN.IS", name: "Garanti BBVA", ticker: "GARAN" },
  { symbol: "AKBNK.IS", name: "Akbank", ticker: "AKBNK" },
  { symbol: "ISCTR.IS", name: "İş Bankası", ticker: "ISCTR" },
  { symbol: "YKBNK.IS", name: "Yapı Kredi", ticker: "YKBNK" },
  { symbol: "VAKBN.IS", name: "VakıfBank", ticker: "VAKBN" },
  { symbol: "HALKB.IS", name: "Halkbank", ticker: "HALKB" },
  { symbol: "PETKM.IS", name: "Petkim", ticker: "PETKM" },
  { symbol: "TCELL.IS", name: "Turkcell", ticker: "TCELL" },
  { symbol: "TTKOM.IS", name: "Türk Telekom", ticker: "TTKOM" },
  { symbol: "ARCLK.IS", name: "Arçelik", ticker: "ARCLK" },
  { symbol: "PGSUS.IS", name: "Pegasus", ticker: "PGSUS" },
  { symbol: "TAVHL.IS", name: "TAV Havalimanları", ticker: "TAVHL" },
  { symbol: "ENKAI.IS", name: "Enka İnşaat", ticker: "ENKAI" },
  { symbol: "KOZAL.IS", name: "Koza Altın", ticker: "KOZAL" },
  { symbol: "SASA.IS", name: "Sasa Polyester", ticker: "SASA" },
  { symbol: "HEKTS.IS", name: "Hektaş", ticker: "HEKTS" },
  { symbol: "ALARK.IS", name: "Alarko Holding", ticker: "ALARK" },
  { symbol: "TKFEN.IS", name: "Tekfen Holding", ticker: "TKFEN" },
  { symbol: "VESTL.IS", name: "Vestel", ticker: "VESTL" },
  { symbol: "MGROS.IS", name: "Migros", ticker: "MGROS" },
  { symbol: "ULKER.IS", name: "Ülker Bisküvi", ticker: "ULKER" },
  { symbol: "DOAS.IS", name: "Doğuş Otomotiv", ticker: "DOAS" },
  { symbol: "EKGYO.IS", name: "Emlak Konut GYO", ticker: "EKGYO" },
  { symbol: "ASTOR.IS", name: "Astor Enerji", ticker: "ASTOR" },
  { symbol: "SOKM.IS", name: "Şok Marketler", ticker: "SOKM" },
  { symbol: "TSKB.IS", name: "TSKB", ticker: "TSKB" },
  { symbol: "ZOREN.IS", name: "Zorlu Enerji", ticker: "ZOREN" },
  { symbol: "AEFES.IS", name: "Anadolu Efes", ticker: "AEFES" },
  { symbol: "CCOLA.IS", name: "Coca-Cola İçecek", ticker: "CCOLA" },
  { symbol: "KRDMD.IS", name: "Kardemir (D)", ticker: "KRDMD" },
  { symbol: "OYAKC.IS", name: "Oyak Çimento", ticker: "OYAKC" },
]);

/* ────────────────────────── Emtia ve döviz ────────────────────────── */

export const COMMODITY_FX_INSTRUMENTS: Instrument[] = [
  ...build("emtia", "USD", "emtia", [
    { symbol: "GC=F", name: "Altın (ons)", ticker: "XAU", aliases: ["gold", "oro", "or", "золото", "ذهب", "黄金", "gramaltin"] },
    { symbol: "SI=F", name: "Gümüş (ons)", ticker: "XAG", aliases: ["silver", "plata", "argent", "серебро", "فضة", "白银"] },
    { symbol: "PL=F", name: "Platin (ons)", ticker: "XPT", aliases: ["platinum", "platino"] },
    { symbol: "PA=F", name: "Paladyum (ons)", ticker: "XPD", aliases: ["palladium", "paladio"] },
    { symbol: "HG=F", name: "Bakır", ticker: "COPPER", aliases: ["copper", "cobre", "kupfer", "медь", "铜"] },
    { symbol: "CL=F", name: "Petrol (WTI)", ticker: "WTI", aliases: ["oil", "crude", "petroleum", "petrole", "нефть", "نفط", "石油", "ham petrol"] },
    { symbol: "BZ=F", name: "Petrol (Brent)", ticker: "BRENT", aliases: ["oil", "brent crude", "petrol", "нефть", "石油"] },
    { symbol: "NG=F", name: "Doğal gaz", ticker: "NATGAS", aliases: ["natural gas", "gas", "gaz", "erdgas", "газ"] },
    { symbol: "ZW=F", name: "Buğday", ticker: "WHEAT", aliases: ["wheat", "trigo", "weizen", "пшеница"] },
    { symbol: "KC=F", name: "Kahve", ticker: "COFFEE", aliases: ["coffee", "cafe", "kaffee", "кофе"] },
  ]),
  ...build("emtia", "USD", "doviz", [
    {
      symbol: "USDTRY=X",
      name: "Dolar / Türk Lirası",
      ticker: "USD/TRY",
      currency: "TRY",
      aliases: ["dollar", "usd try", "usdtry", "turkish lira", "dolar kuru", "доллар", "دولار", "美元"],
    },
    {
      symbol: "EURTRY=X",
      name: "Euro / Türk Lirası",
      ticker: "EUR/TRY",
      currency: "TRY",
      aliases: ["euro", "eur try", "eurtry", "avro", "евро", "يورو", "欧元"],
    },
    {
      symbol: "GBPTRY=X",
      name: "Sterlin / Türk Lirası",
      ticker: "GBP/TRY",
      currency: "TRY",
      aliases: ["pound", "sterling", "gbp try", "gbptry", "фунт"],
    },
    { symbol: "EURUSD=X", name: "Euro / Dolar", ticker: "EUR/USD", aliases: ["euro dollar", "eurusd", "евро"] },
    { symbol: "GBPUSD=X", name: "Sterlin / Dolar", ticker: "GBP/USD", aliases: ["pound dollar", "gbpusd", "cable"] },
    { symbol: "USDJPY=X", name: "Dolar / Yen", ticker: "USD/JPY", currency: "JPY", aliases: ["yen", "japanese yen", "japon yeni", "日元"] },
    { symbol: "USDCHF=X", name: "Dolar / İsviçre Frangı", ticker: "USD/CHF", currency: "CHF", aliases: ["franc", "swiss franc", "frank", "franken"] },
    { symbol: "AUDUSD=X", name: "Avustralya Doları / Dolar", ticker: "AUD/USD", aliases: ["australian dollar", "aussie", "avustralya dolari"] },
    { symbol: "USDCAD=X", name: "Dolar / Kanada Doları", ticker: "USD/CAD", currency: "CAD", aliases: ["canadian dollar", "loonie", "kanada dolari"] },
    {
      symbol: "DX-Y.NYB",
      name: "Dolar Endeksi",
      ticker: "DXY",
      kind: "endeks",
      aliases: ["dollar index", "dxy", "dolar endeksi", "index"],
    },
  ]),
];

/* ────────────────────────── Erişim ────────────────────────── */

const BY_MARKET: Partial<Record<MarketId, Instrument[]>> = {
  abd: US_INSTRUMENTS,
  bist: BIST_INSTRUMENTS,
  emtia: COMMODITY_FX_INSTRUMENTS,
};

/** Kripto dışı piyasaların tanımlı enstrümanları. */
export function staticInstruments(market: MarketId): Instrument[] {
  return BY_MARKET[market] ?? [];
}

export function allStaticInstruments(): Instrument[] {
  return [...US_INSTRUMENTS, ...BIST_INSTRUMENTS, ...COMMODITY_FX_INSTRUMENTS];
}

export function findStaticInstrument(market: MarketId, symbol: string): Instrument | null {
  return staticInstruments(market).find((i) => i.symbol === symbol) ?? null;
}

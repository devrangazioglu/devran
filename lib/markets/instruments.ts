/**
 * Kripto dışındaki piyasaların enstrüman listeleri.
 *
 * Kripto pariteleri sağlayıcıdan dinamik olarak gelir; hisse, endeks, emtia ve
 * döviz enstrümanları burada tanımlıdır. Yeni bir enstrüman eklemek için
 * listeye bir satır yazmak yeterlidir.
 */

import { cryptoInstrument } from "./crypto-symbols";
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

/* ────────────────────────── Dünya borsaları ──────────────────────────
 *
 * Her ülkenin piyasa değerine göre en büyük yerli şirketleri (ölçüm:
 * `scripts/ulke-tara.ts`, 2026-11-16). Almanya ve İngiltere taramasının
 * başını ABD şirketlerinin ikincil kotasyonları (Apple, Nvidia…) tutuyor;
 * onlar bilerek alınmadı — aynı şirket ABD listesinde zaten var ve ikincil
 * kotasyonun hacmi teknik analiz için yanıltıcı derecede düşük.
 * Tercihli ve ikinci sınıf paylar (Samsung Pfd, Kanada "PR" serileri,
 * Hong Kong'un CNY karşı kotasyonları) da alınmadı.
 */

function endeks(symbol: string, name: string, ticker: string, aliases: string[]): Entry {
  return { symbol, name, ticker, kind: "endeks", aliases: [...aliases, "endeks", "index"] };
}

/** Kısa gösterim borsa kodudur: "SAP.DE" → "SAP", "0700.HK" → "0700". */
function hisse(symbol: string, name: string, aliases?: string[]): Entry {
  return { symbol, name, ticker: symbol.replace(/\.[A-Z]+$/, ""), aliases };
}

export const CHINA_INSTRUMENTS: Instrument[] = build("cin", "CNY", "hisse", [
  endeks("000001.SS", "Şanghay Bileşik Endeksi", "SSE", ["shanghai composite", "sse", "cin borsasi", "china"]),
  hisse("600519.SS", "Kweichow Moutai", ["moutai"]),
  hisse("601398.SS", "ICBC (Industrial and Commercial Bank of China)", ["icbc"]),
  hisse("300750.SZ", "CATL (Contemporary Amperex)", ["catl", "batarya", "battery"]),
  hisse("601288.SS", "Agricultural Bank of China"),
  hisse("601939.SS", "China Construction Bank"),
  hisse("601988.SS", "Bank of China"),
  hisse("601857.SS", "PetroChina", ["petrol"]),
  hisse("600941.SS", "China Mobile"),
  hisse("600036.SS", "China Merchants Bank"),
  hisse("601318.SS", "Ping An Insurance", ["ping an"]),
  hisse("601088.SS", "China Shenhua Energy"),
  hisse("600938.SS", "CNOOC"),
  hisse("601628.SS", "China Life Insurance"),
  hisse("601138.SS", "Foxconn Industrial Internet", ["foxconn"]),
  hisse("600900.SS", "China Yangtze Power"),
  hisse("000333.SZ", "Midea Group", ["midea"]),
  hisse("601899.SS", "Zijin Mining", ["zijin"]),
  hisse("002594.SZ", "BYD", ["byd", "elektrikli arac"]),
  hisse("600028.SS", "Sinopec (China Petroleum & Chemical)", ["sinopec"]),
  hisse("688256.SS", "Cambricon Technologies", ["cambricon", "yapay zeka cipi"]),
  hisse("688981.SS", "SMIC (Semiconductor Manufacturing Intl.)", ["smic"]),
  hisse("601728.SS", "China Telecom"),
  hisse("000858.SZ", "Wuliangye Yibin"),
  hisse("603259.SS", "WuXi AppTec"),
  hisse("601166.SS", "Industrial Bank"),
]);

export const JAPAN_INSTRUMENTS: Instrument[] = build("japonya", "JPY", "hisse", [
  endeks("^N225", "Nikkei 225 Endeksi", "Nikkei 225", ["nikkei", "n225", "japonya borsasi", "japan"]),
  hisse("7203.T", "Toyota Motor", ["toyota"]),
  hisse("8306.T", "Mitsubishi UFJ Financial", ["mufg"]),
  hisse("9983.T", "Fast Retailing (Uniqlo)", ["uniqlo"]),
  hisse("6758.T", "Sony Group", ["sony", "playstation"]),
  hisse("8316.T", "Sumitomo Mitsui Financial", ["smfg"]),
  hisse("6098.T", "Recruit Holdings"),
  hisse("6501.T", "Hitachi", ["hitachi"]),
  hisse("8035.T", "Tokyo Electron"),
  hisse("6857.T", "Advantest"),
  hisse("9984.T", "SoftBank Group", ["softbank"]),
  hisse("8411.T", "Mizuho Financial", ["mizuho"]),
  hisse("8001.T", "Itochu"),
  hisse("6861.T", "Keyence"),
  hisse("8058.T", "Mitsubishi Corporation"),
  hisse("8766.T", "Tokio Marine"),
  hisse("9432.T", "NTT"),
  hisse("8031.T", "Mitsui & Co."),
  hisse("4519.T", "Chugai Pharmaceutical"),
  hisse("4063.T", "Shin-Etsu Chemical"),
  hisse("4502.T", "Takeda Pharmaceutical", ["takeda"]),
  hisse("9433.T", "KDDI"),
  hisse("7974.T", "Nintendo", ["nintendo"]),
  hisse("7011.T", "Mitsubishi Heavy Industries"),
  hisse("7267.T", "Honda Motor", ["honda"]),
  hisse("6981.T", "Murata Manufacturing"),
]);

export const HONGKONG_INSTRUMENTS: Instrument[] = build("hongkong", "HKD", "hisse", [
  endeks("^HSI", "Hang Seng Endeksi", "Hang Seng", ["hang seng", "hsi", "hong kong borsasi"]),
  hisse("0700.HK", "Tencent", ["tencent", "wechat"]),
  hisse("9988.HK", "Alibaba Group", ["alibaba"]),
  hisse("1398.HK", "ICBC", ["icbc"]),
  hisse("0005.HK", "HSBC Holdings", ["hsbc"]),
  hisse("0939.HK", "China Construction Bank"),
  hisse("1299.HK", "AIA Group", ["aia"]),
  hisse("0941.HK", "China Mobile"),
  hisse("1810.HK", "Xiaomi", ["xiaomi"]),
  hisse("3690.HK", "Meituan", ["meituan"]),
  hisse("2318.HK", "Ping An Insurance"),
  hisse("3750.HK", "CATL (Contemporary Amperex)", ["catl"]),
  hisse("0388.HK", "Hong Kong Exchanges and Clearing", ["hkex"]),
  hisse("1211.HK", "BYD", ["byd"]),
  hisse("9618.HK", "JD.com", ["jd"]),
  hisse("0883.HK", "CNOOC"),
  hisse("3988.HK", "Bank of China"),
  hisse("0857.HK", "PetroChina"),
  hisse("3968.HK", "China Merchants Bank"),
  hisse("9999.HK", "NetEase", ["netease"]),
  hisse("1024.HK", "Kuaishou"),
  hisse("9888.HK", "Baidu", ["baidu"]),
  hisse("0981.HK", "SMIC", ["smic"]),
  hisse("2020.HK", "Anta Sports"),
  hisse("0016.HK", "Sun Hung Kai Properties"),
  hisse("0001.HK", "CK Hutchison"),
]);

export const INDIA_INSTRUMENTS: Instrument[] = build("hindistan", "INR", "hisse", [
  endeks("^NSEI", "Nifty 50 Endeksi", "Nifty 50", ["nifty", "nse", "hindistan borsasi", "india", "sensex"]),
  hisse("RELIANCE.NS", "Reliance Industries", ["reliance"]),
  hisse("BHARTIARTL.NS", "Bharti Airtel", ["airtel"]),
  hisse("HDFCBANK.NS", "HDFC Bank", ["hdfc"]),
  hisse("ICICIBANK.NS", "ICICI Bank", ["icici"]),
  hisse("SBIN.NS", "State Bank of India", ["sbi"]),
  hisse("TCS.NS", "Tata Consultancy Services", ["tcs", "tata"]),
  hisse("INFY.NS", "Infosys", ["infosys"]),
  hisse("BAJFINANCE.NS", "Bajaj Finance"),
  hisse("LT.NS", "Larsen & Toubro"),
  hisse("LICI.NS", "Life Insurance Corp. of India", ["lic"]),
  hisse("KOTAKBANK.NS", "Kotak Mahindra Bank"),
  hisse("HINDUNILVR.NS", "Hindustan Unilever"),
  hisse("SUNPHARMA.NS", "Sun Pharmaceutical"),
  hisse("ADANIPORTS.NS", "Adani Ports"),
  hisse("TITAN.NS", "Titan Company"),
  hisse("AXISBANK.NS", "Axis Bank"),
  hisse("MARUTI.NS", "Maruti Suzuki", ["suzuki"]),
  hisse("HCLTECH.NS", "HCL Technologies"),
  hisse("ADANIENT.NS", "Adani Enterprises", ["adani"]),
  hisse("ULTRACEMCO.NS", "UltraTech Cement"),
  hisse("ITC.NS", "ITC"),
  hisse("ETERNAL.NS", "Eternal (Zomato)", ["zomato"]),
  hisse("NTPC.NS", "NTPC"),
  hisse("HAL.NS", "Hindustan Aeronautics"),
  hisse("JSWSTEEL.NS", "JSW Steel"),
]);

export const UK_INSTRUMENTS: Instrument[] = build("ingiltere", "GBX", "hisse", [
  endeks("^FTSE", "FTSE 100 Endeksi", "FTSE 100", ["ftse", "footsie", "londra borsasi", "london", "uk"]),
  hisse("AZN.L", "AstraZeneca", ["astrazeneca", "asi"]),
  hisse("HSBA.L", "HSBC Holdings", ["hsbc"]),
  hisse("SHEL.L", "Shell", ["shell", "petrol"]),
  hisse("ULVR.L", "Unilever", ["unilever"]),
  hisse("RIO.L", "Rio Tinto"),
  hisse("REL.L", "RELX"),
  hisse("BATS.L", "British American Tobacco", ["bat"]),
  hisse("GSK.L", "GSK", ["glaxo"]),
  hisse("BP.L", "BP", ["british petroleum"]),
  hisse("LSEG.L", "London Stock Exchange Group"),
  hisse("RR.L", "Rolls-Royce", ["rolls royce", "rolls"]),
  hisse("BARC.L", "Barclays", ["barclays"]),
  hisse("LLOY.L", "Lloyds Banking Group", ["lloyds"]),
  hisse("BA.L", "BAE Systems", ["bae", "savunma"]),
  hisse("NG.L", "National Grid"),
  hisse("DGE.L", "Diageo"),
  hisse("GLEN.L", "Glencore", ["glencore"]),
  hisse("NWG.L", "NatWest Group", ["natwest"]),
  hisse("TSCO.L", "Tesco", ["tesco"]),
  hisse("CPG.L", "Compass Group"),
  hisse("AAL.L", "Anglo American"),
  hisse("STAN.L", "Standard Chartered"),
  hisse("VOD.L", "Vodafone", ["vodafone"]),
  hisse("PRU.L", "Prudential"),
  hisse("EXPN.L", "Experian"),
]);

export const GERMANY_INSTRUMENTS: Instrument[] = build("almanya", "EUR", "hisse", [
  endeks("^GDAXI", "DAX 40 Endeksi", "DAX", ["dax", "frankfurt", "almanya borsasi", "germany"]),
  hisse("SAP.DE", "SAP", ["sap"]),
  hisse("SIE.DE", "Siemens", ["siemens"]),
  hisse("ALV.DE", "Allianz", ["allianz", "sigorta"]),
  hisse("DTE.DE", "Deutsche Telekom", ["telekom"]),
  hisse("RHM.DE", "Rheinmetall", ["rheinmetall", "savunma"]),
  hisse("MUV2.DE", "Münchener Rück (Munich Re)", ["munich re"]),
  hisse("AIR.DE", "Airbus", ["airbus"]),
  hisse("ENR.DE", "Siemens Energy"),
  hisse("DBK.DE", "Deutsche Bank", ["deutsche bank"]),
  hisse("MBG.DE", "Mercedes-Benz Group", ["mercedes"]),
  hisse("BMW.DE", "BMW", ["bmw"]),
  hisse("IFX.DE", "Infineon Technologies", ["infineon", "cip"]),
  hisse("VOW3.DE", "Volkswagen (imtiyazlı)", ["volkswagen", "vw"]),
  hisse("BAS.DE", "BASF", ["basf"]),
  hisse("DB1.DE", "Deutsche Börse"),
  hisse("DHL.DE", "DHL Group", ["dhl", "deutsche post"]),
  hisse("EOAN.DE", "E.ON"),
  hisse("CBK.DE", "Commerzbank"),
  hisse("BAYN.DE", "Bayer", ["bayer"]),
  hisse("ADS.DE", "Adidas", ["adidas"]),
  hisse("RWE.DE", "RWE"),
  hisse("MTX.DE", "MTU Aero Engines"),
  hisse("HEN3.DE", "Henkel (imtiyazlı)"),
  hisse("VNA.DE", "Vonovia"),
  hisse("P911.DE", "Porsche AG", ["porsche"]),
]);

export const FRANCE_INSTRUMENTS: Instrument[] = build("fransa", "EUR", "hisse", [
  endeks("^FCHI", "CAC 40 Endeksi", "CAC 40", ["cac", "paris borsasi", "france"]),
  hisse("OR.PA", "L'Oréal", ["loreal"]),
  hisse("MC.PA", "LVMH", ["lvmh", "louis vuitton"]),
  hisse("TTE.PA", "TotalEnergies", ["total", "petrol"]),
  hisse("AIR.PA", "Airbus", ["airbus"]),
  hisse("SU.PA", "Schneider Electric"),
  hisse("RMS.PA", "Hermès", ["hermes"]),
  hisse("SAF.PA", "Safran"),
  hisse("AI.PA", "Air Liquide"),
  hisse("BNP.PA", "BNP Paribas", ["bnp"]),
  hisse("SAN.PA", "Sanofi", ["sanofi"]),
  hisse("CS.PA", "AXA", ["axa", "sigorta"]),
  hisse("EL.PA", "EssilorLuxottica", ["rayban"]),
  hisse("DG.PA", "Vinci"),
  hisse("ENGI.PA", "Engie"),
  hisse("GLE.PA", "Société Générale"),
  hisse("ACA.PA", "Crédit Agricole"),
  hisse("HO.PA", "Thales", ["thales", "savunma"]),
  hisse("BN.PA", "Danone", ["danone"]),
  hisse("ORA.PA", "Orange"),
  hisse("SGO.PA", "Saint-Gobain"),
  hisse("KER.PA", "Kering", ["gucci"]),
  hisse("RI.PA", "Pernod Ricard"),
  hisse("CAP.PA", "Capgemini"),
  hisse("STLAP.PA", "Stellantis", ["stellantis", "peugeot", "fiat"]),
  hisse("ML.PA", "Michelin", ["michelin"]),
]);

export const CANADA_INSTRUMENTS: Instrument[] = build("kanada", "CAD", "hisse", [
  endeks("^GSPTSE", "S&P/TSX Bileşik Endeksi", "S&P/TSX", ["tsx", "toronto borsasi", "canada"]),
  hisse("RY.TO", "Royal Bank of Canada", ["rbc"]),
  hisse("TD.TO", "Toronto-Dominion Bank", ["td bank"]),
  hisse("SHOP.TO", "Shopify", ["shopify"]),
  hisse("ENB.TO", "Enbridge"),
  hisse("BMO.TO", "Bank of Montreal", ["bmo"]),
  hisse("BN.TO", "Brookfield Corporation", ["brookfield"]),
  hisse("BNS.TO", "Bank of Nova Scotia", ["scotiabank"]),
  hisse("CNQ.TO", "Canadian Natural Resources"),
  hisse("CP.TO", "Canadian Pacific Kansas City"),
  hisse("CNR.TO", "Canadian National Railway"),
  hisse("CM.TO", "CIBC"),
  hisse("AEM.TO", "Agnico Eagle Mines", ["altin madeni"]),
  hisse("TRI.TO", "Thomson Reuters"),
  hisse("SU.TO", "Suncor Energy"),
  hisse("CSU.TO", "Constellation Software"),
  hisse("ABX.TO", "Barrick Mining", ["barrick", "altin"]),
  hisse("MFC.TO", "Manulife Financial"),
  hisse("TRP.TO", "TC Energy"),
  hisse("WCN.TO", "Waste Connections"),
  hisse("ATD.TO", "Alimentation Couche-Tard"),
  hisse("NTR.TO", "Nutrien"),
  hisse("SLF.TO", "Sun Life Financial"),
  hisse("WPM.TO", "Wheaton Precious Metals"),
  hisse("FNV.TO", "Franco-Nevada"),
  hisse("L.TO", "Loblaw"),
]);

export const KOREA_INSTRUMENTS: Instrument[] = build("kore", "KRW", "hisse", [
  endeks("^KS11", "KOSPI Endeksi", "KOSPI", ["kospi", "kore borsasi", "korea"]),
  hisse("005930.KS", "Samsung Electronics", ["samsung"]),
  hisse("000660.KS", "SK hynix", ["hynix", "bellek"]),
  hisse("402340.KS", "SK Square"),
  hisse("373220.KS", "LG Energy Solution", ["lg"]),
  hisse("207940.KS", "Samsung Biologics"),
  hisse("009150.KS", "Samsung Electro-Mechanics"),
  hisse("005380.KS", "Hyundai Motor", ["hyundai"]),
  hisse("105560.KS", "KB Financial Group"),
  hisse("068270.KS", "Celltrion"),
  hisse("032830.KS", "Samsung Life Insurance"),
  hisse("028260.KS", "Samsung C&T"),
  hisse("055550.KS", "Shinhan Financial Group"),
  hisse("006400.KS", "Samsung SDI"),
  hisse("000270.KS", "Kia", ["kia"]),
  hisse("012450.KS", "Hanwha Aerospace", ["hanwha", "savunma"]),
  hisse("086790.KS", "Hana Financial Group"),
  hisse("012330.KS", "Hyundai Mobis"),
  hisse("034020.KS", "Doosan Enerbility"),
  hisse("329180.KS", "HD Hyundai Heavy Industries"),
  hisse("034730.KS", "SK Inc."),
  hisse("035420.KS", "NAVER", ["naver"]),
  hisse("316140.KS", "Woori Financial Group"),
  hisse("005490.KS", "POSCO Holdings", ["posco"]),
  hisse("035720.KS", "Kakao", ["kakao"]),
  hisse("066570.KS", "LG Electronics", ["lg"]),
]);

export const TAIWAN_INSTRUMENTS: Instrument[] = build("tayvan", "TWD", "hisse", [
  endeks("^TWII", "TAIEX Endeksi", "TAIEX", ["taiex", "twii", "tayvan borsasi", "taiwan"]),
  hisse("2330.TW", "TSMC (Taiwan Semiconductor)", ["tsmc", "cip", "chip"]),
  hisse("2454.TW", "MediaTek", ["mediatek"]),
  hisse("2317.TW", "Hon Hai (Foxconn)", ["foxconn", "hon hai"]),
  hisse("2308.TW", "Delta Electronics"),
  hisse("3711.TW", "ASE Technology"),
  hisse("1303.TW", "Nan Ya Plastics"),
  hisse("2881.TW", "Fubon Financial"),
  hisse("2882.TW", "Cathay Financial"),
  hisse("2891.TW", "CTBC Financial"),
  hisse("2383.TW", "Elite Material"),
  hisse("2408.TW", "Nanya Technology"),
  hisse("2412.TW", "Chunghwa Telecom"),
  hisse("2303.TW", "United Microelectronics (UMC)", ["umc"]),
  hisse("3037.TW", "Unimicron"),
  hisse("3017.TW", "Asia Vital Components"),
  hisse("3443.TW", "Global Unichip"),
  hisse("2382.TW", "Quanta Computer"),
  hisse("2885.TW", "Yuanta Financial"),
  hisse("6669.TW", "Wiwynn"),
  hisse("2884.TW", "E.SUN Financial"),
  hisse("2345.TW", "Accton Technology"),
  hisse("2327.TW", "Yageo"),
  hisse("2886.TW", "Mega Financial"),
  hisse("3008.TW", "Largan Precision"),
  hisse("2357.TW", "Asustek Computer", ["asus"]),
]);

export const SAUDI_INSTRUMENTS: Instrument[] = build("suudi", "SAR", "hisse", [
  endeks("^TASI.SR", "Tadawul Genel Endeksi (TASI)", "TASI", ["tasi", "tadawul", "suudi borsasi", "saudi"]),
  hisse("2222.SR", "Saudi Aramco", ["aramco", "petrol"]),
  hisse("1120.SR", "Al Rajhi Bank", ["rajhi"]),
  hisse("1180.SR", "Saudi National Bank", ["snb"]),
  hisse("1211.SR", "Ma'aden (Saudi Arabian Mining)", ["maaden"]),
  hisse("7010.SR", "Saudi Telecom (stc)", ["stc"]),
  hisse("2010.SR", "SABIC", ["sabic"]),
  hisse("2082.SR", "ACWA Power"),
  hisse("1010.SR", "Riyad Bank"),
  hisse("4013.SR", "Dr. Sulaiman Al-Habib Medical"),
  hisse("1060.SR", "Saudi Awwal Bank"),
  hisse("1150.SR", "Alinma Bank"),
  hisse("5110.SR", "Saudi Electricity"),
  hisse("2020.SR", "SABIC Agri-Nutrients"),
  hisse("1050.SR", "Banque Saudi Fransi"),
  hisse("7203.SR", "Elm Company"),
  hisse("4280.SR", "Kingdom Holding"),
  hisse("7020.SR", "Etihad Etisalat (Mobily)", ["mobily"]),
  hisse("2280.SR", "Almarai", ["almarai"]),
  hisse("1080.SR", "Arab National Bank"),
  hisse("4030.SR", "Bahri (National Shipping)"),
  hisse("1140.SR", "Bank Albilad"),
  hisse("7202.SR", "Arabian Internet and Communications (solutions)"),
  hisse("8210.SR", "Bupa Arabia"),
  hisse("4190.SR", "Jarir Marketing"),
  hisse("4300.SR", "Dar Al Arkan"),
]);

/* ────────────────────────── Erişim ────────────────────────── */

const BY_MARKET: Partial<Record<MarketId, Instrument[]>> = {
  abd: US_INSTRUMENTS,
  bist: BIST_INSTRUMENTS,
  emtia: COMMODITY_FX_INSTRUMENTS,
  cin: CHINA_INSTRUMENTS,
  japonya: JAPAN_INSTRUMENTS,
  hongkong: HONGKONG_INSTRUMENTS,
  hindistan: INDIA_INSTRUMENTS,
  ingiltere: UK_INSTRUMENTS,
  almanya: GERMANY_INSTRUMENTS,
  fransa: FRANCE_INSTRUMENTS,
  kanada: CANADA_INSTRUMENTS,
  kore: KOREA_INSTRUMENTS,
  tayvan: TAIWAN_INSTRUMENTS,
  suudi: SAUDI_INSTRUMENTS,
};

/** Kripto dışı piyasaların tanımlı enstrümanları. */
export function staticInstruments(market: MarketId): Instrument[] {
  return BY_MARKET[market] ?? [];
}

export function allStaticInstruments(): Instrument[] {
  return Object.values(BY_MARKET).flat();
}

export function findStaticInstrument(market: MarketId, symbol: string): Instrument | null {
  return staticInstruments(market).find((i) => i.symbol === symbol) ?? null;
}

/**
 * Kullanıcıya gösterilecek kısa ad.
 *
 * Sağlayıcı sembolleri okunur değildir ("GC=F", "THYAO.IS", "BTCUSDT"), bu yüzden
 * tanımlı enstrümanlarda gerçek kısa ad ("XAU", "THYAO"), kriptoda parite biçimi
 * ("BTC/USDT"), tanımsız sembollerde ise sağlayıcı sonekleri atılmış hâli kullanılır.
 */
export function displayTicker(market: MarketId, symbol: string): string {
  if (market === "kripto") return cryptoInstrument(symbol).ticker;
  const bilinen = findStaticInstrument(market, symbol)?.ticker;
  if (bilinen) return bilinen;
  // ABD'de nokta sınıf harfidir ("BRK.B"), borsa soneki değil; atılmaz.
  if (market === "abd") return symbol;
  return symbol.replace(/\.[A-Z]{1,2}$|=X$|=F$/, "");
}

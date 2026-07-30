/**
 * Tanı ucu: veri sağlayıcının BU SUNUCUDAN ne döndürdüğünü gösterir.
 *
 * Yerelde çalışan bir geliştirici sağlayıcıya rahatça ulaşır; sorun genelde
 * bulut sağlayıcısının IP aralığından yapılan isteklerde çıkar. Hangi uç
 * noktanın çalıştığını tahmin etmek yerine ölçmek için bu uç nokta her adayı
 * tek tek dener ve sonucu ham hâliyle bildirir.
 *
 * Gizli bilgi döndürmez: yalnızca herkese açık uç noktaların durum kodları,
 * süreleri ve yanıt başlangıçları.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

type Deneme = {
  ad: string;
  url: string;
  durum: number | string;
  ms: number;
  boyut: number;
  bas: string;
};

/**
 * Anahtarlı bir denemede adres gizlenir: yanıt herkese açık bir sayfada
 * gösterildiği için API anahtarı asla dışarı sızmamalı.
 */
async function dene(ad: string, url: string, gorunenUrl?: string): Promise<Deneme> {
  const basladi = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "*/*", "user-agent": UA },
      cache: "no-store",
    });
    clearTimeout(timer);
    const text = await response.text();
    return {
      ad,
      url: gorunenUrl ?? url,
      durum: response.status,
      ms: Date.now() - basladi,
      boyut: text.length,
      bas: text.slice(0, 180).replace(/\s+/g, " "),
    };
  } catch (error) {
    return {
      ad,
      url: gorunenUrl ?? url,
      durum: "ağ hatası",
      ms: Date.now() - basladi,
      boyut: 0,
      bas: error instanceof Error ? error.message : "bilinmeyen",
    };
  }
}

export async function GET(request: Request) {
  const adaylar: [string, string][] = [
    // Şu an kullanılan yol
    ["yahoo-chart-AAPL", "https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=1mo"],
    ["yahoo-chart-q2", "https://query2.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=1mo"],
    ["yahoo-spark", "https://query1.finance.yahoo.com/v8/finance/spark?symbols=AAPL,MSFT&range=1d&interval=5m"],
    ["yahoo-chart-THYAO", "https://query1.finance.yahoo.com/v8/finance/chart/THYAO.IS?interval=1d&range=1mo"],
    ["yahoo-chart-altin", "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=1mo"],

    // Birincil kaynak — uygulamanın kullandığı adreslerin birebir aynısı
    [
      "stooq-toplu-fiyat",
      "https://stooq.com/q/l/?s=aapl.us+msft.us+xauusd+usdtry+thyao.tr&f=sd2t2ohlcv&h&e=csv",
    ],
    ["stooq-mum-AAPL", "https://stooq.com/q/d/l/?s=aapl.us&i=d"],
    ["stooq-mum-altin", "https://stooq.com/q/d/l/?s=xauusd&i=d"],
    ["stooq-mum-usdtry", "https://stooq.com/q/d/l/?s=usdtry&i=d"],
    ["stooq-mum-THYAO", "https://stooq.com/q/d/l/?s=thyao.tr&i=d"],
    // BIST için yedek sembol biçimleri (hangisinin veri döndüğünü görmek için)
    ["stooq-THYAO-alt1", "https://stooq.com/q/d/l/?s=thyao&i=d"],
    ["stooq-THYAO-alt2", "https://stooq.com/q/d/l/?s=thyao.is&i=d"],

    // Stooq'un başka kapıları (aynı veri, farklı adres/alan adı)
    ["stooq-pl", "https://stooq.pl/q/d/l/?s=aapl.us&i=d"],
    ["stooq-toplu-duz", "https://stooq.com/q/l/?s=aapl.us&f=sd2t2ohlcv&h&e=csv"],

    // Anahtar isteyen sağlayıcıların DEMO anahtarları: bu sunucudan
    // erişilebiliyor mu, onu ölçer. 200 dönen bir satır "ücretsiz anahtar
    // alırsak çalışır" demektir.
    [
      "twelvedata-demo",
      "https://api.twelvedata.com/time_series?symbol=AAPL&interval=1day&outputsize=30&apikey=demo",
    ],
    [
      "alphavantage-demo",
      "https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=IBM&apikey=demo",
    ],
    ["finnhub-anahtarsiz", "https://finnhub.io/api/v1/quote?symbol=AAPL"],

    // Döviz için anahtarsız ve bulut dostu bir kaynak (Avrupa Merkez Bankası)
    ["frankfurter-fx", "https://api.frankfurter.app/latest?from=USD&to=TRY"],

    // Karşılaştırma için: kripto tarafı (çalıştığı biliniyor)
    ["binance-BTC", "https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT"],
  ];

  const sonuclar: Deneme[] = [];
  for (const [ad, url] of adaylar) {
    sonuclar.push(await dene(ad, url));
  }

  // Gerçek anahtarla tek bir deneme: "kota doldu" mesajının dakikalık mı yoksa
  // günlük sınırdan mı geldiğini yalnızca sağlayıcının kendi cümlesi söyler.
  // Bir kredi harcadığı için isteğe bağlıdır: /api/tani?gercek=1
  const anahtar = process.env.TWELVEDATA_API_KEY?.trim();
  if (new URL(request.url).searchParams.get("gercek") === "1" && anahtar) {
    sonuclar.push(
      await dene(
        "twelvedata-GERCEK-ANAHTAR",
        `https://api.twelvedata.com/time_series?symbol=AAPL&interval=1day&outputsize=5&apikey=${encodeURIComponent(anahtar)}`,
        "https://api.twelvedata.com/time_series?symbol=AAPL&…&apikey=(gizli)",
      ),
    );
  }

  return NextResponse.json(
    {
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "(yerel)",
      dal: process.env.VERCEL_GIT_COMMIT_REF ?? "(yerel)",
      bolge: process.env.VERCEL_REGION ?? "(yerel)",
      demoVeri: process.env.DEMO_DATA === "1",
      sonuclar,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

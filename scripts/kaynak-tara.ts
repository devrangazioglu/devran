/**
 * Ücretsiz veri kaynaklarını ölçer.
 *
 * Hangi kaynağın "ücretsiz ve sınırsız" olduğu belgelerden okunarak
 * anlaşılmıyor: asıl soru, **isteği atan makinenin** engellenip
 * engellenmediği. Ölçüldü (GitHub çalıştırıcısı, 2026-11-16):
 *
 *   • Yahoo (query1 ve query2) → HTTP 429, her sembolde
 *   • Stooq                    → HTTP 403, CSV yerine engel sayfası
 *   • Binance                  → HTTP 451 (çalıştırıcı ABD'de)
 *   • gold-api, Frankfurter    → çalışıyor
 *
 * Yani Yahoo/Stooq yalnızca Vercel'i değil GitHub'ı da engelliyor; "başka bir
 * makineden çekelim" yaklaşımı bu iki kaynak için kapalı. Bu betik kalan
 * adayları aynı yöntemle dener: tahmin değil, ham sonuç.
 *
 * Çalıştırma (veritabanı ve anahtar gerektirmez):
 *   npm run kaynak-tara
 *
 * Actions → "Veri kaynağı testi" → Run workflow ile de çalışır; oradaki
 * çıktı, siteyi besleyecek makinenin gerçek görüşüdür.
 */

type Sonuc = {
  kaynak: string;
  piyasa: string;
  durum: string;
  sure: number;
  ozet: string;
  ok: boolean;
};

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const sonuclar: Sonuc[] = [];

async function dene(
  kaynak: string,
  piyasa: string,
  url: string,
  coz: (govde: string, yanit: Response) => string,
  ayar: { baslik?: Record<string, string>; govde?: unknown } = {},
): Promise<void> {
  const basladi = Date.now();
  try {
    const yanit = await fetch(url, {
      method: ayar.govde === undefined ? "GET" : "POST",
      headers: {
        "user-agent": UA,
        accept: "*/*",
        ...(ayar.govde === undefined ? {} : { "content-type": "application/json" }),
        ...(ayar.baslik ?? {}),
      },
      body: ayar.govde === undefined ? undefined : JSON.stringify(ayar.govde),
      signal: AbortSignal.timeout(20_000),
    });
    const govde = await yanit.text();
    const sure = Date.now() - basladi;

    if (!yanit.ok) {
      sonuclar.push({
        kaynak,
        piyasa,
        durum: `HTTP ${yanit.status}`,
        sure,
        ozet: govde.slice(0, 120).replace(/\s+/g, " "),
        ok: false,
      });
      return;
    }

    let ozet: string;
    try {
      ozet = coz(govde, yanit);
    } catch (error) {
      sonuclar.push({
        kaynak,
        piyasa,
        durum: `HTTP ${yanit.status}`,
        sure,
        ozet: `ayrıştırılamadı: ${error instanceof Error ? error.message : String(error)} · ${govde
          .slice(0, 90)
          .replace(/\s+/g, " ")}`,
        ok: false,
      });
      return;
    }

    sonuclar.push({ kaynak, piyasa, durum: `HTTP ${yanit.status}`, sure, ozet, ok: true });
  } catch (error) {
    sonuclar.push({
      kaynak,
      piyasa,
      durum: "bağlanamadı",
      sure: Date.now() - basladi,
      ozet: error instanceof Error ? error.message : String(error),
      ok: false,
    });
  }
}

/* ────────────────────── Çözücüler ────────────────────── */

function yahooChart(govde: string): string {
  const veri = JSON.parse(govde) as {
    chart?: {
      result?: {
        meta?: { regularMarketPrice?: number; currency?: string; exchangeName?: string };
        timestamp?: number[];
        indicators?: { quote?: { close?: (number | null)[] }[] };
      }[];
      error?: { description?: string } | null;
    };
  };
  const sonuc = veri.chart?.result?.[0];
  if (!sonuc) throw new Error(veri.chart?.error?.description ?? "boş sonuç");
  const kapanislar = (sonuc.indicators?.quote?.[0]?.close ?? []).filter(
    (v): v is number => typeof v === "number",
  );
  const zaman = sonuc.timestamp?.[sonuc.timestamp.length - 1];
  const yas = zaman ? Math.round((Date.now() / 1000 - zaman) / 60) : null;
  return [
    `${kapanislar.length} mum`,
    `son ${kapanislar[kapanislar.length - 1]?.toFixed(2) ?? "—"} ${sonuc.meta?.currency ?? ""}`,
    yas === null ? "" : `${yas} dk önce`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function stooqCsv(govde: string): string {
  const satirlar = govde.trim().split("\n");
  if (!satirlar[0]?.toLowerCase().startsWith("date")) {
    throw new Error(`CSV değil: ${satirlar[0]?.slice(0, 60)}`);
  }
  const son = satirlar[satirlar.length - 1].split(",");
  return `${satirlar.length - 1} satır · son ${son[0]} kapanış ${son[4]}`;
}

/** TradingView tarayıcısı: tek istekte yüzlerce sembol. */
function tradingview(govde: string): string {
  const veri = JSON.parse(govde) as { totalCount?: number; data?: { s: string; d: unknown[] }[] };
  const satirlar = veri.data ?? [];
  if (satirlar.length === 0) throw new Error("boş data dizisi");
  return `${veri.totalCount ?? satirlar.length} sembol · ilk ${satirlar[0].s} = ${JSON.stringify(
    satirlar[0].d,
  ).slice(0, 90)}`;
}

function jsonOzet(alanlar: string[]) {
  return (govde: string): string => {
    const veri = JSON.parse(govde) as Record<string, unknown>;
    return alanlar
      .map((alan) => {
        const deger = alan
          .split(".")
          .reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], veri);
        return `${alan}=${JSON.stringify(deger)}`;
      })
      .join(" · ")
      .slice(0, 200);
  };
}

/** Gövdenin ilk satırlarını özetler (biçimi bilinmeyen kaynaklar için). */
function hamOzet(govde: string): string {
  const temiz = govde.replace(/\s+/g, " ").trim();
  return `${govde.length} bayt · ${temiz.slice(0, 150)}`;
}

/* ────────────────────── Adaylar ────────────────────── */

const bugun = new Date();
const gun = (t: Date) =>
  `${String(t.getDate()).padStart(2, "0")}-${String(t.getMonth() + 1).padStart(2, "0")}-${t.getFullYear()}`;

async function tara(): Promise<void> {
  console.log("Ücretsiz veri kaynakları ölçülüyor…\n");

  /* ── 1) Doğrudan erişim: engelleniyor mu? (kıyas için birer örnek) ── */
  await dene(
    "yahoo doğrudan",
    "abd",
    "https://query1.finance.yahoo.com/v8/finance/chart/AAPL?range=5d&interval=15m",
    yahooChart,
  );
  await dene("stooq doğrudan", "abd", "https://stooq.com/q/d/l/?s=aapl.us&i=d", stooqCsv);

  /* ── 2) TradingView tarayıcısı: tek istekte tüm piyasa ── */
  const tvAlanlar = ["name", "close", "change", "volume", "market_cap_basic"];
  for (const [piyasa, bolge, borsa] of [
    ["bist", "turkey", "BIST"],
    ["abd", "america", "NASDAQ"],
  ] as const) {
    await dene(
      "tradingview",
      piyasa,
      `https://scanner.tradingview.com/${bolge}/scan`,
      tradingview,
      {
        govde: {
          filter: [{ left: "exchange", operation: "equal", right: borsa }],
          options: { lang: "tr" },
          columns: tvAlanlar,
          range: [0, 5],
        },
        baslik: { origin: "https://www.tradingview.com", referer: "https://www.tradingview.com/" },
      },
    );
  }

  /* ── 3) Türkiye: yerli uç noktalar ── */
  await dene(
    "bigpara",
    "bist",
    "https://api.bigpara.hurriyet.com.tr/borsa/hisseyuzeysel",
    (govde) => {
      const veri = JSON.parse(govde) as { data?: Record<string, unknown>[] };
      const liste = veri.data ?? [];
      if (liste.length === 0) throw new Error("boş data");
      return `${liste.length} hisse · ilk ${JSON.stringify(liste[0]).slice(0, 110)}`;
    },
    { baslik: { referer: "https://bigpara.hurriyet.com.tr/" } },
  );

  await dene(
    "genelpara borsa",
    "bist",
    "https://api.genelpara.com/embed/borsa.json",
    (govde) => {
      const veri = JSON.parse(govde) as Record<string, unknown>;
      const anahtarlar = Object.keys(veri);
      return `${anahtarlar.length} kalem · ${anahtarlar.slice(0, 6).join(", ")} · ${JSON.stringify(
        veri[anahtarlar[0]],
      ).slice(0, 80)}`;
    },
  );

  await dene(
    "genelpara döviz",
    "doviz",
    "https://api.genelpara.com/embed/doviz.json",
    jsonOzet(["USD", "EUR"]),
  );
  await dene(
    "genelpara altın",
    "emtia",
    "https://api.genelpara.com/embed/altin.json",
    jsonOzet(["GA", "C"]),
  );

  await dene(
    "truncgil",
    "emtia",
    "https://finans.truncgil.com/today.json",
    (govde) => {
      const veri = JSON.parse(govde) as Record<string, unknown>;
      const anahtarlar = Object.keys(veri);
      return `${anahtarlar.length} kalem · ${anahtarlar.slice(0, 8).join(", ")}`;
    },
  );

  // İş Yatırım: önceki denemede 401 geldi; tarayıcı başlıklarıyla yeniden.
  await dene(
    "isyatirim",
    "bist",
    "https://www.isyatirim.com.tr/_layouts/15/IsYatirim.Website/Common/Data.aspx/HisseTekilSorgu" +
      `?hisse=THYAO&startdate=${gun(new Date(bugun.getTime() - 30 * 86_400_000))}&enddate=${gun(bugun)}`,
    hamOzet,
    {
      baslik: {
        referer: "https://www.isyatirim.com.tr/tr-tr/analiz/hisse/Sayfalar/default.aspx",
        "x-requested-with": "XMLHttpRequest",
        accept: "application/json, text/javascript, */*; q=0.01",
      },
    },
  );

  /* ── 4) Engeli aşan aracılar: istek başka bir makineden gidiyor ── */
  await dene(
    "r.jina.ai → yahoo",
    "abd",
    "https://r.jina.ai/https://query1.finance.yahoo.com/v8/finance/chart/AAPL?range=5d&interval=15m",
    hamOzet,
  );
  await dene(
    "allorigins → yahoo",
    "bist",
    "https://api.allorigins.win/raw?url=" +
      encodeURIComponent(
        "https://query1.finance.yahoo.com/v8/finance/chart/THYAO.IS?range=1mo&interval=1d",
      ),
    yahooChart,
  );
  await dene(
    "codetabs → yahoo",
    "emtia",
    "https://api.codetabs.com/v1/proxy?quest=" +
      encodeURIComponent(
        "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=1mo&interval=1d",
      ),
    yahooChart,
  );

  /* ── 5) Anahtarsız metal/döviz (kıyas: bunlar çalışıyordu) ── */
  await dene(
    "gold-api",
    "emtia",
    "https://api.gold-api.com/price/XAU",
    jsonOzet(["name", "price", "updatedAt"]),
  );
  await dene(
    "frankfurter",
    "doviz",
    "https://api.frankfurter.app/latest?from=USD&to=TRY",
    jsonOzet(["date", "rates.TRY"]),
  );

  /* ────────────────────── Rapor ────────────────────── */

  console.log(
    `${"kaynak".padEnd(20)}${"piyasa".padEnd(8)}${"durum".padEnd(14)}${"süre".padEnd(8)}özet`,
  );
  console.log("─".repeat(120));
  for (const s of sonuclar) {
    console.log(
      `${(s.ok ? "✓ " : "✗ ") + s.kaynak.padEnd(18)}${s.piyasa.padEnd(8)}${s.durum.padEnd(14)}${String(
        s.sure + "ms",
      ).padEnd(8)}${s.ozet}`,
    );
  }

  const calisan = sonuclar.filter((s) => s.ok);
  console.log(`\n${calisan.length}/${sonuclar.length} istek başarılı.`);
  const isimler = [...new Set(calisan.map((s) => s.kaynak))];
  console.log(`Çalışan kaynaklar: ${isimler.length > 0 ? isimler.join(", ") : "yok"}`);
}

tara().catch((error) => {
  console.error(error);
  process.exit(1);
});

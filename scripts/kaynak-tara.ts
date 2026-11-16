/**
 * Ücretsiz veri kaynaklarını ölçer.
 *
 * Hangi kaynağın "ücretsiz ve sınırsız" olduğu belgelerden okunarak
 * anlaşılmıyor: asıl soru, **isteği atan makinenin** engellenip
 * engellenmediği. GitHub çalıştırıcısından ölçüldü (2026-11-16):
 *
 *   ✗ Yahoo doğrudan (query1/query2) → HTTP 429, her sembolde
 *   ✗ Stooq doğrudan                 → HTTP 403 / bağlantı düşüyor
 *   ✗ genelpara, bigpara, isyatirim  → Cloudflare 403 / 404 / 401
 *   ✗ Binance                        → HTTP 451 (çalıştırıcı ABD'de)
 *   ✓ TradingView tarayıcısı         → tek istekte 649 BIST, 5012 ABD sembolü
 *   ✓ Yahoo + açık aracı (allorigins, r.jina.ai) → tam geçmiş, gün içi dahil
 *   ✓ gold-api, truncgil, Frankfurter → metal ve kur
 *
 * Yani Yahoo'yu engelleyen şey isteğin **nereden** geldiği; araya açık bir
 * aktarıcı koyulunca aynı veri geliyor. Bu betik o aktarıcıların sınırlarını
 * ölçer: büyük gövde kalkıyor mu, art arda istekte hız sınırı var mı.
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
  ayar: { baslik?: Record<string, string>; govde?: unknown; sessiz?: boolean } = {},
): Promise<Sonuc> {
  const basladi = Date.now();
  let sonuc: Sonuc;
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
      signal: AbortSignal.timeout(25_000),
    });
    const govde = await yanit.text();
    const sure = Date.now() - basladi;

    if (!yanit.ok) {
      sonuc = {
        kaynak,
        piyasa,
        durum: `HTTP ${yanit.status}`,
        sure,
        ozet: govde.slice(0, 110).replace(/\s+/g, " "),
        ok: false,
      };
    } else {
      try {
        sonuc = { kaynak, piyasa, durum: `HTTP ${yanit.status}`, sure, ozet: coz(govde, yanit), ok: true };
      } catch (error) {
        sonuc = {
          kaynak,
          piyasa,
          durum: `HTTP ${yanit.status}`,
          sure,
          ozet: `ayrıştırılamadı: ${error instanceof Error ? error.message : String(error)} · ${govde
            .slice(0, 80)
            .replace(/\s+/g, " ")}`,
          ok: false,
        };
      }
    }
  } catch (error) {
    sonuc = {
      kaynak,
      piyasa,
      durum: "bağlanamadı",
      sure: Date.now() - basladi,
      ozet: error instanceof Error ? error.message : String(error),
      ok: false,
    };
  }

  if (!ayar.sessiz) sonuclar.push(sonuc);
  return sonuc;
}

/* ────────────────────── Çözücüler ────────────────────── */

function yahooChart(govde: string): string {
  const veri = JSON.parse(govde) as {
    chart?: {
      result?: {
        meta?: { currency?: string; exchangeName?: string };
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
  if (kapanislar.length === 0) throw new Error("mum yok");
  const zaman = sonuc.timestamp?.[sonuc.timestamp.length - 1];
  const yas = zaman ? Math.round((Date.now() / 1000 - zaman) / 60) : null;
  return [
    `${kapanislar.length} mum`,
    `son ${kapanislar[kapanislar.length - 1]?.toFixed(2)} ${sonuc.meta?.currency ?? ""}`,
    yas === null ? "" : `${yas} dk önce`,
    `${Math.round(govde.length / 1024)} KB`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function tradingview(govde: string): string {
  const veri = JSON.parse(govde) as { totalCount?: number; data?: { s: string; d: unknown[] }[] };
  const satirlar = veri.data ?? [];
  if (satirlar.length === 0) throw new Error("boş data dizisi");
  return `${veri.totalCount ?? satirlar.length} sembol · ${satirlar[0].s} = ${JSON.stringify(
    satirlar[0].d,
  ).slice(0, 80)}`;
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
      .slice(0, 180);
  };
}

/* ────────────────────── Aracılar ────────────────────── */

/** Yahoo isteğini bir aktarıcı üzerinden geçiren adresler. */
const ARACILAR: { ad: string; sar: (url: string) => string; ham: boolean }[] = [
  { ad: "allorigins", sar: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`, ham: true },
  { ad: "corsproxy.io", sar: (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`, ham: true },
  { ad: "cors.lol", sar: (u) => `https://api.cors.lol/?url=${encodeURIComponent(u)}`, ham: true },
  { ad: "thingproxy", sar: (u) => `https://thingproxy.freeboard.io/fetch/${u}`, ham: true },
  { ad: "r.jina.ai", sar: (u) => `https://r.jina.ai/${u}`, ham: false },
];

const yahooUrl = (sembol: string, aralik: string, adim: string) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    sembol,
  )}?range=${aralik}&interval=${adim}`;

async function tara(): Promise<void> {
  console.log("Ücretsiz veri kaynakları ölçülüyor…\n");

  /* ── 1) Aracılar: hangisi ayakta, büyük gövdeyi kaldırıyor mu? ── */
  for (const aracı of ARACILAR) {
    // Küçük istek: 1 aylık günlük mum.
    await dene(
      `${aracı.ad} küçük`,
      "bist",
      aracı.sar(yahooUrl("THYAO.IS", "1mo", "1d")),
      aracı.ham ? yahooChart : (g) => `${Math.round(g.length / 1024)} KB · ${g.slice(0, 60).replace(/\s+/g, " ")}`,
    );
    // Büyük istek: 300 mumluk gün içi seri — analizin gerçekte istediği boyut.
    await dene(
      `${aracı.ad} büyük`,
      "abd",
      aracı.sar(yahooUrl("AAPL", "1mo", "15m")),
      aracı.ham ? yahooChart : (g) => `${Math.round(g.length / 1024)} KB`,
    );
  }

  /* ── 2) Ayakta kalan aracıda hız sınırı: 8 istek art arda ── */
  const calisanAraci = ARACILAR.find((a) =>
    sonuclar.some((s) => s.ok && s.kaynak.startsWith(a.ad)),
  );
  if (calisanAraci) {
    const semboller = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "NFLX"];
    let basarili = 0;
    let ilkHata = "";
    const basladi = Date.now();
    for (const sembol of semboller) {
      const s = await dene(
        "hız sınırı",
        "abd",
        calisanAraci.sar(yahooUrl(sembol, "5d", "1d")),
        yahooChart,
        { sessiz: true },
      );
      if (s.ok) basarili++;
      else if (!ilkHata) ilkHata = `${sembol}: ${s.durum} ${s.ozet.slice(0, 60)}`;
    }
    sonuclar.push({
      kaynak: `${calisanAraci.ad} ×8`,
      piyasa: "abd",
      durum: `${basarili}/8`,
      sure: Date.now() - basladi,
      ozet: basarili === semboller.length ? "art arda sekiz istek geçti" : `ilk hata — ${ilkHata}`,
      ok: basarili === semboller.length,
    });
  }

  /* ── 3) TradingView tarayıcısı: tek istekte tüm piyasa ── */
  for (const [piyasa, bolge, borsa] of [
    ["bist", "turkey", "BIST"],
    ["abd", "america", "NASDAQ"],
    ["abd-nyse", "america", "NYSE"],
  ] as const) {
    await dene("tradingview", piyasa, `https://scanner.tradingview.com/${bolge}/scan`, tradingview, {
      govde: {
        filter: [{ left: "exchange", operation: "equal", right: borsa }],
        options: { lang: "tr" },
        columns: ["name", "description", "close", "change", "volume", "market_cap_basic"],
        sort: { sortBy: "market_cap_basic", sortOrder: "desc" },
        range: [0, 3],
      },
      baslik: { origin: "https://www.tradingview.com", referer: "https://www.tradingview.com/" },
    });
  }

  /* ── 4) Anahtarsız metal/kur ── */
  for (const metal of ["XAU", "XAG"]) {
    await dene(
      `gold-api ${metal}`,
      "emtia",
      `https://api.gold-api.com/price/${metal}`,
      jsonOzet(["name", "price", "updatedAt"]),
    );
  }
  await dene(
    "truncgil",
    "doviz",
    "https://finans.truncgil.com/today.json",
    (govde) => {
      const veri = JSON.parse(govde) as Record<string, unknown>;
      return `${Object.keys(veri).length} kalem · USD=${JSON.stringify(veri["USD"])}`.slice(0, 180);
    },
  );
  await dene(
    "frankfurter",
    "doviz",
    "https://api.frankfurter.app/latest?from=USD&to=TRY",
    jsonOzet(["date", "rates.TRY"]),
  );

  /* ────────────────────── Rapor ────────────────────── */

  console.log(
    `${"kaynak".padEnd(22)}${"piyasa".padEnd(10)}${"durum".padEnd(14)}${"süre".padEnd(9)}özet`,
  );
  console.log("─".repeat(125));
  for (const s of sonuclar) {
    console.log(
      `${(s.ok ? "✓ " : "✗ ") + s.kaynak.padEnd(20)}${s.piyasa.padEnd(10)}${s.durum.padEnd(14)}${String(
        s.sure + "ms",
      ).padEnd(9)}${s.ozet}`,
    );
  }

  const calisan = sonuclar.filter((s) => s.ok);
  console.log(`\n${calisan.length}/${sonuclar.length} istek başarılı.`);
  const isimler = [...new Set(calisan.map((s) => s.kaynak))];
  console.log(`Çalışan: ${isimler.length > 0 ? isimler.join(", ") : "yok"}`);
}

tara().catch((error) => {
  console.error(error);
  process.exit(1);
});

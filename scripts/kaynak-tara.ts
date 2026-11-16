/**
 * Ücretsiz veri kaynaklarını ölçer.
 *
 * Hangi kaynağın "ücretsiz ve sınırsız" olduğu belgelerden okunarak
 * anlaşılmıyor: asıl soru, **isteği atan makinenin** engellenip
 * engellenmediği. GitHub çalıştırıcısından ölçüldü (2026-11-16):
 *
 *   ✗ Yahoo doğrudan (query1/query2) → HTTP 429, her sembolde
 *   ✗ Stooq, genelpara, bigpara, isyatirim → 403 / 404 / 401
 *   ✗ Binance → HTTP 451 (çalıştırıcı ABD'de)
 *   ✓ TradingView tarayıcısı → tek istekte 649 BIST / 5012 NASDAQ / 2716 NYSE
 *     gecikme: hisse 15 dk (delayed_streaming_900), vadeli 10 dk (…_600)
 *     endeksler tarayıcıda yok (type=index → 0 satır)
 *   ✓ Yahoo + r.jina.ai aktarıcısı → 10/10 ardışık istek, sembol başına 373 ms
 *   ~ allorigins → üçüncü turda çalıştı, dördüncüde HTTP 522: yedek
 *   ✗ corsproxy.io, cors.lol, thingproxy, corsfix, cors.workers.dev, codetabs
 *   ✓ gold-api → altın/gümüş/platin/paladyum, saniyesi saniyesine güncel
 *   ✓ truncgil → TRY kurları, "Değişim" alanı da var
 *   ~ frankfurter → ECB günlük: hafta sonu üç gün eski veri veriyor
 *
 * Altıncı tur: döviz ve endeksler de tarayıcıdan gelebilir mi, bütün emtia
 * tek istekte alınabilir mi.
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

const TV_BASLIK = {
  origin: "https://www.tradingview.com",
  referer: "https://www.tradingview.com/",
};

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

/** Tarayıcı yanıtını özetler; `göster` kaç satır yazılacağını söyler. */
function tradingview(goster = 1) {
  return (govde: string): string => {
    const veri = JSON.parse(govde) as { totalCount?: number; data?: { s: string; d: unknown[] }[] };
    const satirlar = veri.data ?? [];
    if (satirlar.length === 0) throw new Error("boş data dizisi");
    const ornekler = satirlar
      .slice(0, goster)
      .map((s) => `${s.s}=${JSON.stringify(s.d)}`)
      .join(" · ");
    return `${veri.totalCount ?? satirlar.length} sembol · ${ornekler}`.slice(0, 320);
  };
}

/** Belirtilen alanları yazdırır; alan adı değişmişse hemen görülür. */
function jsonOzet(alanlar: string[]) {
  return (govde: string): string => {
    const veri = JSON.parse(govde) as Record<string, unknown>;
    const eksik = alanlar.filter((a) => veri[a] === undefined);
    if (eksik.length > 0) throw new Error(`alan yok: ${eksik.join(", ")}`);
    return alanlar.map((a) => `${a}=${JSON.stringify(veri[a])}`).join(" ");
  };
}

/**
 * Yedinci tur: temel analiz verisi.
 *
 * Soru: aynı tarayıcı bilanço oranlarını da veriyor mu? Veriyorsa temel analiz
 * (değerleme, kârlılık, büyüme, borçluluk) anahtarsız yapılabilir; vermiyorsa
 * yapılamaz ve yapılıyormuş gibi gösterilmemeli. Alanlar tek tek denenir,
 * çünkü bilinmeyen tek bir alan bütün isteği düşürüyor.
 */
const TEMEL_ALANLAR = [
  "sector",
  "industry",
  "market_cap_basic",
  "price_earnings_ttm",
  "price_book_fq",
  "price_book_ratio",
  "price_sales_current",
  "price_sales_ratio",
  "price_free_cash_flow_ttm",
  "enterprise_value_ebitda_ttm",
  "earnings_per_share_diluted_ttm",
  "earnings_per_share_diluted_yoy_growth_ttm",
  "total_revenue_ttm",
  "total_revenue_yoy_growth_ttm",
  "net_income_yoy_growth_ttm",
  "return_on_equity",
  "return_on_equity_fq",
  "return_on_assets",
  "return_on_invested_capital",
  "gross_margin",
  "gross_margin_ttm",
  "operating_margin",
  "operating_margin_ttm",
  "net_margin",
  "net_margin_ttm",
  "after_tax_margin",
  "debt_to_equity",
  "debt_to_equity_fq",
  "current_ratio",
  "current_ratio_fq",
  "quick_ratio",
  "dividend_yield_recent",
  "dividends_yield_current",
  "dividends_yield",
  "beta_1_year",
  "Perf.W",
  "Perf.1M",
  "Perf.3M",
  "Perf.6M",
  "Perf.Y",
  "price_52_week_high",
  "price_52_week_low",
  "Recommend.All",
  "recommendation_mark",
  "price_target_average",
  "fundamental_currency_code",
  "fiscal_period_current",
  "earnings_release_date",
];

async function tara(): Promise<void> {
  console.log("Temel analiz alanları ölçülüyor…\n");

  const semboller = ["BIST:THYAO", "BIST:GARAN", "NASDAQ:AAPL"];
  const gecen = new Set<string>();
  const tablo: Record<string, Record<string, unknown>> = {};

  for (const alan of TEMEL_ALANLAR) {
    tablo[alan] = {};
    for (const sembol of semboller) {
      const s = await dene(
        `alan ${alan}`,
        sembol,
        `https://scanner.tradingview.com/symbol?symbol=${encodeURIComponent(sembol)}&fields=${encodeURIComponent(alan)}`,
        (govde) => {
          const veri = JSON.parse(govde) as Record<string, unknown>;
          tablo[alan][sembol] = veri[alan];
          return JSON.stringify(veri[alan]);
        },
        { baslik: TV_BASLIK, sessiz: true },
      );
      if (s.ok && tablo[alan][sembol] !== undefined && tablo[alan][sembol] !== null) gecen.add(alan);
      if (!s.ok) tablo[alan][sembol] = `✗ ${s.durum}`;
    }
  }

  console.log(`${"alan".padEnd(44)}${semboller.map((s) => s.padEnd(26)).join("")}`);
  console.log("─".repeat(125));
  for (const alan of TEMEL_ALANLAR) {
    console.log(
      `${(gecen.has(alan) ? "✓ " : "✗ ") + alan.padEnd(42)}${semboller
        .map((s) => String(JSON.stringify(tablo[alan][s]) ?? "yok").slice(0, 24).padEnd(26))
        .join("")}`,
    );
  }

  // Bütün borsa tek istekte temel alanlarla gelir mi? (sektör ortancası için)
  const sutunlar = ["name", ...[...gecen].slice(0, 24)];
  for (const [yol, borsa] of [
    ["turkey", ["BIST"]],
    ["america", ["NASDAQ", "NYSE"]],
  ] as const) {
    await dene(`tarama ${yol}`, "temel", `https://scanner.tradingview.com/${yol}/scan`, (govde) => {
      const veri = JSON.parse(govde) as { totalCount?: number; data?: { s: string; d: unknown[] }[] };
      const satirlar = veri.data ?? [];
      if (satirlar.length === 0) throw new Error("boş data dizisi");
      const sektorIndex = sutunlar.indexOf("sector");
      const sektorler = new Set(satirlar.map((s) => (sektorIndex >= 0 ? s.d[sektorIndex] : null)));
      return `${satirlar.length}/${veri.totalCount} satır · ${Math.round(govde.length / 1024)} KB · ${sektorler.size} sektör · örnek: ${[
        ...sektorler,
      ]
        .slice(0, 8)
        .join(", ")}`;
    }, {
      govde: {
        filter: [
          { left: "exchange", operation: "in_range", right: borsa },
          { left: "type", operation: "equal", right: "stock" },
        ],
        columns: sutunlar,
        sort: { sortBy: "market_cap_basic", sortOrder: "desc" },
        range: [0, 1500],
      },
      baslik: TV_BASLIK,
    });
  }

  /* ────────────────────── Rapor ────────────────────── */

  console.log(
    `${"kaynak".padEnd(20)}${"piyasa".padEnd(8)}${"durum".padEnd(12)}${"süre".padEnd(9)}özet`,
  );
  console.log("─".repeat(125));
  for (const s of sonuclar) {
    console.log(
      `${(s.ok ? "✓ " : "✗ ") + s.kaynak.padEnd(18)}${s.piyasa.padEnd(8)}${s.durum.padEnd(12)}${String(
        s.sure + "ms",
      ).padEnd(9)}${s.ozet}`,
    );
  }

  const calisan = sonuclar.filter((s) => s.ok);
  console.log(`\n${calisan.length}/${sonuclar.length} istek başarılı.`);
  console.log(`Çalışan: ${[...new Set(calisan.map((s) => s.kaynak))].join(", ") || "yok"}`);
}

tara().catch((error) => {
  console.error(error);
  process.exit(1);
});

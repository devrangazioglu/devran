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
 *   ✓ Yahoo + aktarıcı: r.jina.ai (≈400 ms, 55 KB kalkıyor),
 *     allorigins (çalışıyor ama yavaş: ardışık sekiz istekte 6/8, 70 sn)
 *   ✗ corsproxy.io, cors.lol, thingproxy, codetabs
 *   ✓ gold-api (dakikası dakikasına altın/gümüş), truncgil, Frankfurter
 *
 * Bu betik adayları aynı yöntemle dener: tahmin değil, ham sonuç.
 *
 * Çalıştırma (veritabanı ve anahtar gerektirmez):
 *   npm run kaynak-tara
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

/** Gövdedeki ilk `{`'ten sonrasını Yahoo yanıtı olarak ayrıştırır. */
function yahooGovdeden(govde: string): string {
  const basla = govde.indexOf('{"chart"');
  const ham = basla >= 0 ? govde.slice(basla) : govde;
  const veri = JSON.parse(ham) as {
    chart?: {
      result?: {
        meta?: { currency?: string };
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
  return `${kapanislar.length} mum · son ${kapanislar[kapanislar.length - 1].toFixed(2)} ${
    sonuc.meta?.currency ?? ""
  } · ${yas} dk önce · ${Math.round(govde.length / 1024)} KB`;
}

/** Jina'nın JSON zarfı: { data: { content } }. */
function jinaZarf(govde: string): string {
  const veri = JSON.parse(govde) as { data?: { content?: string } };
  const icerik = veri.data?.content;
  if (!icerik) throw new Error("zarf içinde content yok");
  return yahooGovdeden(icerik);
}

function tradingview(govde: string): string {
  const veri = JSON.parse(govde) as { totalCount?: number; data?: { s: string; d: unknown[] }[] };
  const satirlar = veri.data ?? [];
  if (satirlar.length === 0) throw new Error("boş data dizisi");
  return `${veri.totalCount ?? satirlar.length} sembol · ${satirlar[0].s} = ${JSON.stringify(
    satirlar[0].d,
  ).slice(0, 110)}`;
}

const yahooUrl = (sembol: string, aralik: string, adim: string) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    sembol,
  )}?range=${aralik}&interval=${adim}`;

async function tara(): Promise<void> {
  console.log("Ücretsiz veri kaynakları ölçülüyor…\n");

  /* ── 1) Jina: hangi biçim en temiz? ── */
  await dene("jina düz", "bist", `https://r.jina.ai/${yahooUrl("THYAO.IS", "1mo", "1d")}`, yahooGovdeden);
  await dene(
    "jina json zarf",
    "bist",
    `https://r.jina.ai/${yahooUrl("THYAO.IS", "1mo", "1d")}`,
    jinaZarf,
    { baslik: { accept: "application/json" } },
  );
  await dene(
    "jina ham metin",
    "abd",
    `https://r.jina.ai/${yahooUrl("AAPL", "1mo", "15m")}`,
    yahooGovdeden,
    { baslik: { "x-return-format": "text" } },
  );

  /* ── 2) Jina hız sınırı: 10 istek art arda ── */
  {
    const semboller = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "NFLX", "AMD", "INTC"];
    let basarili = 0;
    let ilkHata = "";
    const basladi = Date.now();
    for (const sembol of semboller) {
      const s = await dene("jina ×10", "abd", `https://r.jina.ai/${yahooUrl(sembol, "6mo", "1d")}`, yahooGovdeden, {
        sessiz: true,
      });
      if (s.ok) basarili++;
      else if (!ilkHata) ilkHata = `${sembol}: ${s.durum} ${s.ozet.slice(0, 70)}`;
    }
    const sure = Date.now() - basladi;
    sonuclar.push({
      kaynak: "jina ×10",
      piyasa: "abd",
      durum: `${basarili}/10`,
      sure,
      ozet:
        (basarili === 10 ? "hepsi geçti" : `ilk hata — ${ilkHata}`) +
        ` · sembol başına ${Math.round(sure / 10)} ms`,
      ok: basarili >= 9,
    });
  }

  /* ── 3) Başka aktarıcı adayları ── */
  await dene(
    "corsfix",
    "bist",
    `https://proxy.corsfix.com/?${yahooUrl("GARAN.IS", "1mo", "1d")}`,
    yahooGovdeden,
  );
  await dene(
    "cors.workers.dev",
    "emtia",
    `https://test.cors.workers.dev/?${yahooUrl("GC=F", "1mo", "1d")}`,
    yahooGovdeden,
  );
  await dene(
    "allorigins tek",
    "abd",
    `https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl("AAPL", "1mo", "1d"))}`,
    yahooGovdeden,
  );

  /* ── 4) TradingView: tek sembol uç noktası (gün içi alanlar) ── */
  await dene(
    "tv tek sembol",
    "bist",
    "https://scanner.tradingview.com/symbol?symbol=BIST%3ATHYAO&fields=" +
      encodeURIComponent(
        "close,change,open,high,low,volume,price_52_week_high,price_52_week_low,update_mode",
      ),
    (govde) => JSON.stringify(JSON.parse(govde)).slice(0, 220),
    { baslik: { origin: "https://www.tradingview.com", referer: "https://www.tradingview.com/" } },
  );

  // Gecikme ölçümü: BIST kapalıyken "update_mode" ve son fiyat ne diyor?
  await dene(
    "tv bist ilk 5",
    "bist",
    "https://scanner.tradingview.com/turkey/scan",
    tradingview,
    {
      govde: {
        filter: [{ left: "exchange", operation: "equal", right: "BIST" }],
        columns: ["name", "close", "change", "volume", "update_mode", "currency"],
        sort: { sortBy: "volume", sortOrder: "desc" },
        range: [0, 5],
      },
      baslik: { origin: "https://www.tradingview.com", referer: "https://www.tradingview.com/" },
    },
  );

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

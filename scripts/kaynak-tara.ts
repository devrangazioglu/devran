/**
 * Ücretsiz veri kaynaklarını ölçer.
 *
 * Hangi kaynağın "ücretsiz ve sınırsız" olduğu belgelerden okunarak
 * anlaşılmıyor: asıl soru, **bizim çalıştığımız makineden** cevap verip
 * vermediği. Yahoo ve Stooq Vercel'in IP aralığını engelliyor (ölçüldü), aynı
 * istek GitHub çalıştırıcısından geçebiliyor. Bu betik tahmin yürütmek yerine
 * her adayı tek tek deniyor ve ham sonucu basıyor:
 *
 *   • HTTP durumu, içerik türü, gövde boyutu, süre
 *   • ayrıştırılabiliyorsa son kapanış ve mum sayısı
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
  baslik: Record<string, string> = {},
): Promise<void> {
  const basladi = Date.now();
  try {
    const yanit = await fetch(url, {
      headers: { "user-agent": UA, accept: "*/*", ...baslik },
      signal: AbortSignal.timeout(15_000),
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
          .slice(0, 80)
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

/** Yahoo chart yanıtı: kaç mum geldi, sonuncusu ne zaman ve kaçtan kapandı. */
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
    sonuc.meta?.exchangeName ?? "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Stooq CSV: ilk satır başlık mı, kaç satır var. */
function stooqCsv(govde: string): string {
  const satirlar = govde.trim().split("\n");
  if (!satirlar[0]?.toLowerCase().startsWith("date")) {
    throw new Error(`CSV değil: ${satirlar[0]?.slice(0, 60)}`);
  }
  const son = satirlar[satirlar.length - 1].split(",");
  return `${satirlar.length - 1} satır · son ${son[0]} kapanış ${son[4]}`;
}

/** İş Yatırım tekil sorgu: JSON içinde "value" dizisi. */
function isYatirim(govde: string): string {
  const veri = JSON.parse(govde) as { value?: Record<string, unknown>[] };
  const kayitlar = veri.value ?? [];
  if (kayitlar.length === 0) throw new Error("boş value dizisi");
  const son = kayitlar[kayitlar.length - 1];
  return `${kayitlar.length} kayıt · son ${JSON.stringify(son).slice(0, 120)}`;
}

function jsonOzet(alanlar: string[]) {
  return (govde: string): string => {
    const veri = JSON.parse(govde) as Record<string, unknown>;
    const parcalar = alanlar.map((alan) => {
      const deger = alan.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], veri);
      return `${alan}=${JSON.stringify(deger)}`;
    });
    return parcalar.join(" · ").slice(0, 200);
  };
}

/* ────────────────────── Adaylar ────────────────────── */

async function tara(): Promise<void> {
  console.log("Ücretsiz veri kaynakları ölçülüyor…\n");

  // ── Yahoo Finance (anahtarsız, tüm piyasalar, gün içi dahil) ──
  for (const [piyasa, sembol] of [
    ["abd", "AAPL"],
    ["bist", "THYAO.IS"],
    ["bist-endeks", "XU100.IS"],
    ["emtia", "GC=F"],
    ["doviz", "USDTRY=X"],
  ] as const) {
    await dene(
      "yahoo günlük",
      piyasa,
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sembol)}?range=1mo&interval=1d`,
      yahooChart,
    );
    await dene(
      "yahoo 15dk",
      piyasa,
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sembol)}?range=5d&interval=15m`,
      yahooChart,
    );
  }

  // Yahoo'nun ikinci kapısı: biri engellenirse diğeri açık olabiliyor.
  await dene(
    "yahoo query2",
    "abd",
    "https://query2.finance.yahoo.com/v8/finance/chart/MSFT?range=5d&interval=5m",
    yahooChart,
  );

  // ── Stooq (anahtarsız CSV) ──
  await dene(
    "stooq günlük",
    "abd",
    "https://stooq.com/q/d/l/?s=aapl.us&i=d",
    stooqCsv,
  );
  await dene(
    "stooq 5dk",
    "abd",
    "https://stooq.com/q/d/l/?s=aapl.us&i=5",
    stooqCsv,
  );
  await dene("stooq emtia", "emtia", "https://stooq.com/q/d/l/?s=xauusd&i=d", stooqCsv);

  // ── İş Yatırım (BIST, anahtarsız) ──
  const bugun = new Date();
  const gun = (t: Date) =>
    `${String(t.getDate()).padStart(2, "0")}-${String(t.getMonth() + 1).padStart(2, "0")}-${t.getFullYear()}`;
  const birAyOnce = new Date(bugun.getTime() - 30 * 86_400_000);
  await dene(
    "isyatirim günlük",
    "bist",
    "https://www.isyatirim.com.tr/_layouts/15/IsYatirim.Website/Common/Data.aspx/HisseTekilSorgu" +
      `?hisse=THYAO&startdate=${gun(birAyOnce)}&enddate=${gun(bugun)}`,
    isYatirim,
    { referer: "https://www.isyatirim.com.tr/" },
  );

  // ── Altın/gümüş: anahtarsız metal fiyatı ──
  await dene(
    "gold-api",
    "emtia",
    "https://api.gold-api.com/price/XAU",
    jsonOzet(["name", "price", "updatedAt"]),
  );

  // ── Frankfurter (ECB kurları — zaten kullanılıyor) ──
  await dene(
    "frankfurter",
    "doviz",
    "https://api.frankfurter.app/latest?from=USD&to=TRY",
    jsonOzet(["date", "rates.TRY"]),
  );

  // ── Binance (kripto — çalıştığı biliniyor, karşılaştırma için) ──
  await dene(
    "binance",
    "kripto",
    "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=5",
    (govde) => {
      const veri = JSON.parse(govde) as unknown[][];
      return `${veri.length} mum · son kapanış ${veri[veri.length - 1]?.[4]}`;
    },
  );

  /* ────────────────────── Rapor ────────────────────── */

  console.log(
    `${"kaynak".padEnd(18)}${"piyasa".padEnd(14)}${"durum".padEnd(14)}${"süre".padEnd(8)}özet`,
  );
  console.log("─".repeat(110));
  for (const s of sonuclar) {
    console.log(
      `${(s.ok ? "✓ " : "✗ ") + s.kaynak.padEnd(18)}${s.piyasa.padEnd(14)}${s.durum.padEnd(14)}${String(
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

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

const SUTUN = ["name", "close", "change", "high", "low", "volume", "update_mode", "currency"];

async function tara(): Promise<void> {
  console.log("Ücretsiz veri kaynakları ölçülüyor…\n");

  /* ── 1) Bütün emtia tek istekte gelebilir mi? ── */
  await dene("tv emtia süzgeç", "emtia", "https://scanner.tradingview.com/futures/scan", tradingview(2), {
    govde: {
      filter: [
        {
          left: "name",
          operation: "in_range",
          right: ["GC1!", "SI1!", "PL1!", "PA1!", "HG1!", "CL1!", "BZ1!", "NG1!", "ZW1!", "KC1!"],
        },
      ],
      columns: SUTUN,
      sort: { sortBy: "name", sortOrder: "asc" },
      range: [0, 30],
    },
    baslik: TV_BASLIK,
  });

  /* ── 2) Döviz tarayıcısı ── */
  await dene("tv döviz", "doviz", "https://scanner.tradingview.com/forex/scan", tradingview(3), {
    govde: {
      columns: SUTUN,
      sort: { sortBy: "volume", sortOrder: "desc" },
      range: [0, 10],
    },
    baslik: TV_BASLIK,
  });

  await dene("tv döviz süzgeç", "doviz", "https://scanner.tradingview.com/forex/scan", tradingview(4), {
    govde: {
      filter: [
        {
          left: "name",
          operation: "in_range",
          right: ["USDTRY", "EURTRY", "GBPTRY", "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD"],
        },
      ],
      columns: SUTUN,
      sort: { sortBy: "name", sortOrder: "asc" },
      range: [0, 20],
    },
    baslik: TV_BASLIK,
  });

  /* ── 3) Endeksler: tek sembol uç noktasından gelir mi? ── */
  for (const sembol of ["SP:SPX", "NASDAQ:IXIC", "TVC:DXY", "BIST:XU100", "DJ:DJI"]) {
    await dene(
      `tv ${sembol}`,
      "endeks",
      `https://scanner.tradingview.com/symbol?symbol=${encodeURIComponent(sembol)}&fields=` +
        encodeURIComponent("close,change,high,low,volume,update_mode,currency"),
      (govde) => JSON.stringify(JSON.parse(govde)).slice(0, 190),
      { baslik: TV_BASLIK },
    );
  }

  /* ── 4) truncgil: hangi kalemler var? ── */
  await dene(
    "truncgil",
    "doviz",
    "https://finans.truncgil.com/today.json",
    (govde) => {
      const veri = JSON.parse(govde) as Record<string, unknown>;
      const anahtarlar = Object.keys(veri);
      const ilgi = anahtarlar.filter((a) =>
        /USD|EUR|GBP|GRAM|ALTIN|CEYREK|JPY|CHF|CAD|AUD/i.test(a),
      );
      return `${anahtarlar.length} kalem · ilgili: ${ilgi.slice(0, 14).join(",")} · GRAM ALTIN=${JSON.stringify(
        veri["gram-altin"] ?? veri["GRAM ALTIN"] ?? veri["Gram Altın"],
      )}`.slice(0, 300);
    },
  );

  await dene(
    "frankfurter",
    "doviz",
    "https://api.frankfurter.app/latest?from=USD&to=TRY,EUR",
    jsonOzet(["date", "rates"]),
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

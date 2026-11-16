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
 *   ✓ Yahoo + r.jina.ai aktarıcısı → 10/10 ardışık istek, sembol başına 373 ms
 *   ~ allorigins → üçüncü turda çalıştı, dördüncüde HTTP 522: yedek
 *   ✗ corsproxy.io, cors.lol, thingproxy, corsfix, cors.workers.dev, codetabs
 *   ✓ gold-api (dakikası dakikasına altın/gümüş), truncgil, Frankfurter
 *
 * Beşinci tur üç şeyi sorar: emtia TradingView'da var mı, ABD verisi ne kadar
 * gecikmeli, metal/kur kaynaklarının alan adları hâlâ aynı mı.
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
    return `${veri.totalCount ?? satirlar.length} sembol · ${ornekler}`.slice(0, 300);
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

async function tara(): Promise<void> {
  console.log("Ücretsiz veri kaynakları ölçülüyor…\n");

  /* ── 1) Emtia: TradingView'da vadeli kontratlar ── */
  await dene("tv vadeli", "emtia", "https://scanner.tradingview.com/futures/scan", tradingview(3), {
    govde: {
      columns: ["name", "description", "close", "change", "volume", "update_mode", "currency"],
      sort: { sortBy: "volume", sortOrder: "desc" },
      range: [0, 25],
    },
    baslik: TV_BASLIK,
  });

  // Aradığımız kontratlar adıyla duruyor mu? (altın, gümüş, petrol, gaz)
  for (const sembol of ["COMEX:GC1!", "COMEX:SI1!", "NYMEX:CL1!", "NYMEX:NG1!"]) {
    await dene(
      `tv ${sembol.split(":")[1]}`,
      "emtia",
      `https://scanner.tradingview.com/symbol?symbol=${encodeURIComponent(sembol)}&fields=` +
        encodeURIComponent("close,change,high,low,volume,update_mode,currency"),
      (govde) => JSON.stringify(JSON.parse(govde)).slice(0, 200),
      { baslik: TV_BASLIK },
    );
  }

  /* ── 2) ABD verisi ne kadar gecikmeli? ── */
  await dene("tv abd kipi", "abd", "https://scanner.tradingview.com/america/scan", tradingview(3), {
    govde: {
      filter: [{ left: "name", operation: "in_range", right: ["AAPL", "MSFT", "NVDA"] }],
      columns: ["name", "close", "change", "update_mode", "currency"],
      range: [0, 3],
    },
    baslik: TV_BASLIK,
  });

  // Endeksler de tarayıcıda var mı? (^GSPC karşılığı)
  await dene("tv endeks", "abd", "https://scanner.tradingview.com/america/scan", tradingview(5), {
    govde: {
      filter: [{ left: "type", operation: "equal", right: "index" }],
      columns: ["name", "description", "close", "change", "update_mode"],
      sort: { sortBy: "name", sortOrder: "asc" },
      range: [0, 10],
    },
    baslik: TV_BASLIK,
  });

  /* ── 3) Metal ve kur: alan adları hâlâ aynı mı? ── */
  for (const metal of ["XAU", "XAG", "XPT", "XPD"]) {
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

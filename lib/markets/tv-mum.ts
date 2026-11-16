/**
 * Mum geçmişi: TradingView grafik akışı (WebSocket).
 *
 * Neden: hisse mumları Yahoo'dan bir aktarıcı üzerinden geliyordu. Aktarıcı
 * dakikada ~20 istekle sınırlı ve zaman zaman bütünüyle 429 veriyor
 * (ölçüldü, 2026-11-16: `scripts/ulke-tara.ts` çalışmasında AAPL dâhil her
 * sembol). Anlık fiyatı zaten TradingView tarayıcısından alıyoruz; aynı
 * kaynağın grafik akışı mum geçmişini de anahtar istemeden veriyor.
 *
 * Protokol (TradingView'ın kendi grafiğinin kullandığı, belgelenmemiş):
 *   • Her mesaj `~m~<uzunluk>~m~<gövde>` çerçevesinde; bir pakette birden
 *     çok mesaj olabilir.
 *   • `~h~N` nabız mesajıdır, aynen geri gönderilmezse bağlantı kapanır.
 *   • Oturum: set_auth_token → chart_create_session → resolve_symbol →
 *     create_series. Mumlar `timescale_update` içinde gelir, seri bitince
 *     `series_completed`.
 * Anahtarsız kullanıcıya veri borsanın gecikmesiyle gelir (hisse 15–20 dk);
 * günlük ve haftalık analiz için fark etmez.
 *
 * Sözleşme değişirse yalnızca bu dosya güncellenir; `TV_MUM_KAPALI=1` ile
 * kapanır ve uygulama eski yola (Yahoo) döner.
 */

import { intervalMinutes, MarketDataError, type Candle, type Interval } from "./types";

const ADRES = process.env.TV_MUM_ADRES ?? "wss://data.tradingview.com/socket.io/websocket";

/** Uygulama periyodu → TradingView çözünürlüğü. */
const COZUNURLUK: Record<Interval, string> = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "30m": "30",
  "1h": "60",
  "4h": "240",
  "1d": "1D",
  "1w": "1W",
};

/**
 * Açık mı? `MARKET_API_BASE` tanımlıyken kapalı: o değişken testlerin ve
 * kapalı ağların sahte sunucuyu göstermesi için var; akışa çıkmak oradaki
 * ölçümü bozar (aynı kural aktarıcı için de geçerli).
 */
export function tvMumAcik(): boolean {
  return (
    process.env.TV_MUM_KAPALI !== "1" &&
    process.env.TRADINGVIEW_KAPALI !== "1" &&
    !process.env.MARKET_API_BASE &&
    typeof WebSocket !== "undefined"
  );
}

function cerceve(govde: string): string {
  return `~m~${govde.length}~m~${govde}`;
}

function mesaj(m: string, p: unknown[]): string {
  return cerceve(JSON.stringify({ m, p }));
}

/** Bir paketi mesajlarına ayırır. */
export function paketiAyir(paket: string): string[] {
  const parcalar: string[] = [];
  let i = 0;
  while (i < paket.length) {
    if (!paket.startsWith("~m~", i)) break;
    const son = paket.indexOf("~m~", i + 3);
    if (son < 0) break;
    const uzunluk = Number(paket.slice(i + 3, son));
    if (!Number.isFinite(uzunluk)) break;
    const basla = son + 3;
    parcalar.push(paket.slice(basla, basla + uzunluk));
    i = basla + uzunluk;
  }
  return parcalar;
}

type SeriSatiri = { i: number; v: number[] };

/** `timescale_update` gövdesinden mumları çıkarır. */
export function mumlariCoz(satirlar: SeriSatiri[], interval: Interval): Candle[] {
  const sureMs = intervalMinutes(interval) * 60_000;
  const mumlar: Candle[] = [];
  for (const { v } of satirlar) {
    const [zaman, acilis, yuksek, dusuk, kapanis, hacim] = v;
    if (![zaman, acilis, yuksek, dusuk, kapanis].every((x) => typeof x === "number" && Number.isFinite(x))) {
      continue;
    }
    const openTime = zaman * 1000;
    mumlar.push({
      openTime,
      open: acilis,
      high: yuksek,
      low: dusuk,
      close: kapanis,
      volume: typeof hacim === "number" && Number.isFinite(hacim) ? hacim : 0,
      closeTime: openTime + sureMs - 1,
      quoteVolume: (typeof hacim === "number" ? hacim : 0) * kapanis,
      trades: 0,
    });
  }
  return mumlar.sort((a, b) => a.openTime - b.openTime);
}

function rastgele(onEk: string): string {
  return `${onEk}_${Math.random().toString(36).slice(2, 14)}`;
}

/**
 * `tamAd` ("XETR:SAP", "TSE:7203") için son `adet` mumu getirir.
 *
 * Tek kullanımlık bağlantı: sunucusuz ortamda kalıcı bağlantı tutulamaz.
 * Bir sembol ~300–800 ms sürüyor (bağlantı + çözümleme + seri).
 */
export async function fetchTvCandles(
  tamAd: string,
  interval: Interval,
  adet = 300,
  zamanAsimiMs = 12_000,
): Promise<{ candles: Candle[]; currency: string | null }> {
  if (!tvMumAcik()) throw new MarketDataError("Grafik akışı kapalı.", 503);

  // Node'un yerleşik WebSocket'i (undici) standart dışı `headers` seçeneğini
  // kabul ediyor; kaynak, Origin başlığı olmayan bağlantıyı reddediyor.
  const Ws = WebSocket as unknown as new (
    url: string,
    init?: { headers?: Record<string, string> },
  ) => WebSocket;

  return new Promise((resolve, reject) => {
    const ws = new Ws(ADRES, {
      headers: {
        origin: "https://www.tradingview.com",
        "user-agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
    });
    const oturum = rastgele("cs");
    let mumlar: Candle[] = [];
    let paraBirimi: string | null = null;
    let bitti = false;

    const kapat = (hata: Error | null) => {
      if (bitti) return;
      bitti = true;
      clearTimeout(zamanlayici);
      try {
        ws.close();
      } catch {
        // zaten kapalı
      }
      if (hata) reject(hata);
      else resolve({ candles: mumlar, currency: paraBirimi });
    };

    const zamanlayici = setTimeout(
      () => kapat(new MarketDataError(`${tamAd}: grafik akışı zaman aşımı.`, 504)),
      zamanAsimiMs,
    );

    ws.addEventListener("open", () => {
      const sembol = `=${JSON.stringify({ symbol: tamAd, adjustment: "splits", session: "regular" })}`;
      ws.send(mesaj("set_auth_token", ["unauthorized_user_token"]));
      ws.send(mesaj("chart_create_session", [oturum, ""]));
      ws.send(mesaj("resolve_symbol", [oturum, "sds_sym_1", sembol]));
      ws.send(mesaj("create_series", [oturum, "sds_1", "s1", "sds_sym_1", COZUNURLUK[interval], adet, ""]));
    });

    ws.addEventListener("message", (olay: MessageEvent) => {
      const paket = typeof olay.data === "string" ? olay.data : String(olay.data);
      for (const govde of paketiAyir(paket)) {
        if (govde.startsWith("~h~")) {
          ws.send(cerceve(govde));
          continue;
        }
        let veri: { m?: string; p?: unknown[] };
        try {
          veri = JSON.parse(govde);
        } catch {
          continue; // ilk karşılama mesajı (sunucu bilgisi)
        }
        const p = veri.p ?? [];
        if (veri.m === "symbol_resolved") {
          const bilgi = p[2] as { currency_code?: string; currency_id?: string } | undefined;
          paraBirimi = bilgi?.currency_code ?? bilgi?.currency_id ?? null;
        } else if (veri.m === "timescale_update") {
          const seri = (p[1] as Record<string, { s?: SeriSatiri[] }> | undefined)?.sds_1;
          if (seri?.s) mumlar = mumlariCoz(seri.s, interval);
        } else if (veri.m === "series_completed") {
          kapat(mumlar.length > 0 ? null : new MarketDataError(`${tamAd}: mum gelmedi.`, 404));
        } else if (veri.m === "symbol_error") {
          kapat(new MarketDataError(`${tamAd}: sembol bulunamadı.`, 404));
        } else if (veri.m === "critical_error" || veri.m === "protocol_error" || veri.m === "series_error") {
          kapat(new MarketDataError(`${tamAd}: ${veri.m} ${JSON.stringify(p).slice(0, 120)}`, 502));
        }
      }
    });

    ws.addEventListener("error", () => kapat(new MarketDataError(`${tamAd}: grafik akışına bağlanılamadı.`, 502)));
    ws.addEventListener("close", () =>
      kapat(mumlar.length > 0 ? null : new MarketDataError(`${tamAd}: bağlantı erken kapandı.`, 502)),
    );
  });
}

/* ────────────────────────── Anlık fiyat (quote oturumu) ────────────────────────── */

export type TvAnlik = {
  fiyat: number;
  degisim: number | null;
  degisimYuzde: number | null;
  yuksek: number | null;
  dusuk: number | null;
  hacim: number | null;
  /** Kaynağın bildirdiği güncelleme biçimi: "streaming" gecikmesiz demek. */
  guncelleme: string | null;
  /** Son işlemin zamanı (ms). */
  zaman: number | null;
};

/**
 * Birden çok sembolün son fiyatını tek bağlantıda alır (quote oturumu).
 *
 * Tarayıcı ucu (`tradingview.ts`) fiyatı borsanın gecikmesiyle veriyor; bazı
 * semboller ise kaynakta gecikmesiz yayınlanıyor (ABD hisseleri için Cboe
 * BZX, TVC endeks ve emtia beslemeleri, döviz). Bunlar burada, bir pakette
 * çekilir. Gelmeyen sembol sonuçta yoktur; çağıran gecikmeli fiyata düşer.
 */
export async function fetchTvAnlik(
  tamAdlar: string[],
  zamanAsimiMs = 8_000,
): Promise<Map<string, TvAnlik>> {
  if (!tvMumAcik()) throw new MarketDataError("Grafik akışı kapalı.", 503);
  const istenen = [...new Set(tamAdlar)];
  if (istenen.length === 0) return new Map();

  const Ws = WebSocket as unknown as new (
    url: string,
    init?: { headers?: Record<string, string> },
  ) => WebSocket;

  return new Promise((resolve) => {
    const ws = new Ws(ADRES, {
      headers: {
        origin: "https://www.tradingview.com",
        "user-agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
    });
    const oturum = rastgele("qs");
    const ham = new Map<string, Record<string, unknown>>();
    const biten = new Set<string>();
    let bitti = false;

    const kapat = () => {
      if (bitti) return;
      bitti = true;
      clearTimeout(zamanlayici);
      try {
        ws.close();
      } catch {
        // zaten kapalı
      }
      const sonuc = new Map<string, TvAnlik>();
      for (const [ad, v] of ham) {
        const sayi = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);
        const fiyat = sayi(v.lp);
        if (fiyat === null) continue;
        sonuc.set(ad, {
          fiyat,
          degisim: sayi(v.ch),
          degisimYuzde: sayi(v.chp),
          yuksek: sayi(v.high_price),
          dusuk: sayi(v.low_price),
          hacim: sayi(v.volume),
          guncelleme: typeof v.update_mode === "string" ? v.update_mode : null,
          zaman: sayi(v.lp_time) !== null ? (v.lp_time as number) * 1000 : null,
        });
      }
      resolve(sonuc);
    };

    // Zaman aşımında elde ne varsa döner: yarım liste, hiç liste olmamasından iyi.
    const zamanlayici = setTimeout(kapat, zamanAsimiMs);

    ws.addEventListener("open", () => {
      ws.send(mesaj("set_auth_token", ["unauthorized_user_token"]));
      ws.send(mesaj("quote_create_session", [oturum]));
      ws.send(
        mesaj("quote_set_fields", [
          oturum,
          "lp",
          "ch",
          "chp",
          "high_price",
          "low_price",
          "volume",
          "update_mode",
          "lp_time",
        ]),
      );
      ws.send(mesaj("quote_add_symbols", [oturum, ...istenen]));
    });

    ws.addEventListener("message", (olay: MessageEvent) => {
      const paket = typeof olay.data === "string" ? olay.data : String(olay.data);
      for (const govde of paketiAyir(paket)) {
        if (govde.startsWith("~h~")) {
          ws.send(cerceve(govde));
          continue;
        }
        let veri: { m?: string; p?: unknown[] };
        try {
          veri = JSON.parse(govde);
        } catch {
          continue;
        }
        if (veri.m === "qsd") {
          const parca = veri.p?.[1] as { n?: string; s?: string; v?: Record<string, unknown> } | undefined;
          if (!parca?.n) continue;
          if (parca.s !== "ok") {
            biten.add(parca.n);
          } else if (parca.v) {
            ham.set(parca.n, { ...(ham.get(parca.n) ?? {}), ...parca.v });
          }
        } else if (veri.m === "quote_completed") {
          const ad = veri.p?.[1];
          if (typeof ad === "string") biten.add(ad);
        }
        if (istenen.every((ad) => biten.has(ad))) kapat();
      }
    });

    ws.addEventListener("error", kapat);
    ws.addEventListener("close", kapat);
  });
}

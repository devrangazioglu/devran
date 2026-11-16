import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { analyze, chartSeries, isBuySignal, isSellSignal } from "@/lib/analysis";
import { buildCommentary } from "@/lib/commentary";
import { krediHarca, krediIade, krediOzeti, kullanicidanDurum } from "@/lib/credits";
import { bilesikGorunum } from "@/lib/fundamentals";
import { analysisReady } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { analizBaglami } from "@/lib/markets/baglam";
import { getCandles, getQuotes, normalizeSymbol } from "@/lib/markets/provider";
import { getFundamentals } from "@/lib/markets/temel";
import {
  isInterval,
  marketAktif,
  MarketDataError,
  MARKETS,
  type Interval,
  type MarketId,
} from "@/lib/markets/types";
import { ANALIZ_KREDISI } from "@/lib/plans";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { findUserByEmail } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

/** Detay sayfasında karşılaştırılacak üst zaman dilimleri. */
function higherTimeframes(market: MarketId, interval: Interval): Interval[] {
  const available = MARKETS[market].intervals;
  const index = available.indexOf(interval);
  // Borsa ve emtiada günlük/haftalık sayfa veritabanından açılır; yanına üç
  // gün içi periyot eklemek her açılışta veri kaynağına altı istek (periyot +
  // endeks) demekti ve kaynak dakikada ~20 istekle sınırlı. Orada ikiyle
  // yetinilir.
  const adet = market !== "kripto" && (interval === "1d" || interval === "1w") ? 2 : 3;
  const higher = available.slice(index + 1, index + 1 + adet);
  // Yeterli üst periyot yoksa alt periyotlarla tamamla (yakın olandan başla).
  if (higher.length < adet) {
    const lower = available.slice(Math.max(index - (adet - higher.length), 0), index).reverse();
    return [...higher, ...lower].slice(0, adet);
  }
  return higher;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Bu işlem için giriş yapmalısınız." }, { status: 401 });
  }
  const limiter = rateLimit(`analyze:${session.user.email ?? clientIp(request)}`, 90, 60_000);
  if (!limiter.allowed) {
    return NextResponse.json(
      { error: "Çok sık analiz isteği yapıldı, biraz bekleyin." },
      { status: 429, headers: { "retry-after": String(limiter.retryAfterSeconds) } },
    );
  }

  const { searchParams } = new URL(request.url);
  const marketParam = searchParams.get("market") ?? "kripto";
  const intervalParam = searchParams.get("interval") ?? "4h";

  if (!marketAktif(marketParam)) {
    return NextResponse.json({ error: "Bu piyasa şu anda kapalı." }, { status: 404 });
  }
  const symbol = normalizeSymbol(marketParam, searchParams.get("symbol") ?? "");
  if (!symbol) {
    return NextResponse.json({ error: "Geçersiz sembol." }, { status: 400 });
  }
  if (!isInterval(intervalParam) || !MARKETS[marketParam].intervals.includes(intervalParam)) {
    return NextResponse.json({ error: "Bu piyasa için geçersiz zaman dilimi." }, { status: 400 });
  }
  const interval = intervalParam;
  const locale = await getLocale();

  // Plan ve kredi. Kayıt okunamıyorsa (depo yok/erişilemiyor) kısıtlama
  // uygulanmaz; altyapı sorunu kullanıcının hakkını yemesin.
  const email = session.user.email ?? "";
  const kullanici = email ? await findUserByEmail(email).catch(() => null) : null;
  const durum = kullanici ? kullanicidanDurum(kullanici) : null;

  if (durum && !durum.plan.periyotlar.includes(interval)) {
    return NextResponse.json(
      {
        error: `${interval} periyodu ${durum.plan.ad} planında kapalı. Planlar sayfasından yükseltebilirsiniz.`,
        kod: "plan-periyot",
      },
      { status: 403 },
    );
  }

  // Bir varlığın analizi bir kredi. Aynı varlık + periyot kısa süre içinde
  // yeniden açılırsa ücretsiz (bkz. lib/plans.ts).
  const anahtar = `${marketParam}:${symbol}:${interval}`;
  const harcama = email
    ? await krediHarca(email, anahtar, ANALIZ_KREDISI)
    : ({ ok: true, ucretsiz: true, durum: null } as const);

  if (!harcama.ok) {
    return NextResponse.json(
      {
        error:
          "Bu dönemki analiz krediniz bitti. Planlar sayfasından yükseltebilir ya da dönemin " +
          "yenilenmesini bekleyebilirsiniz.",
        kod: "kredi-yetersiz",
        kredi: krediOzeti(harcama.durum),
      },
      { status: 402 },
    );
  }

  try {
    const { candles, source, instrument } = await getCandles(marketParam, symbol, interval, 300);
    // Temel veri mumlarla aynı anda istenir; ikisi birbirinden bağımsız.
    const temelSozu =
      instrument.kind === "hisse" ? getFundamentals(marketParam, symbol) : Promise.resolve(null);
    const analysis = analyze(
      instrument,
      interval,
      candles,
      source,
      await analizBaglami(instrument, interval),
    );
    const series = chartSeries(candles);
    const fundamentals = await temelSozu;
    const overallKey = fundamentals
      ? bilesikGorunum(
          isBuySignal(analysis.signal) ? "buy" : isSellSignal(analysis.signal) ? "sell" : "wait",
          fundamentals.score,
        )
      : null;

    // Fiyat listesinden gün içi istatistikler (varsa).
    const quote = await getQuotes(marketParam, 60)
      .then(({ quotes }) => quotes.find((q) => q.symbol === symbol) ?? null)
      .catch(() => null);

    const timeframes = await Promise.all(
      higherTimeframes(marketParam, interval).map(async (other) => {
        try {
          // Tarayıcıyla aynı mum sayısı ve aynı bağlam: aynı periyot her
          // ekranda aynı skoru göstersin. Geçmiş sınaması burada gereksiz
          // (yalnızca sinyal gösteriliyor) ama güven puanına girdiği için
          // kapatılmaz.
          const result = await getCandles(marketParam, symbol, other, 300);
          const otherAnalysis = analyze(
            instrument,
            other,
            result.candles,
            result.source,
            await analizBaglami(instrument, other),
          );
          return {
            interval: other,
            signal: otherAnalysis.signal,
            score: otherAnalysis.score,
            confidence: otherAnalysis.confidence,
          };
        } catch {
          return null;
        }
      }),
    );
    const digerPeriyotlar = timeframes.filter((tf) => tf !== null);

    // Yorum en son üretilir: diğer zaman dilimlerinin sonucunu da kullanıyor,
    // "üst periyot ne diyor" cümlesi ancak onlar hesaplandıktan sonra yazılabilir.
    const commentary = buildCommentary(analysis, locale, {
      timeframes: digerPeriyotlar,
      fundamentals,
      overallKey,
    });

    const visible = 180;
    const trim = <T,>(list: T[]) => list.slice(-visible);

    return NextResponse.json({
      analysis,
      commentary,
      fundamentals,
      overallKey,
      analysisLocalized: analysisReady(locale),
      kredi: krediOzeti(harcama.durum),
      quote,
      candles: trim(candles),
      series: {
        ema21: trim(series.ema21),
        ema50: trim(series.ema50),
        ema200: trim(series.ema200),
        bbUpper: trim(series.bbUpper),
        bbLower: trim(series.bbLower),
        rsi: trim(series.rsi),
        macd: trim(series.macd),
        macdSignal: trim(series.macdSignal),
        macdHistogram: trim(series.macdHistogram),
      },
      timeframes: digerPeriyotlar,
    });
  } catch (error) {
    // Görülemeyen analiz için ödeme alınmaz.
    if (email && harcama.ok && !harcama.ucretsiz) {
      await krediIade(email, anahtar, ANALIZ_KREDISI);
    }
    const status = error instanceof MarketDataError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analiz yapılamadı." },
      { status },
    );
  }
}

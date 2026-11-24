/**
 * Analize verilen dış bağlam: karşılaştırma endeksi.
 *
 * Tarayıcı ve detay sayfası bağlamı **buradan** alır. İkisi ayrı ayrı
 * kurduğunda (biri endeksle, diğeri endekssiz) aynı varlık iki ekranda farklı
 * skor gösteriyordu; tek kaynak bunu yapısal olarak engeller.
 *
 * Üst zaman dilimi burada yok: motor onu eldeki mumlardan kendisi türetiyor
 * (bkz. `lib/analysis.ts`, HIGHER_TIMEFRAME).
 */

import type { AnalysisContext } from "../analysis";
import { borsa } from "./borsalar";
import { getCandles } from "./provider";
import type { Candle, Instrument, Interval, MarketId } from "./types";

type Kiyas = { market: MarketId; symbol: string; ticker: string };

/**
 * Bir varlığın kıyaslanacağı endeks.
 *
 * Hisse kendi borsasının endeksiyle, alt coin Bitcoin'le kıyaslanır. Endeksin
 * kendisi, emtia ve döviz için anlamlı bir kıyas yoktur: altını S&P 500 ile
 * kıyaslamak "göreli güç" değil, iki ayrı piyasanın farkıdır.
 */
export function kiyasEndeksi(instrument: Instrument): Kiyas | null {
  if (instrument.kind === "hisse") {
    const tanim = borsa(instrument.market);
    return tanim
      ? { market: instrument.market, symbol: tanim.endeks.symbol, ticker: tanim.endeks.ticker }
      : null;
  }
  if (instrument.kind === "kripto" && instrument.symbol !== "BTCUSDT") {
    return { market: "kripto", symbol: "BTCUSDT", ticker: "BTC" };
  }
  return null;
}

/**
 * Kısa ömürlü bellek: bir taramada onlarca hisse aynı endeksi ister.
 * Söz saklanır, böylece eşzamanlı istekler tek bir çağrıyı paylaşır.
 */
const TTL_MS = 60_000;
const bellek = new Map<string, { expires: number; mumlar: Promise<Candle[] | null> }>();

function endeksMumlari(kiyas: Kiyas, interval: Interval): Promise<Candle[] | null> {
  const anahtar = `${kiyas.market}:${kiyas.symbol}:${interval}`;
  const kayit = bellek.get(anahtar);
  if (kayit && kayit.expires > Date.now()) return kayit.mumlar;

  const mumlar = getCandles(kiyas.market, kiyas.symbol, interval, 300)
    .then((sonuc) => sonuc.candles)
    // Endeks alınamazsa analiz endekssiz yapılır: göreli güç bir ek bilgidir,
    // eksikliği analizin tamamını düşürmemeli.
    .catch(() => null);
  bellek.set(anahtar, { expires: Date.now() + TTL_MS, mumlar });
  return mumlar;
}

/** Testler için. */
export function baglamBellegiTemizle(): void {
  bellek.clear();
}

export async function analizBaglami(
  instrument: Instrument,
  interval: Interval,
): Promise<AnalysisContext> {
  const kiyas = kiyasEndeksi(instrument);
  if (!kiyas) return {};
  const mumlar = await endeksMumlari(kiyas, interval);
  return mumlar ? { benchmark: { ticker: kiyas.ticker, candles: mumlar } } : {};
}

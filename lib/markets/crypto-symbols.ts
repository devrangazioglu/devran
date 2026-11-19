/**
 * Kripto parite sembollerinin çözümlenmesi.
 *
 * "BTCUSDT" gibi bitişik yazılan pariteleri taban/kotasyon çiftine ayırır ve
 * bilinen coinlere okunur bir ad verir. Ağ erişimi gerektirmediği için hem
 * sağlayıcı katmanı hem de arayüz bu modülü kullanabilir.
 */

import { instrumentId, type Instrument } from "./types";

const COIN_NAMES: Record<string, string> = {
  BTC: "Bitcoin", ETH: "Ethereum", BNB: "BNB", SOL: "Solana", XRP: "XRP",
  ADA: "Cardano", DOGE: "Dogecoin", TRX: "TRON", DOT: "Polkadot", LINK: "Chainlink",
  MATIC: "Polygon", LTC: "Litecoin", AVAX: "Avalanche", ATOM: "Cosmos", UNI: "Uniswap",
  NEAR: "NEAR Protocol", APT: "Aptos", ARB: "Arbitrum", OP: "Optimism", INJ: "Injective",
  FIL: "Filecoin", ETC: "Ethereum Classic", XLM: "Stellar", ICP: "Internet Computer",
  HBAR: "Hedera", VET: "VeChain", ALGO: "Algorand", AAVE: "Aave", SUI: "Sui",
  SEI: "Sei", TIA: "Celestia", RNDR: "Render", FET: "Artificial Superintelligence",
  PEPE: "Pepe", SHIB: "Shiba Inu", WIF: "dogwifhat", BONK: "Bonk",
};

/** Uzun olandan kısaya sıralı: "USDT" önce denenmezse "USDC" yanlış ayrışır. */
const QUOTE_ASSETS = ["USDT", "FDUSD", "USDC", "TUSD", "BTC", "ETH", "BNB", "TRY", "EUR"];

export function splitCryptoSymbol(symbol: string): { base: string; quote: string } {
  for (const quote of QUOTE_ASSETS) {
    if (symbol.endsWith(quote) && symbol.length > quote.length) {
      return { base: symbol.slice(0, -quote.length), quote };
    }
  }
  return { base: symbol, quote: "USDT" };
}

export function cryptoInstrument(symbol: string): Instrument {
  const { base, quote } = splitCryptoSymbol(symbol);
  return {
    id: instrumentId("kripto", symbol),
    market: "kripto",
    symbol,
    name: COIN_NAMES[base] ?? base,
    ticker: `${base}/${quote}`,
    currency: quote,
    kind: "kripto",
  };
}

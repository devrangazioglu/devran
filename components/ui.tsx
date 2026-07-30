"use client";

import { useI18n } from "./I18nProvider";
import type { SignalLabel, Verdict } from "@/lib/analysis";
import { formatPercent } from "@/lib/format";
import type { AssetKind, MarketId } from "@/lib/markets/types";

/* ────────────────────────── Varlık ikonu ────────────────────────── */

const KNOWN_COLORS: Record<string, string> = {
  BTC: "#f7931a", ETH: "#7b83eb", BNB: "#f3ba2f", SOL: "#14f195", XRP: "#23292f",
  ADA: "#0033ad", DOGE: "#c3a634", DOT: "#e6007a", LTC: "#a6a9aa", LINK: "#2a5ada",
  AVAX: "#e84142", MATIC: "#8247e5", TRX: "#eb0029", ATOM: "#2e3148",
  XAU: "#d4af37", XAG: "#c0c0c0", WTI: "#3f3f46", BRENT: "#52525b", COPPER: "#b87333",
};

const MARKET_TINT: Record<MarketId, string> = {
  kripto: "#8ff0a4",
  abd: "#60a5fa",
  bist: "#f472b6",
  emtia: "#fbbf24",
};

/** Sembolden deterministik renk üretir. */
export function assetColor(ticker: string, market: MarketId): string {
  const base = ticker.split("/")[0].toUpperCase();
  if (KNOWN_COLORS[base]) return KNOWN_COLORS[base];

  let hash = 0;
  for (let i = 0; i < base.length; i++) hash = (hash * 31 + base.charCodeAt(i)) % 360;
  // Piyasaya göre hafif ton farkı: kripto yeşilden, ABD maviden yana kayar.
  const marketShift: Record<MarketId, number> = { kripto: 120, abd: 215, bist: 330, emtia: 45 };
  const hue = (hash + marketShift[market]) % 360;
  return `hsl(${hue}, 58%, 56%)`;
}

function textColorFor(background: string): string {
  const hex = background.match(/^#([0-9a-f]{6})$/i);
  if (!hex) return "#0b0f16";
  const value = parseInt(hex[1], 16);
  const luminance =
    (0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255)) / 255;
  return luminance > 0.5 ? "#0b0f16" : "#f3f6fb";
}

export function AssetAvatar({
  ticker,
  market,
  size = 28,
}: {
  ticker: string;
  market: MarketId;
  size?: number;
}) {
  const background = assetColor(ticker, market);
  const label = ticker.split("/")[0].slice(0, 4);
  return (
    <span
      className="asset-avatar"
      style={{
        background,
        width: size,
        height: size,
        fontSize: label.length > 3 ? size * 0.3 : size * 0.36,
        color: textColorFor(background),
      }}
      aria-hidden
    >
      {label}
    </span>
  );
}

/* ────────────────────────── Rozetler ────────────────────────── */

export function MarketBadge({ market }: { market: MarketId }) {
  const { t } = useI18n();
  return (
    <span
      className="market-badge"
      style={{ color: MARKET_TINT[market], borderColor: `${MARKET_TINT[market]}55` }}
    >
      {t(`market.${market}` as "market.kripto")}
    </span>
  );
}

export function SignalBadge({ signal }: { signal: SignalLabel }) {
  const { t } = useI18n();
  const tone =
    signal === "STRONG_BUY" || signal === "BUY"
      ? "badge-up"
      : signal === "STRONG_SELL" || signal === "SELL"
        ? "badge-down"
        : "badge-flat";
  return <span className={`badge ${tone}`}>{t(`signal.${signal}` as "signal.BUY")}</span>;
}

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const { t } = useI18n();
  const tone =
    verdict === "BUY" ? "badge-up" : verdict === "SELL" ? "badge-down" : "badge-muted";
  return <span className={`badge ${tone}`}>{t(`verdict.${verdict}` as "verdict.BUY")}</span>;
}

/** Değişim yüzdesi, aktif dile göre biçimlendirilmiş ve renkli. */
export function Change({ value, digits = 2 }: { value: number | null; digits?: number }) {
  const { intl } = useI18n();
  if (value === null || !Number.isFinite(value)) return <span className="dim">—</span>;
  const tone = value > 0 ? "up" : value < 0 ? "down" : "muted";
  return <span className={tone}>{formatPercent(value, intl, digits)}</span>;
}

export function Dots({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span className="dots" aria-label={`${value}/${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={i < value ? "on" : ""} />
      ))}
    </span>
  );
}

/** −100…+100 skorunu yarım daire gösterge olarak çizer. */
export function ScoreGauge({
  score,
  signal,
  size = 168,
}: {
  score: number;
  signal: SignalLabel;
  size?: number;
}) {
  const { t } = useI18n();
  const radius = size / 2 - 12;
  const circumference = Math.PI * radius;
  const ratio = Math.min(Math.max((score + 100) / 200, 0), 1);
  const color =
    signal === "STRONG_BUY" || signal === "BUY"
      ? "var(--up)"
      : signal === "STRONG_SELL" || signal === "SELL"
        ? "var(--down)"
        : "var(--flat)";

  return (
    <div className="gauge" style={{ width: size, height: size / 2 + 26 }}>
      <svg width={size} height={size / 2 + 10} viewBox={`0 0 ${size} ${size / 2 + 10}`}>
        <path
          d={`M 12 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 12} ${size / 2}`}
          fill="none"
          stroke="var(--border)"
          strokeWidth={10}
          strokeLinecap="round"
        />
        <path
          d={`M 12 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 12} ${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${circumference * ratio} ${circumference}`}
          className="gauge-arc"
        />
      </svg>
      <div className="gauge-value" style={{ top: size / 4 }}>
        <b style={{ color }}>{score > 0 ? `+${score}` : score}</b>
        <span>{t("common.score")} (−100 / +100)</span>
      </div>
    </div>
  );
}

export function Meter({ value, tone = "var(--accent)" }: { value: number; tone?: string }) {
  return (
    <div className="meter">
      <i style={{ width: `${Math.min(Math.max(value, 0), 100)}%`, background: tone }} />
    </div>
  );
}

/** Skoru renkli ve işaretli gösterir. */
export function Score({ value }: { value: number }) {
  const tone = value > 0 ? "up" : value < 0 ? "down" : "muted";
  return (
    <span className={`mono ${tone}`}>
      {value > 0 ? `+${value}` : value}
    </span>
  );
}

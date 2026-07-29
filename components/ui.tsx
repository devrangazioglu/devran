import type { SignalLabel, Verdict } from "@/lib/analysis";

/** Sembol harflerinden deterministik bir renk üretir (coin ikonları için). */
export function coinColor(base: string): string {
  const known: Record<string, string> = {
    BTC: "#f7931a",
    ETH: "#7b83eb",
    BNB: "#f3ba2f",
    SOL: "#14f195",
    XRP: "#23292f",
    ADA: "#0033ad",
    DOGE: "#c3a634",
    DOT: "#e6007a",
    LTC: "#a6a9aa",
    LINK: "#2a5ada",
    AVAX: "#e84142",
    MATIC: "#8247e5",
    TRX: "#eb0029",
    ATOM: "#2e3148",
  };
  if (known[base]) return known[base];

  let hash = 0;
  for (let i = 0; i < base.length; i++) hash = (hash * 31 + base.charCodeAt(i)) % 360;
  return `hsl(${hash}, 62%, 58%)`;
}

/** Arka plan koyuysa beyaz, açıksa siyah yazı — okunabilirlik için. */
function textColorFor(background: string): string {
  const hex = background.match(/^#([0-9a-f]{6})$/i);
  if (!hex) return "#0b0f16"; // hsl() renkleri zaten açık tonda üretiliyor
  const value = parseInt(hex[1], 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#0b0f16" : "#f3f6fb";
}

export function CoinAvatar({ base, size = 28 }: { base: string; size?: number }) {
  const background = coinColor(base);
  return (
    <span
      className="coin-avatar"
      style={{
        background,
        width: size,
        height: size,
        fontSize: size <= 24 ? 9 : 10,
        color: textColorFor(background),
      }}
      aria-hidden
    >
      {base.slice(0, 3)}
    </span>
  );
}

export function SignalBadge({ signal }: { signal: SignalLabel }) {
  const tone =
    signal === "GÜÇLÜ AL" || signal === "AL"
      ? "badge-up"
      : signal === "GÜÇLÜ SAT" || signal === "SAT"
        ? "badge-down"
        : "badge-flat";
  return <span className={`badge ${tone}`}>{signal}</span>;
}

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const tone =
    verdict === "AL" ? "badge-up" : verdict === "SAT" ? "badge-down" : "badge-muted";
  return <span className={`badge ${tone}`}>{verdict}</span>;
}

/** Değişim yüzdesini renkli gösterir. */
export function Change({ value, digits = 2 }: { value: number | null; digits?: number }) {
  if (value === null || !Number.isFinite(value)) return <span className="dim">—</span>;
  const tone = value > 0 ? "up" : value < 0 ? "down" : "muted";
  const sign = value > 0 ? "+" : "";
  return (
    <span className={tone}>
      {sign}
      {value.toFixed(digits)}%
    </span>
  );
}

/** 1-5 arası güç göstergesi. */
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
  const radius = size / 2 - 12;
  const circumference = Math.PI * radius; // yarım çember
  const ratio = Math.min(Math.max((score + 100) / 200, 0), 1);
  const color =
    signal === "GÜÇLÜ AL" || signal === "AL"
      ? "var(--up)"
      : signal === "GÜÇLÜ SAT" || signal === "SAT"
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
        />
      </svg>
      <div className="gauge-value" style={{ top: size / 4 }}>
        <b style={{ color }}>{score > 0 ? `+${score}` : score}</b>
        <span>skor (−100 / +100)</span>
      </div>
    </div>
  );
}

/** Yatay oran çubuğu. */
export function Meter({ value, tone = "var(--accent)" }: { value: number; tone?: string }) {
  return (
    <div className="meter">
      <i style={{ width: `${Math.min(Math.max(value, 0), 100)}%`, background: tone }} />
    </div>
  );
}

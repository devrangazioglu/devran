"use client";

/**
 * Bağımlılıksız mum grafiği (canvas).
 * Fiyat paneli + hareketli ortalamalar + Bollinger bantları + hacim şeridi,
 * fare takibiyle (crosshair) OHLC bilgi kutusu.
 */

import { useEffect, useRef, useState } from "react";

import { formatPrice, formatTime } from "@/lib/format";

export type ChartCandle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Overlays = {
  ema21?: (number | null)[];
  ema50?: (number | null)[];
  ema200?: (number | null)[];
  bbUpper?: (number | null)[];
  bbLower?: (number | null)[];
};

const COLORS = {
  up: "#4ade80",
  down: "#f87171",
  grid: "#161f2c",
  text: "#5f6a7d",
  ema21: "#8ff0a4",
  ema50: "#60a5fa",
  ema200: "#f59e0b",
  band: "rgba(139,149,169,0.28)",
};

export default function CandleChart({
  candles,
  overlays,
  height = 380,
  showBands = true,
  intl = "tr-TR",
}: {
  candles: ChartCandle[];
  overlays?: Overlays;
  height?: number;
  showBands?: boolean;
  /** Sayı ve tarih biçimlendirmede kullanılacak Intl etiketi. */
  intl?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [width, setWidth] = useState(900);

  // Kapsayıcı genişliğini izle.
  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(Math.max(entry.contentRect.width, 320));
    });
    observer.observe(element);
    setWidth(Math.max(element.clientWidth, 320));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || candles.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 14, right: 66, bottom: 22, left: 8 };
    const volumeHeight = Math.round(height * 0.16);
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom - volumeHeight - 8;

    // Fiyat aralığı (bantlar dahil).
    let min = Infinity;
    let max = -Infinity;
    for (const c of candles) {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
    }
    if (showBands && overlays?.bbUpper && overlays?.bbLower) {
      for (let i = 0; i < candles.length; i++) {
        const u = overlays.bbUpper[i];
        const l = overlays.bbLower[i];
        if (u !== null && u !== undefined && u > max) max = u;
        if (l !== null && l !== undefined && l < min) min = l;
      }
    }
    const span = max - min || 1;
    min -= span * 0.04;
    max += span * 0.04;

    const x = (i: number) => padding.left + (i + 0.5) * (plotWidth / candles.length);
    const y = (price: number) =>
      padding.top + plotHeight - ((price - min) / (max - min)) * plotHeight;

    // Izgara ve fiyat ekseni
    ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
    ctx.textBaseline = "middle";
    const ticks = 5;
    for (let i = 0; i <= ticks; i++) {
      const price = min + ((max - min) * i) / ticks;
      const py = y(price);
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding.left, Math.round(py) + 0.5);
      ctx.lineTo(width - padding.right, Math.round(py) + 0.5);
      ctx.stroke();
      ctx.fillStyle = COLORS.text;
      ctx.textAlign = "left";
      ctx.fillText(formatPrice(price, intl), width - padding.right + 8, py);
    }

    // Bollinger bantları (dolgu)
    if (showBands && overlays?.bbUpper && overlays?.bbLower) {
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < candles.length; i++) {
        const u = overlays.bbUpper[i];
        if (u === null || u === undefined) continue;
        if (!started) {
          ctx.moveTo(x(i), y(u));
          started = true;
        } else ctx.lineTo(x(i), y(u));
      }
      for (let i = candles.length - 1; i >= 0; i--) {
        const l = overlays.bbLower[i];
        if (l === null || l === undefined) continue;
        ctx.lineTo(x(i), y(l));
      }
      ctx.closePath();
      ctx.fillStyle = "rgba(139,149,169,0.06)";
      ctx.fill();
      ctx.strokeStyle = COLORS.band;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Mumlar
    const slot = plotWidth / candles.length;
    const bodyWidth = Math.max(Math.min(slot * 0.62, 12), 1);
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const up = c.close >= c.open;
      const color = up ? COLORS.up : COLORS.down;
      const cx = x(i);

      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(cx) + 0.5, y(c.high));
      ctx.lineTo(Math.round(cx) + 0.5, y(c.low));
      ctx.stroke();

      const top = y(Math.max(c.open, c.close));
      const bottom = y(Math.min(c.open, c.close));
      ctx.fillStyle = color;
      ctx.fillRect(cx - bodyWidth / 2, top, bodyWidth, Math.max(bottom - top, 1));
    }

    // Hareketli ortalamalar
    const drawLine = (values: (number | null)[] | undefined, color: string) => {
      if (!values) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < candles.length; i++) {
        const v = values[i];
        if (v === null || v === undefined) continue;
        if (!started) {
          ctx.moveTo(x(i), y(v));
          started = true;
        } else ctx.lineTo(x(i), y(v));
      }
      ctx.stroke();
    };
    drawLine(overlays?.ema21, COLORS.ema21);
    drawLine(overlays?.ema50, COLORS.ema50);
    drawLine(overlays?.ema200, COLORS.ema200);

    // Hacim şeridi
    const volumeTop = padding.top + plotHeight + 8;
    const maxVolume = Math.max(...candles.map((c) => c.volume), 1);
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const h = (c.volume / maxVolume) * volumeHeight;
      ctx.fillStyle = c.close >= c.open ? "rgba(74,222,128,0.35)" : "rgba(248,113,113,0.35)";
      ctx.fillRect(x(i) - bodyWidth / 2, volumeTop + volumeHeight - h, bodyWidth, h);
    }

    // Zaman ekseni
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = "center";
    const labelCount = Math.min(6, candles.length);
    for (let i = 0; i < labelCount; i++) {
      const index = Math.round((i * (candles.length - 1)) / (labelCount - 1 || 1));
      // Etiketler kenarlardan taşmasın diye konum sınırlandırılır.
      const cx = Math.min(Math.max(x(index), padding.left + 44), width - padding.right - 44);
      ctx.fillText(formatTime(candles[index].openTime, intl), cx, height - 10);
    }

    // Crosshair
    if (hover !== null && hover >= 0 && hover < candles.length) {
      const cx = x(hover);
      ctx.strokeStyle = "rgba(233,237,245,0.25)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, padding.top);
      ctx.lineTo(cx, volumeTop + volumeHeight);
      ctx.stroke();
      ctx.setLineDash([]);

      const c = candles[hover];
      const cy = y(c.close);
      ctx.fillStyle = "#e9edf5";
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [candles, overlays, width, height, hover, showBands, intl]);

  const handleMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || candles.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const padding = { left: 8, right: 66 };
    const plotWidth = rect.width - padding.left - padding.right;
    const relative = event.clientX - rect.left - padding.left;
    const index = Math.floor((relative / plotWidth) * candles.length);
    setHover(index >= 0 && index < candles.length ? index : null);
  };

  const active = hover !== null ? candles[hover] : candles[candles.length - 1];

  return (
    <div className="chart-shell" ref={wrapRef}>
      <div className="chart-legend">
        <span>
          <i style={{ background: COLORS.ema21 }} />
          EMA 21
        </span>
        <span>
          <i style={{ background: COLORS.ema50 }} />
          EMA 50
        </span>
        <span>
          <i style={{ background: COLORS.ema200 }} />
          EMA 200
        </span>
        {showBands && (
          <span>
            <i style={{ background: "#8b95a9" }} />
            Bollinger (20, 2)
          </span>
        )}
        {active && (
          <span className="mono" style={{ marginLeft: "auto", color: "var(--text)" }}>
            O {formatPrice(active.open, intl)} · H {formatPrice(active.high, intl)} · L{" "}
            {formatPrice(active.low, intl)} · C {formatPrice(active.close, intl)}
          </span>
        )}
      </div>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        style={{ display: "block", cursor: "crosshair" }}
      />
    </div>
  );
}

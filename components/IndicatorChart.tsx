"use client";

/**
 * RSI ve MACD alt panelleri için küçük, bağımlılıksız canvas grafiği.
 *
 * `gorunum` verilirse mum grafiğiyle aynı zaman aralığını gösterir; iki panel
 * farklı aralıklara bakarsa kullanıcı RSI'ı yanlış mumlarla eşleştirir.
 */

import { useEffect, useRef, useState } from "react";

import type { Gorunum } from "./CandleChart";

export type IndicatorLine = {
  values: (number | null)[];
  color: string;
  label: string;
};

export default function IndicatorChart({
  lines,
  histogram,
  height = 120,
  min,
  max,
  guides = [],
  title,
  gorunum = null,
}: {
  lines: IndicatorLine[];
  histogram?: (number | null)[];
  height?: number;
  min?: number;
  max?: number;
  /** Yatay referans çizgileri (RSI için 30/70 gibi). */
  guides?: number[];
  title: string;
  /** Mum grafiğiyle ortak zaman aralığı; null ise tamamı. */
  gorunum?: Gorunum | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);

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
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 10, right: 66, bottom: 8, left: 8 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    // Görünen aralık mum grafiğiyle ortak.
    const dilim = (values: (number | null)[]) =>
      gorunum ? values.slice(gorunum.bas, gorunum.bas + gorunum.adet) : values;
    const gorunenLines = lines.map((line) => ({ ...line, values: dilim(line.values) }));
    const gorunenHistogram = histogram ? dilim(histogram) : undefined;

    const all: number[] = [];
    for (const line of gorunenLines) {
      for (const v of line.values) if (v !== null && v !== undefined) all.push(v);
    }
    if (gorunenHistogram) {
      for (const v of gorunenHistogram) if (v !== null && v !== undefined) all.push(v);
    }
    if (all.length === 0) return;

    const lo = min ?? Math.min(...all);
    const hi = max ?? Math.max(...all);
    const range = hi - lo || 1;
    const count = Math.max(
      ...gorunenLines.map((l) => l.values.length),
      gorunenHistogram?.length ?? 0,
    );

    const x = (i: number) => padding.left + (i + 0.5) * (plotWidth / count);
    const y = (value: number) =>
      padding.top + plotHeight - ((value - lo) / range) * plotHeight;

    ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";

    for (const guide of guides) {
      const gy = y(guide);
      ctx.strokeStyle = "#1b2433";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(padding.left, gy);
      ctx.lineTo(width - padding.right, gy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#5f6a7d";
      ctx.fillText(String(guide), width - padding.right + 8, gy);
    }

    if (gorunenHistogram) {
      const zero = y(Math.max(Math.min(0, hi), lo));
      const barWidth = Math.max(plotWidth / count - 1, 1);
      for (let i = 0; i < gorunenHistogram.length; i++) {
        const v = gorunenHistogram[i];
        if (v === null || v === undefined) continue;
        const py = y(v);
        ctx.fillStyle = v >= 0 ? "rgba(74,222,128,0.5)" : "rgba(248,113,113,0.5)";
        ctx.fillRect(x(i) - barWidth / 2, Math.min(py, zero), barWidth, Math.abs(zero - py) || 1);
      }
    }

    for (const line of gorunenLines) {
      ctx.strokeStyle = line.color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < line.values.length; i++) {
        const v = line.values[i];
        if (v === null || v === undefined) continue;
        if (!started) {
          ctx.moveTo(x(i), y(v));
          started = true;
        } else ctx.lineTo(x(i), y(v));
      }
      ctx.stroke();
    }

    // Son değer etiketi
    const primary = gorunenLines[0];
    const lastValue = [...primary.values].reverse().find((v) => v !== null && v !== undefined);
    if (lastValue !== undefined && lastValue !== null) {
      ctx.fillStyle = primary.color;
      ctx.fillText(lastValue.toFixed(2), width - padding.right + 8, y(lastValue));
    }
  }, [lines, histogram, width, height, min, max, guides, gorunum]);

  return (
    <div className="chart-shell" ref={wrapRef} style={{ padding: 14 }}>
      <div className="chart-legend" style={{ marginBottom: 6 }}>
        <strong style={{ color: "var(--text)", fontWeight: 500 }}>{title}</strong>
        {lines.map((line) => (
          <span key={line.label}>
            <i style={{ background: line.color }} />
            {line.label}
          </span>
        ))}
      </div>
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}

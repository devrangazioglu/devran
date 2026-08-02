"use client";

/**
 * Fareye göre hareket eden kart: imlecin bulunduğu noktada bir parlaklık
 * oluşur ve kart hafifçe eğilir. Dokunmatik cihazlarda ve
 * `prefers-reduced-motion` açıkken sabit kalır.
 */

import { useRef } from "react";

export default function SpotlightCard({
  children,
  className = "",
  tilt = true,
}: {
  children: React.ReactNode;
  className?: string;
  tilt?: boolean;
}) {
  const card = useRef<HTMLDivElement>(null);

  function handleMove(event: React.PointerEvent<HTMLDivElement>) {
    const node = card.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover)").matches) return;

    const rect = node.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    node.style.setProperty("--sx", `${x}px`);
    node.style.setProperty("--sy", `${y}px`);

    if (tilt) {
      const rotateY = ((x - rect.width / 2) / rect.width) * 6;
      const rotateX = ((rect.height / 2 - y) / rect.height) * 6;
      node.style.setProperty("--rx", `${rotateX.toFixed(2)}deg`);
      node.style.setProperty("--ry", `${rotateY.toFixed(2)}deg`);
    }
  }

  function reset() {
    const node = card.current;
    if (!node) return;
    node.style.setProperty("--rx", "0deg");
    node.style.setProperty("--ry", "0deg");
  }

  return (
    <div
      ref={card}
      className={`spotlight ${tilt ? "spotlight-tilt" : ""} ${className}`.trim()}
      onPointerMove={handleMove}
      onPointerLeave={reset}
    >
      {children}
    </div>
  );
}

"use client";

/**
 * Hareketli arka plan: yavaşça süzülen ışık lekeleri ve fareyi takip eden bir
 * parlaklık. Fare konumu CSS değişkenlerine yazılır, animasyon CSS tarafında
 * çalışır (React yeniden çizim yapmaz).
 *
 * `prefers-reduced-motion` açıksa hareket devre dışı kalır.
 */

import { useEffect, useRef } from "react";

export default function Aurora() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Dokunmatik cihazlarda fare takibi anlamsız; pil de tüketmesin.
    if (!window.matchMedia("(hover: hover)").matches) return;

    let frame = 0;
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 3;
    let currentX = targetX;
    let currentY = targetY;

    const onMove = (event: PointerEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;
    };

    const tick = () => {
      // Yumuşak takip (lerp) — imleçten biraz geride kalır, daha organik durur.
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;
      element.style.setProperty("--mx", `${currentX.toFixed(1)}px`);
      element.style.setProperty("--my", `${currentY.toFixed(1)}px`);
      frame = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    frame = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="aurora" ref={root} aria-hidden>
      <span className="aurora-blob aurora-1" />
      <span className="aurora-blob aurora-2" />
      <span className="aurora-blob aurora-3" />
      <span className="aurora-grid" />
      <span className="aurora-cursor" />
    </div>
  );
}

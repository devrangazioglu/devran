"use client";

/**
 * Bağımlılıksız mum grafiği (canvas).
 *
 * Fiyat paneli + hareketli ortalamalar + Bollinger bantları + hacim şeridi,
 * fare takibiyle (crosshair) OHLC bilgi kutusu.
 *
 * Yakınlaştırma iki eksende ayrı çalışır:
 *   • **Yatay** (zaman) — kaç mumun göründüğünü belirler. Tekerlek, iki
 *     parmakla yatay sıkıştırma, düğmeler ve sürükleyerek kaydırma.
 *   • **Dikey** (fiyat) — görünen fiyat aralığını daraltır. Dar aralıklı bir
 *     bölgede mumlar tek çizgiye dönüştüğü için gerekli; Shift+tekerlek, iki
 *     parmakla dikey sıkıştırma ve düğmelerle çalışır.
 *
 * Görünen pencere yukarıdan yönetilebilir (`gorunum` + `onGorunum`); böylece
 * RSI ve MACD panelleri aynı zaman aralığını gösterir — grafiklerin farklı
 * aralıklara bakması yorumu tümüyle yanıltır.
 */

import { useCallback, useEffect, useRef, useState } from "react";

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

/** Görünen mum aralığı: `bas` ilk mumun sırası, `adet` kaç mum görüldüğü. */
export type Gorunum = { bas: number; adet: number };

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

/** Ekranda anlamlı kalan en az mum sayısı. */
const EN_AZ_MUM = 8;
/** Dikey yakınlaştırmanın sınırı; fazlası mumları ekrandan taşırır. */
const EN_FAZLA_DIKEY = 20;

/**
 * Tek bir tam tekerlek çentiğinin (100 piksel) değiştirdiği oran.
 *
 * Küçük tutuldu: yakınlaştırma "hassas" olduğunda kullanıcı istediği aralığı
 * yakalayamıyor, her hareket ya çok az ya çok fazla geliyordu. %8 ile bir
 * çentik gözle takip edilebilir, üst üste çevirmek hızlıca yaklaştırıyor.
 */
const TEKERLEK_ADIMI = 0.08;

/** Düğmelerin adımı: bir tıkta görünen aralık bu oranda değişir. */
const DUGME_YATAY = 0.8;
const DUGME_DIKEY = 1.25;

/** İki parmak hareketinin sönümü; ham oran uygulanırsa zoom fırlıyor. */
const PARMAK_SONUM = 0.45;

const PADDING = { top: 14, right: 66, bottom: 22, left: 8 };

function sinirla(deger: number, alt: number, ust: number): number {
  return Math.max(alt, Math.min(ust, deger));
}

export default function CandleChart({
  candles,
  overlays,
  height = 380,
  showBands = true,
  intl = "tr-TR",
  gorunum = null,
  onGorunum,
  etiketler,
}: {
  candles: ChartCandle[];
  overlays?: Overlays;
  height?: number;
  showBands?: boolean;
  /** Sayı ve tarih biçimlendirmede kullanılacak Intl etiketi. */
  intl?: string;
  /** Görünen zaman aralığı; null ise tamamı. */
  gorunum?: Gorunum | null;
  onGorunum?: (gorunum: Gorunum | null) => void;
  /** Düğme ve ipucu metinleri (çeviri arayüzden gelir). */
  etiketler?: {
    yatay: string;
    dikey: string;
    sifirla: string;
    yakinlastir: string;
    uzaklastir: string;
    ipucu: string;
  };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [width, setWidth] = useState(900);

  // Dikey yakınlaştırma yalnızca bu grafiği ilgilendirir; yukarı taşınmaz.
  const [dikey, setDikey] = useState({ olcek: 1, kaydir: 0 });

  const toplam = candles.length;
  const bas = gorunum ? sinirla(gorunum.bas, 0, Math.max(toplam - EN_AZ_MUM, 0)) : 0;
  const adet = gorunum ? sinirla(gorunum.adet, EN_AZ_MUM, toplam - bas) : toplam;
  const gorunen = candles.slice(bas, bas + adet);

  /** Zaman aralığını değiştirir; sınırları burada tek yerde korunur. */
  const pencereyiAyarla = useCallback(
    (yeniBas: number, yeniAdet: number) => {
      if (!onGorunum) return;
      const kapsam = sinirla(Math.round(yeniAdet), EN_AZ_MUM, toplam);
      const baslangic = sinirla(Math.round(yeniBas), 0, toplam - kapsam);
      // Tamamı görünüyorsa "yakınlaştırma yok" durumuna dönülür.
      onGorunum(kapsam >= toplam ? null : { bas: baslangic, adet: kapsam });
    },
    [onGorunum, toplam],
  );

  const sifirla = useCallback(() => {
    onGorunum?.(null);
    setDikey({ olcek: 1, kaydir: 0 });
  }, [onGorunum]);

  /** Yatay yakınlaştırma; `capa` 0–1 arası, imlecin bulunduğu oran. */
  const yataySeviye = useCallback(
    (carpan: number, capa = 0.5) => {
      const yeniAdet = sinirla(adet * carpan, EN_AZ_MUM, toplam);
      // İmlecin altındaki mum yerinde kalsın.
      const merkez = bas + adet * capa;
      pencereyiAyarla(merkez - yeniAdet * capa, yeniAdet);
    },
    [adet, bas, toplam, pencereyiAyarla],
  );

  const dikeySeviye = useCallback((carpan: number) => {
    setDikey((onceki) => ({
      ...onceki,
      olcek: sinirla(onceki.olcek * carpan, 1, EN_FAZLA_DIKEY),
    }));
  }, []);

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

  /* ────────────────── Fare tekerleği ve dokunma ────────────────── */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // React'in onWheel'i edilgen (passive) olduğu için sayfayı kaydırmayı
    // engelleyemiyor; dinleyici elle, passive:false ile bağlanır.
    const tekerlek = (event: WheelEvent) => {
      event.preventDefault();

      // Adım, tekerleğin gerçekten ne kadar çevrildiğiyle orantılı olmalı.
      // Sabit oran kullanıldığında dokunmatik yüzeyler sorun oluyordu: tek bir
      // kaydırmada onlarca küçük olay gönderdikleri için grafik bir anda
      // sonuna kadar yakınlaşıyordu. Delta önce piksele çevrilir (satır/sayfa
      // kipi tarayıcıya göre değişir), sonra bir üst sınırla ölçeklenir.
      const piksel =
        event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * 400 : event.deltaY;
      const adim = Math.min(Math.abs(piksel) / 100, 1) * TEKERLEK_ADIMI;
      if (adim < 0.001) return;
      const carpan = piksel < 0 ? 1 - adim : 1 + adim;

      if (event.shiftKey || event.ctrlKey) {
        dikeySeviye(1 / carpan);
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const plotWidth = rect.width - PADDING.left - PADDING.right;
      const capa = sinirla((event.clientX - rect.left - PADDING.left) / plotWidth, 0, 1);
      yataySeviye(carpan, capa);
    };

    canvas.addEventListener("wheel", tekerlek, { passive: false });
    return () => canvas.removeEventListener("wheel", tekerlek);
  }, [yataySeviye, dikeySeviye]);

  // İki parmak: yatay açıklık zamanı, dikey açıklık fiyatı ölçekler.
  const dokunusRef = useRef<{ dx: number; dy: number } | null>(null);
  // Tek parmak / fare sürüklemesi: kaydırma.
  const surukleRef = useRef<{ x: number; y: number; bas: number; kaydir: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const mesafe = (touches: TouchList) => ({
      dx: Math.abs(touches[0].clientX - touches[1].clientX),
      dy: Math.abs(touches[0].clientY - touches[1].clientY),
    });

    const basla = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        dokunusRef.current = mesafe(event.touches);
        event.preventDefault();
      } else if (event.touches.length === 1) {
        surukleRef.current = {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY,
          bas,
          kaydir: dikey.kaydir,
        };
      }
    };

    const hareket = (event: TouchEvent) => {
      if (event.touches.length === 2 && dokunusRef.current) {
        event.preventDefault();
        const simdi = mesafe(event.touches);
        const onceki = dokunusRef.current;
        // Yatay açıklık belirgin şekilde değiştiyse zamanı, dikey değiştiyse
        // fiyatı ölçekle. İkisi birden olabilir (çapraz sıkıştırma).
        // Oran doğrudan uygulanmaz: parmak hareketi çok sık olay ürettiği için
        // sönümlenir, yoksa küçük bir sıkıştırma grafiği uca götürüyor.
        const sonumle = (oran: number) => 1 + (oran - 1) * PARMAK_SONUM;
        if (onceki.dx > 30 && Math.abs(simdi.dx - onceki.dx) > 8) {
          yataySeviye(sonumle(onceki.dx / simdi.dx));
        }
        if (onceki.dy > 30 && Math.abs(simdi.dy - onceki.dy) > 8) {
          dikeySeviye(sonumle(simdi.dy / onceki.dy));
        }
        dokunusRef.current = simdi;
        return;
      }

      if (event.touches.length === 1 && surukleRef.current && gorunum) {
        const rect = canvas.getBoundingClientRect();
        const plotWidth = rect.width - PADDING.left - PADDING.right;
        const kaydiMum = ((surukleRef.current.x - event.touches[0].clientX) / plotWidth) * adet;
        pencereyiAyarla(surukleRef.current.bas + kaydiMum, adet);
        event.preventDefault();
      }
    };

    const bitir = () => {
      dokunusRef.current = null;
      surukleRef.current = null;
    };

    canvas.addEventListener("touchstart", basla, { passive: false });
    canvas.addEventListener("touchmove", hareket, { passive: false });
    canvas.addEventListener("touchend", bitir);
    canvas.addEventListener("touchcancel", bitir);
    return () => {
      canvas.removeEventListener("touchstart", basla);
      canvas.removeEventListener("touchmove", hareket);
      canvas.removeEventListener("touchend", bitir);
      canvas.removeEventListener("touchcancel", bitir);
    };
  }, [adet, bas, dikey.kaydir, gorunum, yataySeviye, dikeySeviye, pencereyiAyarla]);

  /* ────────────────────────── Çizim ────────────────────────── */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || gorunen.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const volumeHeight = Math.round(height * 0.16);
    const plotWidth = width - PADDING.left - PADDING.right;
    const plotHeight = height - PADDING.top - PADDING.bottom - volumeHeight - 8;

    const dilim = <T,>(values: T[] | undefined) => values?.slice(bas, bas + adet);
    const bbUpper = dilim(overlays?.bbUpper);
    const bbLower = dilim(overlays?.bbLower);

    // Fiyat aralığı yalnızca görünen mumlardan hesaplanır: yatay
    // yakınlaştırma böylece dikeyi de kendiliğinden büyütür.
    let min = Infinity;
    let max = -Infinity;
    for (const c of gorunen) {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
    }
    if (showBands && bbUpper && bbLower) {
      for (let i = 0; i < gorunen.length; i++) {
        const u = bbUpper[i];
        const l = bbLower[i];
        if (u !== null && u !== undefined && u > max) max = u;
        if (l !== null && l !== undefined && l < min) min = l;
      }
    }
    const span = max - min || Math.abs(max) * 0.01 || 1;
    min -= span * 0.04;
    max += span * 0.04;

    // Dikey yakınlaştırma: aralığı merkez etrafında daralt, kaydırmayı uygula.
    const merkez = (min + max) / 2 + dikey.kaydir * (max - min);
    const yari = (max - min) / 2 / dikey.olcek;
    min = merkez - yari;
    max = merkez + yari;

    const x = (i: number) => PADDING.left + (i + 0.5) * (plotWidth / gorunen.length);
    const y = (price: number) =>
      PADDING.top + plotHeight - ((price - min) / (max - min)) * plotHeight;

    // Görünür alanın dışına taşan çizimleri kırp (dikey yakınlaştırmada şart).
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, PADDING.top - 6, width - PADDING.right, plotHeight + 12);
    ctx.clip();

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
      ctx.moveTo(PADDING.left, Math.round(py) + 0.5);
      ctx.lineTo(width - PADDING.right, Math.round(py) + 0.5);
      ctx.stroke();
    }

    // Bollinger bantları (dolgu)
    if (showBands && bbUpper && bbLower) {
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < gorunen.length; i++) {
        const u = bbUpper[i];
        if (u === null || u === undefined) continue;
        if (!started) {
          ctx.moveTo(x(i), y(u));
          started = true;
        } else ctx.lineTo(x(i), y(u));
      }
      for (let i = gorunen.length - 1; i >= 0; i--) {
        const l = bbLower[i];
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
    const slot = plotWidth / gorunen.length;
    const bodyWidth = Math.max(Math.min(slot * 0.62, 26), 1);
    for (let i = 0; i < gorunen.length; i++) {
      const c = gorunen[i];
      const up = c.close >= c.open;
      const color = up ? COLORS.up : COLORS.down;
      const cx = x(i);

      ctx.strokeStyle = color;
      ctx.lineWidth = slot > 6 ? 1.4 : 1;
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
      for (let i = 0; i < gorunen.length; i++) {
        const v = values[i];
        if (v === null || v === undefined) continue;
        if (!started) {
          ctx.moveTo(x(i), y(v));
          started = true;
        } else ctx.lineTo(x(i), y(v));
      }
      ctx.stroke();
    };
    drawLine(dilim(overlays?.ema21), COLORS.ema21);
    drawLine(dilim(overlays?.ema50), COLORS.ema50);
    drawLine(dilim(overlays?.ema200), COLORS.ema200);

    ctx.restore();

    // Fiyat etiketleri kırpma alanının dışında yazılır.
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = "left";
    for (let i = 0; i <= ticks; i++) {
      const price = min + ((max - min) * i) / ticks;
      ctx.fillText(formatPrice(price, intl), width - PADDING.right + 8, y(price));
    }

    // Hacim şeridi
    const volumeTop = PADDING.top + plotHeight + 8;
    const maxVolume = Math.max(...gorunen.map((c) => c.volume), 1);
    for (let i = 0; i < gorunen.length; i++) {
      const c = gorunen[i];
      const h = (c.volume / maxVolume) * volumeHeight;
      ctx.fillStyle = c.close >= c.open ? "rgba(74,222,128,0.35)" : "rgba(248,113,113,0.35)";
      ctx.fillRect(x(i) - bodyWidth / 2, volumeTop + volumeHeight - h, bodyWidth, h);
    }

    // Zaman ekseni
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = "center";
    const labelCount = Math.min(6, gorunen.length);
    for (let i = 0; i < labelCount; i++) {
      const index = Math.round((i * (gorunen.length - 1)) / (labelCount - 1 || 1));
      // Etiketler kenarlardan taşmasın diye konum sınırlandırılır.
      const cx = Math.min(Math.max(x(index), PADDING.left + 44), width - PADDING.right - 44);
      ctx.fillText(formatTime(gorunen[index].openTime, intl), cx, height - 10);
    }

    // Crosshair
    if (hover !== null && hover >= 0 && hover < gorunen.length) {
      const cx = x(hover);
      ctx.strokeStyle = "rgba(233,237,245,0.25)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, PADDING.top);
      ctx.lineTo(cx, volumeTop + volumeHeight);
      ctx.stroke();
      ctx.setLineDash([]);

      const c = gorunen[hover];
      const cy = y(c.close);
      if (cy > PADDING.top && cy < PADDING.top + plotHeight) {
        ctx.fillStyle = "#e9edf5";
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [gorunen, overlays, width, height, hover, showBands, intl, bas, adet, dikey]);

  /* ────────────────────────── Fare ────────────────────────── */

  const indeksBul = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas || gorunen.length === 0) return null;
    const rect = canvas.getBoundingClientRect();
    const plotWidth = rect.width - PADDING.left - PADDING.right;
    const index = Math.floor(((clientX - rect.left - PADDING.left) / plotWidth) * gorunen.length);
    return index >= 0 && index < gorunen.length ? index : null;
  };

  const handleMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    // Sürükleme sırasında imleci takip etmek yerine grafiği kaydır.
    if (surukleRef.current && event.buttons === 1) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const plotWidth = rect.width - PADDING.left - PADDING.right;
      const plotHeight = height - PADDING.top - PADDING.bottom;
      const kaydiMum = ((surukleRef.current.x - event.clientX) / plotWidth) * adet;
      if (gorunum) pencereyiAyarla(surukleRef.current.bas + kaydiMum, adet);
      if (dikey.olcek > 1) {
        const oran = (event.clientY - surukleRef.current.y) / plotHeight;
        setDikey((onceki) => ({
          ...onceki,
          kaydir: sinirla(surukleRef.current!.kaydir + oran / onceki.olcek, -0.9, 0.9),
        }));
      }
      return;
    }
    setHover(indeksBul(event.clientX));
  };

  const active = hover !== null ? gorunen[hover] : gorunen[gorunen.length - 1];
  const yakinlasti = Boolean(gorunum) || dikey.olcek > 1;

  const metin = etiketler ?? {
    yatay: "Zaman",
    dikey: "Fiyat",
    sifirla: "Sıfırla",
    yakinlastir: "Yakınlaştır",
    uzaklastir: "Uzaklaştır",
    ipucu: "Tekerlek: zaman · Shift+tekerlek: fiyat · sürükle: kaydır",
  };

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

      {/* Yakınlaştırma denetimleri: dokunmatik cihazda ve klavyeyle
          gezinenler için tekerlek/parmak hareketlerinin karşılığı. */}
      <div className="chart-zoom">
        <span className="chart-zoom-group" aria-label={metin.yatay}>
          <b>{metin.yatay}</b>
          <button onClick={() => yataySeviye(1 / DUGME_YATAY)} title={`${metin.uzaklastir} · ${metin.yatay}`}>
            −
          </button>
          <button onClick={() => yataySeviye(DUGME_YATAY)} title={`${metin.yakinlastir} · ${metin.yatay}`}>
            +
          </button>
        </span>
        <span className="chart-zoom-group" aria-label={metin.dikey}>
          <b>{metin.dikey}</b>
          <button onClick={() => dikeySeviye(1 / DUGME_DIKEY)} title={`${metin.uzaklastir} · ${metin.dikey}`}>
            −
          </button>
          <button onClick={() => dikeySeviye(DUGME_DIKEY)} title={`${metin.yakinlastir} · ${metin.dikey}`}>
            +
          </button>
        </span>
        {yakinlasti && (
          <button className="chart-zoom-reset" onClick={sifirla}>
            ⟲ {metin.sifirla}
          </button>
        )}
        <span className="chart-zoom-hint">{metin.ipucu}</span>
      </div>

      <canvas
        ref={canvasRef}
        onMouseMove={handleMove}
        onMouseLeave={() => {
          setHover(null);
          surukleRef.current = null;
        }}
        onMouseDown={(event) => {
          surukleRef.current = { x: event.clientX, y: event.clientY, bas, kaydir: dikey.kaydir };
        }}
        onMouseUp={() => {
          surukleRef.current = null;
        }}
        onDoubleClick={sifirla}
        // pan-y: sayfa dikey kaydırması çalışmaya devam eder, yatay
        // sürükleme ve iki parmak hareketi grafiğe kalır.
        style={{ display: "block", cursor: yakinlasti ? "grab" : "crosshair", touchAction: "pan-y" }}
      />
    </div>
  );
}

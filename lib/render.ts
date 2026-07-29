// Client-side compositing: paints translated text over the original page,
// disturbing as few pixels as possible.

export type PageItem = {
  box: [number, number, number, number]; // ymin, xmin, ymax, xmax (0-1000)
  text: string;
  /** Source text, used to leave unchanged lines completely untouched. */
  original?: string;
  color: string;
  bold?: boolean;
};

type Rect = { x: number; y: number; w: number; h: number };

const PAD_X = 2;

/** Detected boxes hug the glyphs, so descenders and underlines can sit just
 *  below them. Pad vertically in proportion to the line height. */
const padY = (h: number) => Math.max(2, Math.round(h * 0.14));

const clamp = (v: number, max: number) => Math.max(0, Math.min(max - 1, v));

/**
 * Repaints the line's rectangle by interpolating, row by row, between the
 * pixels just outside its left and right edges. A flat background comes back
 * flat; gradients, tinted panels and table fills survive instead of being
 * flattened to one averaged colour.
 */
function coverRect(
  ctx: CanvasRenderingContext2D,
  src: CanvasRenderingContext2D,
  { x, y, w, h }: Rect,
) {
  const canvas = ctx.canvas;
  const py = padY(h);
  const x0 = Math.max(0, Math.floor(x - PAD_X));
  const y0 = Math.max(0, Math.floor(y - py));
  const w0 = Math.min(canvas.width - x0, Math.ceil(w + PAD_X * 2));
  const h0 = Math.min(canvas.height - y0, Math.ceil(h + py * 2));
  if (w0 <= 0 || h0 <= 0) return;

  const leftX = clamp(x0 - PAD_X - 1, canvas.width);
  const rightX = clamp(x0 + w0 + PAD_X, canvas.width);
  const left = src.getImageData(leftX, y0, 1, h0).data;
  const right = src.getImageData(rightX, y0, 1, h0).data;

  const patch = ctx.createImageData(w0, h0);
  for (let row = 0; row < h0; row++) {
    const lr = left[row * 4];
    const lg = left[row * 4 + 1];
    const lb = left[row * 4 + 2];
    const rr = right[row * 4];
    const rg = right[row * 4 + 1];
    const rb = right[row * 4 + 2];
    for (let col = 0; col < w0; col++) {
      const ratio = w0 === 1 ? 0 : col / (w0 - 1);
      const i = (row * w0 + col) * 4;
      patch.data[i] = lr + (rr - lr) * ratio;
      patch.data[i + 1] = lg + (rg - lg) * ratio;
      patch.data[i + 2] = lb + (rb - lb) * ratio;
      patch.data[i + 3] = 255;
    }
  }
  ctx.putImageData(patch, x0, y0);
}

/** Normalizes for the "did this line actually change?" comparison. */
function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

export function renderTranslatedPage(
  source: HTMLCanvasElement,
  items: PageItem[],
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext("2d")!;
  ctx.drawImage(source, 0, 0);

  const src = source.getContext("2d", { willReadFrequently: true })!;

  // Lines whose translation matches the source (numbers, names, codes, URLs)
  // are left exactly as they were — no cover, no repaint.
  const changed = items.filter(
    (it) =>
      it.text.trim().length > 0 &&
      (!it.original || normalize(it.original) !== normalize(it.text)),
  );

  const rects: Rect[] = changed.map(({ box }) => {
    const [ymin, xmin, ymax, xmax] = box;
    return {
      x: (xmin / 1000) * out.width,
      y: (ymin / 1000) * out.height,
      w: ((xmax - xmin) / 1000) * out.width,
      h: ((ymax - ymin) / 1000) * out.height,
    };
  });

  // Cover every line first, so a neighbouring line's glyphs are never
  // sampled as background.
  rects.forEach((rect) => coverRect(ctx, src, rect));

  changed.forEach((item, i) => {
    const { x, y, w, h } = rects[i];
    if (w <= 0 || h <= 0) return;

    const weight = item.bold ? "600 " : "";
    let size = h * 0.78;
    ctx.font = `${weight}${size}px Inter, Arial, sans-serif`;

    // Shrink to fit the original line's width, but never below legibility.
    const measured = ctx.measureText(item.text).width;
    if (measured > w && measured > 0) {
      size = Math.max(6, size * (w / measured));
      ctx.font = `${weight}${size}px Inter, Arial, sans-serif`;
    }

    // A line centred on the page stays centred; everything else keeps its
    // left edge, which is what body text and list items need.
    const centre = x + w / 2;
    const pageCentre = out.width / 2;
    const isCentred =
      Math.abs(centre - pageCentre) < out.width * 0.05 && w < out.width * 0.8;

    ctx.fillStyle = item.color || "#111111";
    ctx.textBaseline = "middle";
    ctx.textAlign = isCentred ? "center" : "left";
    ctx.fillText(item.text, isCentred ? centre : x, y + h / 2, w);
  });

  ctx.textAlign = "left";
  return out;
}

export function canvasToBase64Png(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/png").split(",")[1];
}

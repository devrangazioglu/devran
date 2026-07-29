// Client-side compositing: paints translated text over the original page image,
// covering each detected line with a background patch sampled around its box.

export type PageItem = {
  box: [number, number, number, number]; // ymin, xmin, ymax, xmax (0-1000)
  text: string;
  color: string;
};

function sampleBackground(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): string {
  // Sample a ring of pixels just outside the box; use the median channel values
  // so stray dark pixels (neighboring glyphs) don't skew the patch color.
  const canvas = ctx.canvas;
  const pad = 3;
  const points: [number, number][] = [];
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max - 1, v));

  for (let i = 0; i <= 10; i++) {
    const px = clamp(x + (w * i) / 10, canvas.width);
    points.push([px, clamp(y - pad, canvas.height)]);
    points.push([px, clamp(y + h + pad, canvas.height)]);
  }
  for (let i = 0; i <= 4; i++) {
    const py = clamp(y + (h * i) / 4, canvas.height);
    points.push([clamp(x - pad, canvas.width), py]);
    points.push([clamp(x + w + pad, canvas.width), py]);
  }

  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (const [px, py] of points) {
    const d = ctx.getImageData(px, py, 1, 1).data;
    rs.push(d[0]);
    gs.push(d[1]);
    bs.push(d[2]);
  }
  const median = (arr: number[]) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  return `rgb(${median(rs)}, ${median(gs)}, ${median(bs)})`;
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

  const srcCtx = source.getContext("2d", { willReadFrequently: true })!;

  // 1. Cover all original text lines first
  const boxes = items.map(({ box }) => {
    const [ymin, xmin, ymax, xmax] = box;
    const x = (xmin / 1000) * out.width;
    const y = (ymin / 1000) * out.height;
    const w = ((xmax - xmin) / 1000) * out.width;
    const h = ((ymax - ymin) / 1000) * out.height;
    return { x, y, w, h, bg: sampleBackground(srcCtx, x, y, w, h) };
  });

  boxes.forEach(({ x, y, w, h, bg }) => {
    ctx.fillStyle = bg;
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  });

  // 2. Draw the translated lines fitted into their boxes
  items.forEach(({ text, color }, i) => {
    const { x, y, w, h } = boxes[i];
    let size = h * 0.82;
    ctx.font = `${size}px Inter, Arial, sans-serif`;
    const measured = ctx.measureText(text).width;
    if (measured > w && measured > 0) {
      size = Math.max(7, size * (w / measured));
      ctx.font = `${size}px Inter, Arial, sans-serif`;
    }
    ctx.fillStyle = color || "#111111";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y + h / 2 + size * 0.04);
  });

  return out;
}

export function canvasToBase64Png(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/png").split(",")[1];
}

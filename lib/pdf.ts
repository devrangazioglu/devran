// Client-side PDF helpers. Pages are rendered on demand and released as soon
// as they are encoded, so a long document never holds every page bitmap in
// memory at once (a 33-page file at render scale would otherwise be ~500 MB).

export type PageImage = {
  bytes: Uint8Array;
  width: number;
  height: number;
};

export type OpenPdf = {
  numPages: number;
  renderPage(pageNumber: number, scale?: number): Promise<HTMLCanvasElement>;
  close(): Promise<void>;
};

export async function openPdf(data: ArrayBuffer): Promise<OpenPdf> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const doc = await pdfjs.getDocument({ data }).promise;

  return {
    numPages: doc.numPages,
    async renderPage(pageNumber: number, scale = 2) {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      page.cleanup();
      return canvas;
    },
    async close() {
      await doc.cleanup();
    },
  };
}

/** Frees the backing bitmap of a canvas we are done with. */
export function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

/** Downscales a page for detection; boxes come back normalized, so the
 *  smaller image maps onto the full-resolution page unchanged. */
export function downscaleForDetection(
  canvas: HTMLCanvasElement,
  maxEdge = 1500,
): HTMLCanvasElement {
  const longEdge = Math.max(canvas.width, canvas.height);
  if (longEdge <= maxEdge) return canvas;

  const ratio = maxEdge / longEdge;
  const small = document.createElement("canvas");
  small.width = Math.round(canvas.width * ratio);
  small.height = Math.round(canvas.height * ratio);
  const ctx = small.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, small.width, small.height);
  return small;
}

export function canvasToJpeg(
  canvas: HTMLCanvasElement,
  quality = 0.9,
): Promise<PageImage> {
  const { width, height } = canvas;
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not encode page."));
          return;
        }
        blob
          .arrayBuffer()
          .then((buf) =>
            resolve({ bytes: new Uint8Array(buf), width, height }),
          )
          .catch(reject);
      },
      "image/jpeg",
      quality,
    );
  });
}

export async function pageImagesToPdf(pages: PageImage[]): Promise<Blob> {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();

  for (const { bytes, width, height } of pages) {
    const image = await pdf.embedJpg(bytes);
    const page = pdf.addPage([width / 2, height / 2]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: width / 2,
      height: height / 2,
    });
  }

  const out = await pdf.save();
  return new Blob([out as unknown as BlobPart], { type: "application/pdf" });
}

export async function imageFileToCanvas(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d")!.drawImage(img, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Runs `task` over indices 0..count-1 with at most `limit` in flight. */
export async function runPool(
  count: number,
  limit: number,
  task: (index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, count) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= count) return;
      await task(index);
    }
  });
  await Promise.all(workers);
}

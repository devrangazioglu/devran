// Client-side PDF helpers: rasterize PDF pages to canvases (pdf.js) and
// assemble translated page canvases back into a downloadable PDF (pdf-lib).

export async function pdfToCanvases(
  data: ArrayBuffer,
  onCount?: (total: number) => void,
): Promise<HTMLCanvasElement[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const doc = await pdfjs.getDocument({ data }).promise;
  onCount?.(doc.numPages);

  const canvases: HTMLCanvasElement[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    canvases.push(canvas);
  }
  await doc.cleanup();
  return canvases;
}

export async function canvasesToPdf(
  canvases: HTMLCanvasElement[],
): Promise<Blob> {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();

  for (const canvas of canvases) {
    const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const jpegBytes = Uint8Array.from(atob(jpegDataUrl.split(",")[1]), (c) =>
      c.charCodeAt(0),
    );
    const image = await pdf.embedJpg(jpegBytes);
    const page = pdf.addPage([canvas.width / 2, canvas.height / 2]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: canvas.width / 2,
      height: canvas.height / 2,
    });
  }

  const bytes = await pdf.save();
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
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

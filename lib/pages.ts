// Prompt and response parsing for page translation, shared by every provider.

export type PageItem = {
  box: [number, number, number, number]; // ymin, xmin, ymax, xmax (0-1000)
  text: string;
  original?: string;
  color: string;
  bold?: boolean;
};

export function buildPagePrompt(
  sourceLang: string,
  targetLang: string,
  pageCount: number,
): string {
  const sourceNote =
    sourceLang === "Auto Detect"
      ? "Detect the source language automatically."
      : `The source language is ${sourceLang}.`;

  return [
    `You are given ${pageCount} image${pageCount > 1 ? "s" : ""}, each one page of a document, in order. ${sourceNote}`,
    `For EVERY page, detect every visual LINE of text.`,
    ``,
    `Return a JSON object shaped exactly like this:`,
    `{"pages": [[{"box_2d": [ymin, xmin, ymax, xmax], "src": "...", "translated": "...", "color": "#222222", "bold": false}]]}`,
    ``,
    `- "pages" must contain exactly ${pageCount} array${pageCount > 1 ? "s" : ""}, one per input image, in the same order.`,
    `- "box_2d" is normalized to 0-1000 relative to that page, tightly around the line: top, left, bottom, right.`,
    `- "src" is the line exactly as it appears in the image.`,
    `- "translated" is that line in grammatically correct, natural, fluent ${targetLang}.`,
    `- "color" is the approximate text color as a hex string.`,
    `- "bold" is true only when the line is visibly heavier than body text.`,
    ``,
    `Rules:`,
    `- One object per visual line, in reading order. Never merge multiple lines into one object.`,
    `- Keep proper nouns, numbers, dates, codes and email/web addresses unchanged. When a whole line needs no change, repeat it verbatim in "translated".`,
    `- Preserve leading bullet or numbering characters (•, -, 1., a)) in the translated text.`,
    `- Skip anything that is not text (logos, pictures, decorations).`,
    `- A page with no text becomes an empty array, but it must still be present.`,
    `- Keep translations tight; they are drawn back into the original line's width.`,
    ``,
    `Return ONLY the JSON object.`,
  ].join("\n");
}

/** JSON Schema for providers that support strict structured output. */
export const PAGES_SCHEMA = {
  type: "object",
  properties: {
    pages: {
      type: "array",
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            box_2d: { type: "array", items: { type: "number" } },
            src: { type: "string" },
            translated: { type: "string" },
            color: { type: "string" },
            bold: { type: "boolean" },
          },
          required: ["box_2d", "src", "translated", "color", "bold"],
          additionalProperties: false,
        },
      },
    },
  },
  required: ["pages"],
  additionalProperties: false,
} as const;

function toItem(raw: unknown): PageItem | null {
  if (!raw || typeof raw !== "object") return null;
  const it = raw as Record<string, unknown>;
  const box = (it.box_2d ?? it.box) as number[] | undefined;
  const text = (it.translated ?? it.text) as string | undefined;
  if (!Array.isArray(box) || box.length !== 4 || typeof text !== "string") {
    return null;
  }
  return {
    box: box.map((n) => Math.max(0, Math.min(1000, Number(n)))) as [
      number,
      number,
      number,
      number,
    ],
    text,
    original: typeof it.src === "string" ? it.src : undefined,
    color: typeof it.color === "string" ? it.color : "#111111",
    bold: it.bold === true,
  };
}

/**
 * Extracts the top-level `[...]` elements of the pages array by matching
 * brackets, so a response cut off by the output-token cap still yields every
 * page that completed.
 */
function salvagePages(json: string): unknown[] {
  const start = json.indexOf("[", json.indexOf('"pages"'));
  if (start === -1) return [];

  const pages: unknown[] = [];
  let depth = 0;
  let elementStart = -1;
  let inString = false;
  let escaped = false;

  for (let i = start + 1; i < json.length; i++) {
    const ch = json[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "[") {
      if (depth === 0) elementStart = i;
      depth++;
    } else if (ch === "]") {
      depth--;
      if (depth === 0 && elementStart !== -1) {
        try {
          pages.push(JSON.parse(json.slice(elementStart, i + 1)));
        } catch {
          pages.push(null);
        }
        elementStart = -1;
      } else if (depth < 0) {
        break; // closed the pages array itself
      }
    }
  }
  return pages;
}

/** `null` marks a page the model did not return — the caller retries those. */
export function parsePages(
  raw: string,
  expected: number,
): (PageItem[] | null)[] {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "");

  let pages: unknown[] | null = null;
  try {
    const parsed = JSON.parse(cleaned);
    const candidate = Array.isArray(parsed) ? parsed : parsed?.pages;
    if (Array.isArray(candidate)) pages = candidate;
  } catch {
    /* fall through to salvage */
  }
  if (!pages) pages = salvagePages(cleaned);

  return Array.from({ length: expected }, (_, i) => {
    const page = pages[i];
    if (!Array.isArray(page)) return null;
    return page.map(toItem).filter((x): x is PageItem => x !== null);
  });
}

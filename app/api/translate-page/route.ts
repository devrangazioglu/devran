import { callGemini } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 300;

export type PageItem = {
  box: [number, number, number, number]; // ymin, xmin, ymax, xmax (0-1000)
  text: string;
  color: string;
};

function buildPrompt(sourceLang: string, targetLang: string): string {
  const sourceNote =
    sourceLang === "Auto Detect"
      ? "Detect the source language automatically."
      : `The source language is ${sourceLang}.`;

  return [
    `Detect every visual LINE of text in this image. ${sourceNote}`,
    `For each line return an object with:`,
    `- "box_2d": [ymin, xmin, ymax, xmax] normalized to 0-1000, tightly around the line of text`,
    `- "translated": that line translated into grammatically correct, natural, fluent ${targetLang}`,
    `- "color": the approximate text color as a hex string like "#222222"`,
    ``,
    `Rules:`,
    `- One object per visual line, in reading order. Never merge multiple lines into one object.`,
    `- Keep proper nouns, numbers, dates, codes and email/web addresses unchanged.`,
    `- Preserve leading bullet or numbering characters (•, -, 1., a)) in the translated text.`,
    `- Skip anything that is not text (logos, pictures, decorations).`,
    `- If the image contains no text, return an empty array.`,
    ``,
    `Return ONLY a JSON array.`,
  ].join("\n");
}

export async function POST(req: Request) {
  let body: {
    imageBase64?: string;
    mimeType?: string;
    sourceLang?: string;
    targetLang?: string;
  };

  try {
    body = await req.json();
  } catch {
    return Response.json({ reason: "unknown" }, { status: 400 });
  }

  const { imageBase64, mimeType, sourceLang = "Auto Detect", targetLang } = body;
  if (!imageBase64 || !mimeType || !targetLang) {
    return Response.json({ reason: "unknown" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ reason: "auth" }, { status: 500 });
  }

  const result = await callGemini(apiKey, "generateContent", {
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: buildPrompt(sourceLang, targetLang) },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });

  if ("failure" in result) {
    console.error("translate-page failed:", result.failure);
    return Response.json(
      { reason: result.failure.reason },
      { status: result.failure.reason === "auth" ? 500 : 503 },
    );
  }

  const data = await result.res.json();
  const raw: string =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? "")
      .join("") ?? "";

  let items: PageItem[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      items = parsed
        .map((it: Record<string, unknown>) => {
          const box = (it.box_2d ?? it.box) as number[] | undefined;
          const text = (it.translated ?? it.text) as string | undefined;
          if (!Array.isArray(box) || box.length !== 4 || !text) return null;
          return {
            box: box.map((n) => Math.max(0, Math.min(1000, Number(n)))) as [
              number,
              number,
              number,
              number,
            ],
            text,
            color: typeof it.color === "string" ? it.color : "#111111",
          };
        })
        .filter((x): x is PageItem => x !== null);
    }
  } catch {
    return Response.json({ reason: "unknown" }, { status: 502 });
  }

  return Response.json({ items });
}

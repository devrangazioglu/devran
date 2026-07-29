import { callGemini } from "@/lib/gemini";
import { callOpenAI, imagePart } from "@/lib/openai";
import { buildPagePrompt, PAGES_SCHEMA, parsePages } from "@/lib/pages";

export const runtime = "nodejs";
export const maxDuration = 60;

type InputPage = { imageBase64: string; mimeType: string };

async function viaOpenAI(
  apiKey: string,
  pages: InputPage[],
  prompt: string,
): Promise<{ raw: string } | { reason: string; status: number }> {
  const result = await callOpenAI(apiKey, {
    messages: [
      {
        role: "user",
        content: [
          ...pages.map((p) => imagePart(p.mimeType, p.imageBase64)),
          { type: "text", text: prompt },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "pages", strict: true, schema: PAGES_SCHEMA },
    },
  });

  if ("failure" in result) {
    console.error("translate-page (openai) failed:", result.failure);
    return {
      reason: result.failure.reason,
      status: result.failure.reason === "auth" ? 500 : 503,
    };
  }

  const data = await result.res.json();
  return { raw: data?.choices?.[0]?.message?.content ?? "" };
}

async function viaGemini(
  apiKey: string,
  pages: InputPage[],
  prompt: string,
): Promise<{ raw: string } | { reason: string; status: number }> {
  const result = await callGemini(apiKey, "generateContent", {
    contents: [
      {
        role: "user",
        parts: [
          ...pages.map((p) => ({
            inlineData: { mimeType: p.mimeType, data: p.imageBase64 },
          })),
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
      maxOutputTokens: 65536,
    },
  });

  if ("failure" in result) {
    console.error("translate-page (gemini) failed:", result.failure);
    return {
      reason: result.failure.reason,
      status: result.failure.reason === "auth" ? 500 : 503,
    };
  }

  const data = await result.res.json();
  const raw: string =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? "")
      .join("") ?? "";
  return { raw };
}

export async function POST(req: Request) {
  let body: {
    pages?: InputPage[];
    sourceLang?: string;
    targetLang?: string;
  };

  try {
    body = await req.json();
  } catch {
    return Response.json({ reason: "unknown" }, { status: 400 });
  }

  const { pages, sourceLang = "Auto Detect", targetLang } = body;
  if (!Array.isArray(pages) || pages.length === 0 || !targetLang) {
    return Response.json({ reason: "unknown" }, { status: 400 });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!openaiKey && !geminiKey) {
    return Response.json({ reason: "auth" }, { status: 500 });
  }

  const prompt = buildPagePrompt(sourceLang, targetLang, pages.length);

  // OpenAI is a paid tier with far higher limits, so prefer it when present
  // and keep Gemini as the fallback.
  let outcome = openaiKey
    ? await viaOpenAI(openaiKey, pages, prompt)
    : await viaGemini(geminiKey!, pages, prompt);

  if ("reason" in outcome && openaiKey && geminiKey) {
    outcome = await viaGemini(geminiKey, pages, prompt);
  }

  if ("reason" in outcome) {
    return Response.json({ reason: outcome.reason }, { status: outcome.status });
  }

  const results = parsePages(outcome.raw, pages.length);
  if (results.every((r) => r === null)) {
    console.error("translate-page: unparseable response", outcome.raw.slice(0, 200));
    return Response.json({ reason: "unknown" }, { status: 502 });
  }

  return Response.json({ results });
}

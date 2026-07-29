import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 300;

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
type ImageMediaType = (typeof IMAGE_TYPES)[number];

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

function buildPrompt(sourceLang: string, targetLang: string): string {
  const sourceNote =
    sourceLang === "Auto Detect"
      ? "Detect the source language of the document automatically."
      : `The source language of the document is ${sourceLang}.`;

  return [
    `You are Transivo, a professional document translator.`,
    sourceNote,
    `Extract ALL text from the attached document and translate it into ${targetLang}.`,
    ``,
    `Requirements:`,
    `- The translation must be grammatically correct, natural, and fluent in ${targetLang} — never a word-for-word literal rendering.`,
    `- Preserve the document's structure: keep headings, paragraphs, lists, and table content in the same order, using plain text with line breaks.`,
    `- Translate every piece of visible text, including captions, labels, footnotes, and text inside images or diagrams.`,
    `- Keep proper nouns, numbers, dates, codes, and email/web addresses unchanged unless the target language requires an adapted form.`,
    `- If part of the document is illegible, mark it as [illegible] instead of guessing.`,
    ``,
    `Respond with ONLY the translated text — no preamble, no commentary, no explanation of what you did.`,
  ].join("\n");
}

/* ── Gemini (free tier) ──────────────────────────────────────────── */

function streamGemini(
  apiKey: string,
  fileBase64: string,
  mediaType: string,
  prompt: string,
): Response {
  const encoder = new TextEncoder();

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    { inlineData: { mimeType: mediaType, data: fileBase64 } },
                    { text: prompt },
                  ],
                },
              ],
              generationConfig: { temperature: 0.2 },
            }),
          },
        );

        if (!res.ok || !res.body) {
          const detail = await res.text().catch(() => "");
          let message = `Gemini request failed (${res.status}).`;
          try {
            const parsed = JSON.parse(detail);
            if (parsed?.error?.message) message = `Gemini: ${parsed.error.message}`;
          } catch {
            /* keep generic message */
          }
          controller.enqueue(encoder.encode(`[Transivo] ${message}`));
          controller.close();
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finishReason: string | undefined;

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const json = JSON.parse(payload);
              const candidate = json.candidates?.[0];
              const text = candidate?.content?.parts
                ?.map((p: { text?: string }) => p.text ?? "")
                .join("");
              if (text) controller.enqueue(encoder.encode(text));
              if (candidate?.finishReason) finishReason = candidate.finishReason;
            } catch {
              /* ignore malformed keep-alive lines */
            }
          }
        }

        if (finishReason === "MAX_TOKENS") {
          controller.enqueue(
            encoder.encode(
              "\n\n[Transivo] The document is too long — output was truncated. Try splitting it into smaller parts.",
            ),
          );
        } else if (finishReason === "SAFETY" || finishReason === "PROHIBITED_CONTENT") {
          controller.enqueue(
            encoder.encode(
              "\n\n[Transivo] The request was declined by safety filters. Please try a different document.",
            ),
          );
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

/* ── Claude ──────────────────────────────────────────────────────── */

function streamClaude(
  fileBase64: string,
  mediaType: string,
  isPdf: boolean,
  prompt: string,
): Response {
  const client = new Anthropic();

  const fileBlock: Anthropic.ContentBlockParam = isPdf
    ? {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: fileBase64,
        },
      }
    : {
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType as ImageMediaType,
          data: fileBase64,
        },
      };

  const stream = client.messages.stream({
    model: "claude-opus-5",
    max_tokens: 64000,
    messages: [
      {
        role: "user",
        content: [fileBlock, { type: "text", text: prompt }],
      },
    ],
  });

  const encoder = new TextEncoder();

  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on("text", (delta) => {
        controller.enqueue(encoder.encode(delta));
      });

      stream
        .finalMessage()
        .then((message) => {
          if (message.stop_reason === "refusal") {
            controller.enqueue(
              encoder.encode(
                "\n\n[Transivo] The request was declined by safety filters. Please try a different document.",
              ),
            );
          } else if (message.stop_reason === "max_tokens") {
            controller.enqueue(
              encoder.encode(
                "\n\n[Transivo] The document is too long — output was truncated. Try splitting it into smaller parts.",
              ),
            );
          }
          controller.close();
        })
        .catch((err: unknown) => {
          controller.error(err);
        });
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

/* ── Route handler ───────────────────────────────────────────────── */

export async function POST(req: Request) {
  let body: {
    fileBase64?: string;
    mediaType?: string;
    sourceLang?: string;
    targetLang?: string;
  };

  try {
    body = await req.json();
  } catch {
    return new Response("Invalid request body.", { status: 400 });
  }

  const { fileBase64, mediaType, sourceLang = "Auto Detect", targetLang } = body;

  if (!fileBase64 || !mediaType || !targetLang) {
    return new Response("Missing file, media type, or target language.", {
      status: 400,
    });
  }

  const isPdf = mediaType === "application/pdf";
  const isImage = (IMAGE_TYPES as readonly string[]).includes(mediaType);
  if (!isPdf && !isImage) {
    return new Response("Unsupported file type.", { status: 415 });
  }

  const prompt = buildPrompt(sourceLang, targetLang);

  if (process.env.GEMINI_API_KEY) {
    return streamGemini(process.env.GEMINI_API_KEY, fileBase64, mediaType, prompt);
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return streamClaude(fileBase64, mediaType, isPdf, prompt);
  }

  return new Response(
    "Server is not configured. Set GEMINI_API_KEY (free — get one at https://aistudio.google.com/apikey) or ANTHROPIC_API_KEY in your .env file.",
    { status: 500 },
  );
}

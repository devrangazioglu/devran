import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 300;

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
type ImageMediaType = (typeof IMAGE_TYPES)[number];

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

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      "Server is not configured: set the ANTHROPIC_API_KEY environment variable.",
      { status: 500 },
    );
  }

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
        content: [fileBlock, { type: "text", text: buildPrompt(sourceLang, targetLang) }],
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

// Shared Gemini calling logic: retries transient overload/rate-limit errors
// with exponential backoff, then falls back to alternative models.

/** Ordered by capability: the full-size models read multi-image batches
 *  reliably, the lite models are the last-resort fallback. */
const DEFAULT_MODELS = [
  "gemini-flash-latest",
  "gemini-2.0-flash",
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-lite",
];

/** Preferred model first, then fallbacks tried when one is overloaded. */
export const GEMINI_MODELS: string[] = process.env.GEMINI_MODEL
  ? [
      process.env.GEMINI_MODEL,
      ...DEFAULT_MODELS.filter((m) => m !== process.env.GEMINI_MODEL),
    ]
  : DEFAULT_MODELS;

/** Overloaded (503), rate-limited (429) and 5xx are worth retrying. */
export function isTransient(status: number): boolean {
  return status === 429 || status === 503 || status >= 500;
}

export type GeminiFailure = {
  status: number;
  /** Raw message from the API, for logs. */
  detail: string;
  /** Short key the client turns into a localized message. */
  reason: "busy" | "quota" | "auth" | "unknown";
};

function classify(status: number, detail: string): GeminiFailure["reason"] {
  const lower = detail.toLowerCase();
  if (status === 429 || lower.includes("quota") || lower.includes("rate limit")) {
    return "quota";
  }
  if (status === 401 || status === 403 || lower.includes("api key")) return "auth";
  if (isTransient(status)) return "busy";
  return "unknown";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POSTs the same body to each candidate model, retrying transient failures
 * with exponential backoff before moving on to the next model.
 */
export async function callGemini(
  apiKey: string,
  endpoint: "generateContent" | "streamGenerateContent",
  body: unknown,
  opts: { attemptsPerModel?: number; query?: string } = {},
): Promise<{ res: Response; model: string } | { failure: GeminiFailure }> {
  const attempts = opts.attemptsPerModel ?? 3;
  const query = opts.query ?? "";
  let last: GeminiFailure = {
    status: 0,
    detail: "No request was made.",
    reason: "unknown",
  };

  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      let res: Response;
      try {
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:${endpoint}${query}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify(body),
          },
        );
      } catch (err) {
        last = {
          status: 0,
          detail: (err as Error).message,
          reason: "busy",
        };
        await sleep(600 * 2 ** attempt);
        continue;
      }

      if (res.ok) return { res, model };

      const detail = await res.text().catch(() => "");
      let message = detail;
      try {
        const parsed = JSON.parse(detail);
        if (parsed?.error?.message) message = parsed.error.message;
      } catch {
        /* keep raw text */
      }
      last = {
        status: res.status,
        detail: message,
        reason: classify(res.status, message),
      };

      // Auth problems and malformed requests will not fix themselves.
      if (!isTransient(res.status)) break;

      // The free tier caps requests per *day* per model, so waiting cannot
      // clear a 429 — switch models immediately instead of burning time.
      if (res.status === 429) break;

      if (attempt < attempts - 1) await sleep(700 * 2 ** attempt);
    }
  }

  return { failure: last };
}

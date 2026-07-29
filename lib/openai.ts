// OpenAI calling logic, mirroring lib/gemini.ts: retries transient failures
// with exponential backoff, then moves on to the next model.

import type { GeminiFailure } from "./gemini";

/** Same failure shape as the Gemini path so routes stay provider-agnostic. */
export type ProviderFailure = GeminiFailure;

const DEFAULT_MODELS = ["gpt-4.1-mini", "gpt-4o", "gpt-4o-mini"];

export const OPENAI_MODELS: string[] = process.env.OPENAI_MODEL
  ? [
      process.env.OPENAI_MODEL,
      ...DEFAULT_MODELS.filter((m) => m !== process.env.OPENAI_MODEL),
    ]
  : DEFAULT_MODELS;

/** Override to target Azure OpenAI or any OpenAI-compatible endpoint. */
const BASE_URL = (
  process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"
).replace(/\/$/, "");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Outcome = "ok" | "retry" | "next-model" | "stop";

function classify(
  status: number,
  code: string,
  message: string,
): { outcome: Outcome; reason: ProviderFailure["reason"] } {
  if (status === 401 || status === 403) {
    return { outcome: "stop", reason: "auth" };
  }
  // A 429 is either "slow down" (worth retrying) or "you are out of credit",
  // which no amount of waiting will fix.
  if (status === 429) {
    const spent =
      code === "insufficient_quota" || /quota|billing|credit/i.test(message);
    return spent
      ? { outcome: "stop", reason: "quota" }
      : { outcome: "retry", reason: "busy" };
  }
  if (status >= 500) return { outcome: "retry", reason: "busy" };
  // Most often the key has no access to this model — try the next one.
  if (status === 404 || code === "model_not_found") {
    return { outcome: "next-model", reason: "unknown" };
  }
  return { outcome: "stop", reason: "unknown" };
}

/**
 * POSTs a Chat Completions body (without `model`) to each candidate model.
 */
export async function callOpenAI(
  apiKey: string,
  body: Record<string, unknown>,
  opts: { attemptsPerModel?: number } = {},
): Promise<{ res: Response; model: string } | { failure: ProviderFailure }> {
  const attempts = opts.attemptsPerModel ?? 3;
  let last: ProviderFailure = {
    status: 0,
    detail: "No request was made.",
    reason: "unknown",
  };

  for (const model of OPENAI_MODELS) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      let res: Response;
      try {
        res = await fetch(`${BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ ...body, model }),
        });
      } catch (err) {
        last = { status: 0, detail: (err as Error).message, reason: "busy" };
        await sleep(700 * 2 ** attempt);
        continue;
      }

      if (res.ok) return { res, model };

      const detail = await res.text().catch(() => "");
      let message = detail;
      let code = "";
      try {
        const parsed = JSON.parse(detail);
        if (parsed?.error?.message) message = parsed.error.message;
        if (parsed?.error?.code) code = String(parsed.error.code);
      } catch {
        /* keep raw text */
      }

      const { outcome, reason } = classify(res.status, code, message);
      last = { status: res.status, detail: message, reason };

      if (outcome === "stop") return { failure: last };
      if (outcome === "next-model") break;
      if (attempt < attempts - 1) await sleep(700 * 2 ** attempt);
    }
  }

  return { failure: last };
}

export function imagePart(mimeType: string, base64: string) {
  return {
    type: "image_url" as const,
    image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" },
  };
}

import { NextResponse } from "next/server";

import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createUser } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Aynı IP'den 10 dakikada en fazla 5 kayıt denemesi.
  const limit = rateLimit(`register:${clientIp(request)}`, 5, 10 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Çok fazla kayıt denemesi yapıldı. Lütfen birkaç dakika sonra tekrar deneyin." },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const { email, password, name } = (body ?? {}) as {
    email?: unknown;
    password?: unknown;
    name?: unknown;
  };

  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "E-posta ve parola zorunludur." }, { status: 400 });
  }

  const result = await createUser({
    email,
    password,
    name: typeof name === "string" ? name : undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json({ user: result.user }, { status: 201 });
}

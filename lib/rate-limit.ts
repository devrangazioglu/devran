/**
 * Basit bellek içi istek sınırlayıcı (sabit pencere).
 *
 * Tek sunucu örneği için yeterlidir; birden fazla örnek çalıştıracaksanız
 * (yatay ölçekleme) Redis gibi paylaşımlı bir sayaca taşınmalıdır.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();

  // Süresi geçmiş kayıtları ara sıra temizle.
  if (buckets.size > 1000) {
    for (const [k, bucket] of buckets) if (bucket.resetAt < now) buckets.delete(k);
  }

  const existing = buckets.get(key);
  if (!existing || existing.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(Math.ceil((existing.resetAt - now) / 1000), 1),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** İstemci IP'sini ters vekil başlıklarından çıkarır. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "bilinmeyen";
}

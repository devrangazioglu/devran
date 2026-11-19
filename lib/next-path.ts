/**
 * Giriş sonrası dönülecek yolun doğrulanması.
 *
 * `?devam=` parametresi kullanıcıdan geldiği için doğrudan yönlendirmede
 * kullanılamaz: dış adrese açılan yönlendirme (open redirect) olurdu. Yalnızca
 * kendi sitemizdeki mutlak yollar kabul edilir.
 */

/** Yalnızca "/panel", "/varlik/abd/AAPL?interval=4h" gibi yolları kabul eder. */
export function safeNextPath(value: unknown, fallback = "/panel"): string {
  if (typeof value !== "string") return fallback;
  const path = value.trim();
  // "//host" ve "/\host" tarayıcıda protokol-bağımsız dış adres olarak çözülür.
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return fallback;
  if (path.includes("://") || /[\r\n]/.test(path)) return fallback;
  return path;
}

/** Giriş/kayıt bağlantılarına `devam` parametresini ekler. */
export function withNextPath(base: string, next: string | null): string {
  if (!next || next === "/panel") return base;
  return `${base}?devam=${encodeURIComponent(next)}`;
}

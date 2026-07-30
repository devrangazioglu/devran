/**
 * Kullanıcı deposunun arka uçtan bağımsız kısmı: tipler, varsayılanlar,
 * parola karma (hash) işlemleri ve doğrulama.
 *
 * Hem dosya tabanlı hem Postgres tabanlı depo bu modülü kullanır.
 */

import { randomUUID, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

export type UserSettings = {
  /** Varsayılan analiz zaman dilimi. */
  defaultInterval: string;
  /** Panelde ve tarayıcıda açılacak varsayılan piyasa. */
  defaultMarket: string;
  /** Tarayıcıda taranacak coin sayısı. */
  scanLimit: number;
  /** Sinyal listesinde yalnızca güçlü sinyalleri göster. */
  onlyStrongSignals: boolean;
};

export type User = {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
  createdAt: number;
  watchlist: string[];
  settings: UserSettings;
};

export type PublicUser = Omit<User, "passwordHash">;

export const DEFAULT_SETTINGS: UserSettings = {
  defaultInterval: "4h",
  defaultMarket: "kripto",
  scanLimit: 30,
  onlyStrongSignals: false,
};

export const DEFAULT_WATCHLIST = [
  "kripto:BTCUSDT",
  "kripto:ETHUSDT",
  "abd:AAPL",
  "bist:THYAO.IS",
  "emtia:GC=F",
];

/** Depo yazılamadığında/erişilemediğinde fırlatılır. */
export class UserStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserStoreError";
  }
}

/** Depo arka uçlarının uyması gereken sözleşme. */
export type UserStore = {
  /** İnsan okur adı (hata mesajları ve tanılama için). */
  readonly name: string;
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  /** Kullanıcıyı ekler; e-posta zaten kayıtlıysa false döner. */
  insert(user: User): Promise<boolean>;
  /** OAuth ile gelen kullanıcıyı bulur ya da oluşturur. */
  upsertOAuth(email: string, name: string | null | undefined): Promise<User>;
  /**
   * Kullanıcıyı kilitleyip değiştirir. `mutate` doğrudan kayıt üzerinde çalışır;
   * kullanıcı yoksa null döner.
   */
  update(email: string, mutate: (user: User) => void): Promise<PublicUser | null>;
};

/* ────────────────────── Parola ────────────────────── */

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string | null,
): Promise<boolean> {
  if (!stored) return false;
  const [scheme, saltHex, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const derived = await scrypt(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(derived, expected);
}

/* ────────────────────── Yardımcılar ────────────────────── */

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

/** Yeni kullanıcı kaydı oluşturur (henüz depoya yazmaz). */
export function buildUser(input: {
  email: string;
  name?: string;
  passwordHash: string | null;
}): User {
  const email = normalizeEmail(input.email);
  return {
    id: randomUUID(),
    email,
    name: input.name?.trim() || email.split("@")[0],
    passwordHash: input.passwordHash,
    createdAt: Date.now(),
    watchlist: [...DEFAULT_WATCHLIST],
    settings: { ...DEFAULT_SETTINGS },
  };
}

/** Depodan gelen ham ayarları eksiksiz bir UserSettings'e tamamlar. */
export function normalizeSettings(raw: unknown): UserSettings {
  const value = (raw ?? {}) as Partial<UserSettings>;
  return {
    defaultInterval:
      typeof value.defaultInterval === "string"
        ? value.defaultInterval
        : DEFAULT_SETTINGS.defaultInterval,
    defaultMarket:
      typeof value.defaultMarket === "string"
        ? value.defaultMarket
        : DEFAULT_SETTINGS.defaultMarket,
    scanLimit:
      typeof value.scanLimit === "number" && Number.isFinite(value.scanLimit)
        ? value.scanLimit
        : DEFAULT_SETTINGS.scanLimit,
    onlyStrongSignals:
      typeof value.onlyStrongSignals === "boolean"
        ? value.onlyStrongSignals
        : DEFAULT_SETTINGS.onlyStrongSignals,
  };
}

/**
 * Depodan gelen ham takip listesini temizler.
 *
 * Liste artık "piyasa:sembol" kimliklerini tutar (ör. "kripto:BTCUSDT").
 * Yalnızca sembol içeren eski kayıtlar kripto piyasasına eşlenir.
 */
export function normalizeWatchlist(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...DEFAULT_WATCHLIST];
  return raw
    .filter((item): item is string => typeof item === "string" && item.length > 0)
    .map((item) => (item.includes(":") ? item : `kripto:${item}`));
}

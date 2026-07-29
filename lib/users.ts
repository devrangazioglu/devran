/**
 * Basit dosya tabanlı kullanıcı deposu.
 *
 * Parolalar Node'un yerleşik `scrypt` fonksiyonuyla, kullanıcıya özel rastgele
 * tuz (salt) ile saklanır — düz metin parola hiçbir yere yazılmaz.
 *
 * Depo varsayılan olarak `data/users.json` dosyasıdır (git'e girmez).
 * Sunucusuz (serverless) bir ortama kurulum yapacaksanız disk kalıcı
 * olmadığı için `lib/users.ts` içindeki okuma/yazma fonksiyonlarını bir
 * veritabanına taşımanız gerekir; arayüz geri kalanını değiştirmez.
 */

import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

export type UserSettings = {
  /** Varsayılan analiz zaman dilimi. */
  defaultInterval: string;
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
  scanLimit: 30,
  onlyStrongSignals: false,
};

const DEFAULT_WATCHLIST = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"];

function storePath(): string {
  return resolve(process.env.USERS_FILE ?? "data/users.json");
}

/* ────────────────────── Dosya okuma / yazma ────────────────────── */

// Eşzamanlı yazmalarda kaybolan güncelleme olmasın diye basit sıra.
let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task, task);
  queue = result.catch(() => undefined);
  return result;
}

async function readAll(): Promise<User[]> {
  try {
    const raw = await readFile(storePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as User[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

/** Kullanıcı deposuna yazılamadığında fırlatılır (salt okunur disk, kota vb.). */
export class UserStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserStoreError";
  }
}

// EROFS/EACCES/EPERM: salt okunur ya da izinsiz disk. ENOSPC: yer yok.
// ENOENT: klasör oluşturulamadı — salt okunur bir dosya sisteminde
// `mkdir -p` bu kodu döndürür, sunucusuz ortamlardaki tipik durum budur.
const UNWRITABLE_CODES = new Set(["EROFS", "EACCES", "EPERM", "ENOSPC", "ENOENT"]);

async function writeAll(users: User[]): Promise<void> {
  const path = storePath();
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(users, null, 2), "utf8");
  } catch (error) {
    // Sunucusuz ortamlarda (Vercel vb.) disk salt okunurdur; bunu ham 500
    // yerine anlaşılır bir mesaja çeviriyoruz.
    const code = (error as NodeJS.ErrnoException).code;
    if (code && UNWRITABLE_CODES.has(code)) {
      throw new UserStoreError(
        `Kullanıcı deposuna yazılamıyor (${path}, ${code}): bu ortamın dosya sistemi ` +
          "kalıcı değil. Kalıcı bir veritabanı yapılandırın (README → “Üretime alırken”).",
      );
    }
    throw error;
  }
}

/* ────────────────────── Parola ────────────────────── */

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [scheme, saltHex, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const derived = await scrypt(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(derived, expected);
}

/* ────────────────────── Kullanıcı işlemleri ────────────────────── */

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const users = await readAll();
  const normalized = email.trim().toLowerCase();
  return users.find((u) => u.email === normalized) ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  const users = await readAll();
  return users.find((u) => u.id === id) ?? null;
}

export type CreateUserInput = {
  email: string;
  password: string;
  name?: string;
};

export type CreateUserResult =
  | { ok: true; user: PublicUser }
  | { ok: false; error: string };

export async function createUser(input: CreateUserInput): Promise<CreateUserResult> {
  const email = input.email.trim().toLowerCase();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  if (!emailValid) return { ok: false, error: "Geçerli bir e-posta adresi girin." };
  if (input.password.length < 8) {
    return { ok: false, error: "Parola en az 8 karakter olmalı." };
  }

  const passwordHash = await hashPassword(input.password);

  return serialize(async () => {
    const users = await readAll();
    if (users.some((u) => u.email === email)) {
      return { ok: false as const, error: "Bu e-posta ile kayıtlı bir hesap zaten var." };
    }
    const user: User = {
      id: randomUUID(),
      email,
      name: input.name?.trim() || email.split("@")[0],
      passwordHash,
      createdAt: Date.now(),
      watchlist: [...DEFAULT_WATCHLIST],
      settings: { ...DEFAULT_SETTINGS },
    };
    users.push(user);
    await writeAll(users);
    return { ok: true as const, user: toPublicUser(user) };
  });
}

/** Google ile giriş yapan kullanıcıyı kaydeder ya da mevcut kaydı döndürür. */
export async function upsertOAuthUser(email: string, name?: string | null): Promise<User> {
  const normalized = email.trim().toLowerCase();
  return serialize(async () => {
    const users = await readAll();
    const existing = users.find((u) => u.email === normalized);
    if (existing) return existing;

    const user: User = {
      id: randomUUID(),
      email: normalized,
      name: name?.trim() || normalized.split("@")[0],
      passwordHash: null,
      createdAt: Date.now(),
      watchlist: [...DEFAULT_WATCHLIST],
      settings: { ...DEFAULT_SETTINGS },
    };
    users.push(user);
    await writeAll(users);
    return user;
  });
}

/** E-posta + parola doğrular; başarılıysa kullanıcıyı döndürür. */
export async function authenticate(email: string, password: string): Promise<PublicUser | null> {
  const user = await findUserByEmail(email);
  if (!user) {
    // Kullanıcı yoksa da benzer sürede yanıt ver (kullanıcı sayımını zorlaştırır).
    await hashPassword(password);
    return null;
  }
  const valid = await verifyPassword(password, user.passwordHash);
  return valid ? toPublicUser(user) : null;
}

async function updateUser(
  email: string,
  mutate: (user: User) => void,
): Promise<PublicUser | null> {
  const normalized = email.trim().toLowerCase();
  return serialize(async () => {
    const users = await readAll();
    const user = users.find((u) => u.email === normalized);
    if (!user) return null;
    mutate(user);
    await writeAll(users);
    return toPublicUser(user);
  });
}

/* ────────────────────── Takip listesi & ayarlar ────────────────────── */

export async function getWatchlist(email: string): Promise<string[]> {
  const user = await findUserByEmail(email);
  return user?.watchlist ?? [...DEFAULT_WATCHLIST];
}

export async function toggleWatchlist(
  email: string,
  symbol: string,
): Promise<{ watchlist: string[]; added: boolean } | null> {
  let added = false;
  const user = await updateUser(email, (u) => {
    const index = u.watchlist.indexOf(symbol);
    if (index >= 0) {
      u.watchlist.splice(index, 1);
    } else {
      u.watchlist.push(symbol);
      added = true;
    }
  });
  return user ? { watchlist: user.watchlist, added } : null;
}

export async function saveSettings(
  email: string,
  settings: Partial<UserSettings>,
): Promise<PublicUser | null> {
  return updateUser(email, (u) => {
    u.settings = { ...DEFAULT_SETTINGS, ...u.settings, ...settings };
  });
}

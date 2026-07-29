/**
 * Kullanıcı deposunun genel arayüzü.
 *
 * Arka uç ortama göre seçilir:
 *   • `DATABASE_URL` (ya da `POSTGRES_URL`) tanımlıysa → **Postgres**
 *     (Vercel + Neon için önerilen yol; tablo ilk istekte oluşturulur).
 *   • Tanımlı değilse → **dosya deposu** (`data/users.json`), yalnızca yerel
 *     geliştirme için. Sunucusuz ortamda yazma denemesi anlaşılır bir hatayla
 *     başarısız olur.
 *
 * Parolalar her iki arka uçta da scrypt ile, kullanıcıya özel rastgele tuzla
 * saklanır; düz metin parola hiçbir yere yazılmaz.
 */

import { postgresEnabled } from "./db";
import { fileStore } from "./users-file";
import { postgresStore } from "./users-postgres";
import {
  buildUser,
  DEFAULT_SETTINGS,
  DEFAULT_WATCHLIST,
  hashPassword,
  isValidEmail,
  normalizeEmail,
  toPublicUser,
  UserStoreError,
  verifyPassword,
  type PublicUser,
  type User,
  type UserSettings,
  type UserStore,
} from "./users-shared";

export {
  DEFAULT_SETTINGS,
  DEFAULT_WATCHLIST,
  hashPassword,
  toPublicUser,
  UserStoreError,
  verifyPassword,
};
export type { PublicUser, User, UserSettings, UserStore };

/** Etkin depo arka ucu. */
export function store(): UserStore {
  return postgresEnabled() ? postgresStore : fileStore;
}

/** Arayüzde/günlüklerde gösterilecek arka uç adı. */
export function storeName(): string {
  return store().name;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  return store().findByEmail(email);
}

export async function findUserById(id: string): Promise<User | null> {
  return store().findById(id);
}

/* ────────────────────── Kayıt ve giriş ────────────────────── */

export type CreateUserInput = { email: string; password: string; name?: string };

export type CreateUserResult =
  | { ok: true; user: PublicUser }
  | { ok: false; error: string };

export async function createUser(input: CreateUserInput): Promise<CreateUserResult> {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) return { ok: false, error: "Geçerli bir e-posta adresi girin." };
  if (input.password.length < 8) {
    return { ok: false, error: "Parola en az 8 karakter olmalı." };
  }

  const user = buildUser({
    email,
    name: input.name,
    passwordHash: await hashPassword(input.password),
  });

  const inserted = await store().insert(user);
  if (!inserted) {
    return { ok: false, error: "Bu e-posta ile kayıtlı bir hesap zaten var." };
  }
  return { ok: true, user: toPublicUser(user) };
}

/** Google ile giriş yapan kullanıcıyı kaydeder ya da mevcut kaydı döndürür. */
export async function upsertOAuthUser(email: string, name?: string | null): Promise<User> {
  return store().upsertOAuth(email, name);
}

/** E-posta + parola doğrular; başarılıysa kullanıcıyı döndürür. */
export async function authenticate(
  email: string,
  password: string,
): Promise<PublicUser | null> {
  const user = await findUserByEmail(email);
  if (!user) {
    // Kullanıcı yoksa da benzer sürede yanıt ver (kullanıcı sayımını zorlaştırır).
    await hashPassword(password);
    return null;
  }
  const valid = await verifyPassword(password, user.passwordHash);
  return valid ? toPublicUser(user) : null;
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
  const user = await store().update(email, (current) => {
    const index = current.watchlist.indexOf(symbol);
    if (index >= 0) {
      current.watchlist.splice(index, 1);
    } else {
      current.watchlist.push(symbol);
      added = true;
    }
  });
  return user ? { watchlist: user.watchlist, added } : null;
}

export async function saveSettings(
  email: string,
  settings: Partial<UserSettings>,
): Promise<PublicUser | null> {
  return store().update(email, (current) => {
    current.settings = { ...DEFAULT_SETTINGS, ...current.settings, ...settings };
  });
}

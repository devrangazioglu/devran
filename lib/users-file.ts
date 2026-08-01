/**
 * Dosya tabanlı kullanıcı deposu (yerel geliştirme için).
 *
 * `DATABASE_URL` tanımlı değilse kullanılır; böylece veritabanı kurmadan
 * `npm run dev` çalıştırıp kayıt/giriş akışını denemek mümkün olur.
 * Sunucusuz ortamlarda disk kalıcı olmadığı için yazma denemeleri
 * anlaşılır bir `UserStoreError` ile başarısız olur.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  normalizeEmail,
  normalizeSettings,
  normalizeSubscription,
  normalizeWatchlist,
  toPublicUser,
  UserStoreError,
  buildUser,
  type User,
  type UserStore,
} from "./users-shared";

function storePath(): string {
  return resolve(process.env.USERS_FILE ?? "data/users.json");
}

// Eşzamanlı yazmalarda kaybolan güncelleme olmasın diye basit sıra.
let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task, task);
  queue = result.catch(() => undefined);
  return result;
}

function hydrate(raw: unknown): User[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      id: String(item.id ?? ""),
      email: normalizeEmail(String(item.email ?? "")),
      name: String(item.name ?? ""),
      passwordHash: typeof item.passwordHash === "string" ? item.passwordHash : null,
      createdAt: Number(item.createdAt ?? Date.now()),
      watchlist: normalizeWatchlist(item.watchlist),
      settings: normalizeSettings(item.settings),
      abonelik: normalizeSubscription(item.abonelik),
    }));
}

async function readAll(): Promise<User[]> {
  try {
    return hydrate(JSON.parse(await readFile(storePath(), "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
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
    const code = (error as NodeJS.ErrnoException).code;
    if (code && UNWRITABLE_CODES.has(code)) {
      throw new UserStoreError(
        `Kullanıcı deposuna yazılamıyor (${path}, ${code}): bu ortamın dosya sistemi ` +
          "kalıcı değil. Kalıcı bir veritabanı yapılandırın: DATABASE_URL tanımlayın " +
          "(README → “Üretime alırken”).",
      );
    }
    throw error;
  }
}

export const fileStore: UserStore = {
  name: "Dosya",

  async findByEmail(email) {
    const users = await readAll();
    const normalized = normalizeEmail(email);
    return users.find((u) => u.email === normalized) ?? null;
  },

  async findById(id) {
    const users = await readAll();
    return users.find((u) => u.id === id) ?? null;
  },

  async insert(user) {
    return serialize(async () => {
      const users = await readAll();
      if (users.some((u) => u.email === user.email)) return false;
      users.push(user);
      await writeAll(users);
      return true;
    });
  },

  async upsertOAuth(email, name) {
    const normalized = normalizeEmail(email);
    return serialize(async () => {
      const users = await readAll();
      const existing = users.find((u) => u.email === normalized);
      if (existing) return existing;

      const user = buildUser({ email: normalized, name: name ?? undefined, passwordHash: null });
      users.push(user);
      await writeAll(users);
      return user;
    });
  },

  async update(email, mutate) {
    const normalized = normalizeEmail(email);
    return serialize(async () => {
      const users = await readAll();
      const user = users.find((u) => u.email === normalized);
      if (!user) return null;
      mutate(user);
      await writeAll(users);
      return toPublicUser(user);
    });
  },
};

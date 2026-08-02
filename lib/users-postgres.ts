/**
 * Postgres tabanlı kullanıcı deposu.
 *
 * Vercel + Neon (Vercel Postgres) için önerilen yol: panelde Storage → Postgres
 * bağlandığında `DATABASE_URL` otomatik eklenir, tablo ilk istekte oluşturulur.
 */

import { ensureSchema, query, transaction } from "./db";
import {
  buildUser,
  normalizeEmail,
  normalizeSettings,
  normalizeSubscription,
  normalizeWatchlist,
  toPublicUser,
  type PublicUser,
  type User,
  type UserStore,
} from "./users-shared";

type Row = {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
  created_at: string | number;
  watchlist: unknown;
  settings: unknown;
  abonelik: unknown;
};

function toUser(row: Row): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    // bigint sürücüden metin olarak gelir.
    createdAt: Number(row.created_at),
    watchlist: normalizeWatchlist(row.watchlist),
    settings: normalizeSettings(row.settings),
    abonelik: normalizeSubscription(row.abonelik),
  };
}

const SELECT = `select id, email, name, password_hash, created_at, watchlist, settings, abonelik from users`;

export const postgresStore: UserStore = {
  name: "Postgres",

  async findByEmail(email) {
    await ensureSchema();
    const rows = await query<Row>(`${SELECT} where email = $1`, [normalizeEmail(email)]);
    return rows[0] ? toUser(rows[0]) : null;
  },

  async findById(id) {
    await ensureSchema();
    // Geçersiz uuid metni sorguyu düşürmesin.
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const rows = await query<Row>(`${SELECT} where id = $1`, [id]);
    return rows[0] ? toUser(rows[0]) : null;
  },

  async insert(user) {
    await ensureSchema();
    const rows = await query<{ id: string }>(
      `insert into users (id, email, name, password_hash, created_at, watchlist, settings, abonelik)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb)
       on conflict (email) do nothing
       returning id`,
      [
        user.id,
        user.email,
        user.name,
        user.passwordHash,
        user.createdAt,
        JSON.stringify(user.watchlist),
        JSON.stringify(user.settings),
        JSON.stringify(user.abonelik),
      ],
    );
    // Satır dönmediyse e-posta zaten kayıtlı.
    return rows.length > 0;
  },

  async upsertOAuth(email, name) {
    await ensureSchema();
    const normalized = normalizeEmail(email);
    const existing = await postgresStore.findByEmail(normalized);
    if (existing) return existing;

    const user = buildUser({ email: normalized, name: name ?? undefined, passwordHash: null });
    const inserted = await postgresStore.insert(user);
    if (inserted) return user;

    // Yarış durumu: aynı anda başka bir istek eklemiş olabilir.
    const now = await postgresStore.findByEmail(normalized);
    return now ?? user;
  },

  async update(email, mutate) {
    await ensureSchema();
    const normalized = normalizeEmail(email);

    return transaction(async (client) => {
      const result = await client.query<Row>(`${SELECT} where email = $1 for update`, [
        normalized,
      ]);
      const row = result.rows[0];
      if (!row) return null;

      const user = toUser(row);
      mutate(user);

      await client.query(
        `update users
            set name = $2, watchlist = $3::jsonb, settings = $4::jsonb, abonelik = $5::jsonb
          where email = $1`,
        [
          normalized,
          user.name,
          JSON.stringify(user.watchlist),
          JSON.stringify(user.settings),
          JSON.stringify(user.abonelik),
        ],
      );
      return toPublicUser(user) as PublicUser;
    });
  },
};

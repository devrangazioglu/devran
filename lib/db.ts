/**
 * Postgres bağlantısı.
 *
 * Bağlantı dizesi `DATABASE_URL` (Vercel'in Neon/Postgres tümleşiği bunu
 * otomatik ekler) ya da `POSTGRES_URL` değişkeninden okunur. İkisi de yoksa
 * uygulama dosya tabanlı depoya düşer (bkz. `lib/users.ts`).
 *
 * Sunucusuz ortamda her örnek kendi havuzunu açar; bu yüzden havuz küçük
 * tutulur ve Neon'un "pooler" uç noktasının kullanılması önerilir.
 */

import { Pool, type PoolClient, type QueryResultRow } from "pg";

import { UserStoreError } from "./users-shared";

export function databaseUrl(): string | null {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? null;
}

export function postgresEnabled(): boolean {
  return databaseUrl() !== null;
}

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;

  const connectionString = databaseUrl();
  if (!connectionString) {
    throw new UserStoreError(
      "Veritabanı bağlantı dizesi tanımlı değil (DATABASE_URL veya POSTGRES_URL).",
    );
  }

  // Yerel geliştirmede (localhost) TLS kapalı, yönetilen sağlayıcılarda açık.
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);

  pool = new Pool({
    connectionString,
    max: Number(process.env.PGPOOL_MAX ?? 3),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: local ? undefined : { rejectUnauthorized: true },
  });

  // Havuzdaki boşta bağlantı hatası süreci düşürmesin.
  pool.on("error", (error) => {
    console.error("Postgres havuz hatası:", error);
  });

  return pool;
}

/** Bağlantı/sorgu hatalarını anlaşılır bir UserStoreError'a çevirir. */
function wrap(error: unknown): never {
  const code = (error as { code?: string }).code;
  const message = error instanceof Error ? error.message : String(error);

  if (code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ETIMEDOUT") {
    throw new UserStoreError(
      `Veritabanına bağlanılamadı (${code}). DATABASE_URL değerini ve ağ erişimini kontrol edin.`,
    );
  }
  if (code === "28P01" || code === "28000") {
    throw new UserStoreError("Veritabanı kimlik doğrulaması başarısız (kullanıcı adı/parola).");
  }
  if (code === "3D000") {
    throw new UserStoreError("Veritabanı bulunamadı; bağlantı dizesindeki veritabanı adını kontrol edin.");
  }
  throw new UserStoreError(`Veritabanı hatası: ${message}`);
}

export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  try {
    const result = await getPool().query<T>(text, params);
    return result.rows;
  } catch (error) {
    if (error instanceof UserStoreError) throw error;
    return wrap(error);
  }
}

/** Bir işlemi (transaction) tek bağlantı üzerinde çalıştırır. */
export async function transaction<T>(
  handler: (client: PoolClient) => Promise<T>,
): Promise<T> {
  let client: PoolClient;
  try {
    client = await getPool().connect();
  } catch (error) {
    return wrap(error);
  }

  try {
    await client.query("BEGIN");
    const result = await handler(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (error instanceof UserStoreError) throw error;
    return wrap(error);
  } finally {
    client.release();
  }
}

/* ────────────────────── Şema ────────────────────── */

const SCHEMA = `
  create table if not exists users (
    id            uuid primary key,
    email         text not null unique,
    name          text not null,
    password_hash text,
    created_at    bigint not null,
    watchlist     jsonb not null default '[]'::jsonb,
    settings      jsonb not null default '{}'::jsonb
  );

  create table if not exists piyasa_onbellek (
    anahtar text primary key,
    deger   jsonb  not null,
    biter   bigint not null
  );

  create index if not exists piyasa_onbellek_biter on piyasa_onbellek (biter);

  create table if not exists piyasa_kota (
    anahtar text primary key,
    sayac   integer not null default 0,
    biter   bigint  not null
  );
`;

let schemaReady: Promise<void> | null = null;

/**
 * Tabloyu ilk kullanımda oluşturur. Idempotenttir ve süreç başına bir kez
 * çalışır; ayrı bir göç (migration) adımı gerektirmez.
 */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = query(SCHEMA)
      .then(() => undefined)
      .catch((error) => {
        // Sonraki istek yeniden denesin.
        schemaReady = null;
        throw error;
      });
  }
  return schemaReady;
}

/** Testlerin havuzu kapatabilmesi için. */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    schemaReady = null;
  }
}

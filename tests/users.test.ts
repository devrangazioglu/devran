/**
 * Kullanıcı deposu testleri.
 *
 * Aynı test kümesi iki arka uçta da çalışır:
 *   • dosya deposu — her zaman
 *   • Postgres     — yalnızca TEST_DATABASE_URL tanımlıysa
 *
 * Yerelde Postgres'e karşı çalıştırmak için:
 *   TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres npm test
 */

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import { fileStore } from "../lib/users-file";
import {
  buildUser,
  hashPassword,
  normalizeSettings,
  normalizeWatchlist,
  toPublicUser,
  verifyPassword,
  type UserStore,
} from "../lib/users-shared";

/* ────────────────────── Parola ────────────────────── */

test("parola karması scrypt biçiminde ve her seferinde farklıdır", async () => {
  const first = await hashPassword("parola12345");
  const second = await hashPassword("parola12345");
  assert.match(first, /^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/);
  assert.notEqual(first, second, "tuz her kayıtta farklı olmalı");
});

test("parola doğrulaması yalnızca doğru parolayı kabul eder", async () => {
  const hash = await hashPassword("parola12345");
  assert.equal(await verifyPassword("parola12345", hash), true);
  assert.equal(await verifyPassword("parola1234", hash), false);
  assert.equal(await verifyPassword("", hash), false);
  assert.equal(await verifyPassword("parola12345", null), false);
  assert.equal(await verifyPassword("parola12345", "bozuk-veri"), false);
});

test("düz metin parola karmanın içinde geçmez", async () => {
  const hash = await hashPassword("çok-gizli-parola");
  assert.ok(!hash.includes("çok-gizli-parola"));
});

test("toPublicUser parola karmasını dışarı vermez", () => {
  const user = buildUser({ email: "A@Ornek.COM", passwordHash: "scrypt:aa:bb" });
  const publicUser = toPublicUser(user) as Record<string, unknown>;
  assert.equal("passwordHash" in publicUser, false);
  assert.equal(publicUser.email, "a@ornek.com", "e-posta küçük harfe çevrilmeli");
});

test("bozuk ayar/takip verisi varsayılanlara tamamlanır", () => {
  const settings = normalizeSettings({ scanLimit: "otuz", onlyStrongSignals: true });
  assert.equal(settings.scanLimit, 30);
  assert.equal(settings.onlyStrongSignals, true);
  assert.equal(settings.defaultInterval, "4h");
  assert.equal(settings.defaultMarket, "kripto");
  // Eski kayıtlar (yalnızca sembol) kripto piyasasına eşlenir.
  assert.deepEqual(normalizeWatchlist([1, "BTCUSDT", null, "abd:AAPL"]), [
    "kripto:BTCUSDT",
    "abd:AAPL",
  ]);
});

/* ────────────────────── Arka uç sözleşmesi ────────────────────── */

/** Her depo arka ucunun geçmesi gereken ortak testler. */
function storeContract(label: string, getStore: () => UserStore) {
  describe(`${label} deposu`, () => {
    test("kullanıcı ekler ve e-posta ile bulur", async () => {
      const store = getStore();
      const user = buildUser({
        email: `ekle-${Date.now()}@ornek.com`,
        name: "Devran",
        passwordHash: "scrypt:aa:bb",
      });

      assert.equal(await store.insert(user), true);

      const found = await store.findByEmail(user.email);
      assert.ok(found);
      assert.equal(found.name, "Devran");
      assert.equal(found.passwordHash, "scrypt:aa:bb");
      assert.deepEqual(found.watchlist, user.watchlist);
      assert.equal(found.settings.defaultInterval, "4h");
      assert.equal(found.createdAt, user.createdAt, "createdAt sayı olarak korunmalı");
    });

    test("e-posta büyük/küçük harften bağımsız bulunur", async () => {
      const store = getStore();
      const email = `Karisik-${Date.now()}@Ornek.com`;
      await store.insert(buildUser({ email, passwordHash: null }));

      assert.ok(await store.findByEmail(email.toUpperCase()));
      assert.ok(await store.findByEmail(email.toLowerCase()));
    });

    test("aynı e-posta ikinci kez eklenemez", async () => {
      const store = getStore();
      const email = `tekil-${Date.now()}@ornek.com`;
      assert.equal(await store.insert(buildUser({ email, passwordHash: null })), true);
      assert.equal(
        await store.insert(buildUser({ email, passwordHash: null })),
        false,
        "ikinci ekleme reddedilmeli",
      );
    });

    test("kimlik (id) ile bulur, bilinmeyen kimlikte null döner", async () => {
      const store = getStore();
      const user = buildUser({ email: `kimlik-${Date.now()}@ornek.com`, passwordHash: null });
      await store.insert(user);

      const found = await store.findById(user.id);
      assert.equal(found?.email, user.email);
      assert.equal(await store.findById("00000000-0000-0000-0000-000000000000"), null);
      assert.equal(await store.findById("gecersiz-kimlik"), null);
    });

    test("bilinmeyen e-postada null döner", async () => {
      assert.equal(await getStore().findByEmail("yok@ornek.com"), null);
    });

    test("güncelleme takip listesini ve ayarları kalıcı yazar", async () => {
      const store = getStore();
      const email = `guncelle-${Date.now()}@ornek.com`;
      await store.insert(buildUser({ email, passwordHash: null }));

      const updated = await store.update(email, (user) => {
        user.watchlist = ["kripto:AVAXUSDT", "bist:ASELS.IS"];
        user.settings = {
          defaultInterval: "1h",
          defaultMarket: "abd",
          scanLimit: 60,
          onlyStrongSignals: true,
        };
      });
      assert.deepEqual(updated?.watchlist, ["kripto:AVAXUSDT", "bist:ASELS.IS"]);

      // Yeniden okuyup kalıcılığı doğrula.
      const reread = await store.findByEmail(email);
      assert.deepEqual(reread?.watchlist, ["kripto:AVAXUSDT", "bist:ASELS.IS"]);
      assert.equal(reread?.settings.defaultInterval, "1h");
      assert.equal(reread?.settings.defaultMarket, "abd");
      assert.equal(reread?.settings.scanLimit, 60);
      assert.equal(reread?.settings.onlyStrongSignals, true);
    });

    test("güncelleme parola karmasını bozmaz", async () => {
      const store = getStore();
      const email = `parola-${Date.now()}@ornek.com`;
      await store.insert(buildUser({ email, passwordHash: "scrypt:cc:dd" }));

      await store.update(email, (user) => {
        user.watchlist = ["kripto:BTCUSDT"];
      });

      const reread = await store.findByEmail(email);
      assert.equal(reread?.passwordHash, "scrypt:cc:dd");
    });

    test("bilinmeyen kullanıcıyı güncellemek null döner", async () => {
      assert.equal(
        await getStore().update("yok@ornek.com", (user) => {
          user.name = "değişmesin";
        }),
        null,
      );
    });

    test("OAuth kullanıcısı oluşturur, ikinci çağrıda aynı kaydı döndürür", async () => {
      const store = getStore();
      const email = `oauth-${Date.now()}@ornek.com`;

      const first = await store.upsertOAuth(email, "Devran G");
      assert.equal(first.email, email);
      assert.equal(first.passwordHash, null);
      assert.equal(first.name, "Devran G");

      const second = await store.upsertOAuth(email, "Başka Ad");
      assert.equal(second.id, first.id, "aynı kullanıcı dönmeli");
      assert.equal(second.name, "Devran G", "mevcut ad korunmalı");
    });

    test("eşzamanlı takip listesi güncellemeleri kaybolmaz", async () => {
      const store = getStore();
      const email = `yaris-${Date.now()}@ornek.com`;
      const user = buildUser({ email, passwordHash: null });
      user.watchlist = [];
      await store.insert(user);

      const symbols = [
        "kripto:BTCUSDT",
        "kripto:ETHUSDT",
        "abd:AAPL",
        "bist:THYAO.IS",
        "emtia:GC=F",
      ];
      await Promise.all(
        symbols.map((symbol) =>
          store.update(email, (current) => {
            current.watchlist.push(symbol);
          }),
        ),
      );

      const reread = await store.findByEmail(email);
      assert.equal(
        reread?.watchlist.length,
        symbols.length,
        `beklenen ${symbols.length} sembol, gelen: ${JSON.stringify(reread?.watchlist)}`,
      );
      for (const symbol of symbols) assert.ok(reread?.watchlist.includes(symbol));
    });
  });
}

/* ────────────────────── Dosya deposu ────────────────────── */

let directory: string;

before(async () => {
  directory = await mkdtemp(join(tmpdir(), "fibonex-test-"));
  process.env.USERS_FILE = join(directory, "users.json");
});

after(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});

storeContract("Dosya", () => fileStore);

/* ────────────────────── Postgres deposu ────────────────────── */

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

  // Modüller ortam değişkenini okuduğu için import burada yapılır.
  const { postgresStore } = require("../lib/users-postgres") as typeof import("../lib/users-postgres");
  const { closePool, query, ensureSchema } = require("../lib/db") as typeof import("../lib/db");

  before(async () => {
    await ensureSchema();
    await query("delete from users");
  });

  after(async () => {
    await closePool();
  });

  storeContract("Postgres", () => postgresStore);
} else {
  test("Postgres deposu (atlandı — TEST_DATABASE_URL tanımlı değil)", { skip: true }, () => {});
}

test("boş DATABASE_URL tanımlı sayılmaz", async () => {
  // Tanımlanmamış bir GitHub secret'ı ya da silinmiş bir ortam değişkeni boş
  // dize olarak geliyor. Bu "tanımlı" sayılırsa uygulama dosya deposuna
  // düşmek yerine her sorguda çöker.
  const { databaseUrl, postgresEnabled } = await import("../lib/db");
  const onceki = { db: process.env.DATABASE_URL, pg: process.env.POSTGRES_URL };

  try {
    process.env.DATABASE_URL = "";
    process.env.POSTGRES_URL = "";
    assert.equal(databaseUrl(), null);
    assert.equal(postgresEnabled(), false);

    process.env.DATABASE_URL = "   ";
    assert.equal(databaseUrl(), null, "yalnızca boşluktan oluşan değer de sayılmaz");

    process.env.DATABASE_URL = "postgres://kullanici@sunucu/veritabani";
    assert.equal(postgresEnabled(), true);
  } finally {
    if (onceki.db === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = onceki.db;
    if (onceki.pg === undefined) delete process.env.POSTGRES_URL;
    else process.env.POSTGRES_URL = onceki.pg;
  }
});

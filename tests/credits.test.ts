/**
 * Kredi defteri testleri.
 *
 * Dosya deposu üzerinden çalışır (Postgres gerektirmez): kurallar depodan
 * bağımsız olduğu için yeterli. Ölçülen şeyler, kullanıcının parasının
 * karşılığını aldığı noktalar: dönem yenilemesi, ücretsiz tekrar penceresi,
 * kredi bitince durma ve hata durumunda iade.
 */

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

import {
  abonelikDurumu,
  donemiTazele,
  krediHarca,
  krediIade,
  planDegistir,
} from "../lib/credits";
import { DONEM_MS, PLANS, TEKRAR_UCRETSIZ_MS } from "../lib/plans";
import { fileStore } from "../lib/users-file";
import { buildUser, normalizeSubscription } from "../lib/users-shared";

let directory: string | null = null;

before(async () => {
  directory = await mkdtemp(join(tmpdir(), "fibonex-kredi-"));
  process.env.USERS_FILE = join(directory, "users.json");
});

after(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});

async function yeniKullanici(): Promise<string> {
  const user = buildUser({
    email: `kredi-${Date.now()}-${Math.random().toString(36).slice(2)}@ornek.com`,
    passwordHash: null,
  });
  await fileStore.insert(user);
  return user.email;
}

test("yeni hesap ücretsiz planla ve dolu krediyle başlar", async () => {
  const durum = await abonelikDurumu(await yeniKullanici());
  assert.ok(durum);
  assert.equal(durum.plan.id, "ucretsiz");
  assert.equal(durum.toplam, PLANS.ucretsiz.aylikKredi);
  assert.equal(durum.kalan, PLANS.ucretsiz.aylikKredi);
});

test("analiz kredi düşer, kısa süre içindeki tekrar düşmez", async () => {
  const email = await yeniKullanici();

  const ilk = await krediHarca(email, "kripto:BTCUSDT:4h");
  assert.equal(ilk.ok, true);
  assert.ok(ilk.ok && ilk.durum);
  assert.equal(ilk.ok && ilk.ucretsiz, false);
  assert.equal(ilk.ok && ilk.durum?.kalan, PLANS.ucretsiz.aylikKredi - 1);

  // Aynı varlık + periyot: sayfa yenilemek kredi yakmamalı.
  const tekrar = await krediHarca(email, "kripto:BTCUSDT:4h");
  assert.equal(tekrar.ok && tekrar.ucretsiz, true);
  assert.equal(tekrar.ok && tekrar.durum?.kalan, PLANS.ucretsiz.aylikKredi - 1);

  // Başka periyot ayrı bir analizdir, ücretlidir.
  const baska = await krediHarca(email, "kripto:BTCUSDT:1d");
  assert.equal(baska.ok && baska.ucretsiz, false);
  assert.equal(baska.ok && baska.durum?.kalan, PLANS.ucretsiz.aylikKredi - 2);
});

test("kredi bitince yeni analiz reddedilir", async () => {
  const email = await yeniKullanici();
  const hak = PLANS.ucretsiz.aylikKredi;

  for (let i = 0; i < hak; i++) {
    const sonuc = await krediHarca(email, `kripto:COIN${i}:4h`);
    assert.equal(sonuc.ok, true, `${i}. analiz geçmeliydi`);
  }

  const tasan = await krediHarca(email, "kripto:SONUNCU:4h");
  assert.equal(tasan.ok, false);
  assert.equal(tasan.ok === false && tasan.sebep, "yetersiz");
  assert.equal(tasan.durum?.kalan, 0);

  // Kredisi biten kullanıcı, ücretsiz pencere içindeki bir analizi yine açabilir.
  const eski = await krediHarca(email, "kripto:COIN0:4h");
  assert.equal(eski.ok, true);
  assert.equal(eski.ok && eski.ucretsiz, true);
});

test("başarısız analizin kredisi iade edilir", async () => {
  const email = await yeniKullanici();
  await krediHarca(email, "kripto:ETHUSDT:1h");
  await krediIade(email, "kripto:ETHUSDT:1h");

  const durum = await abonelikDurumu(email);
  assert.equal(durum?.kalan, PLANS.ucretsiz.aylikKredi);

  // İade sonrası aynı analiz yeniden ücretlidir (pencere de silinir).
  const yeniden = await krediHarca(email, "kripto:ETHUSDT:1h");
  assert.equal(yeniden.ok && yeniden.ucretsiz, false);
});

test("dönem dolunca kredi sıfırlanır, dönem başı gün olarak korunur", () => {
  const basi = Date.UTC(2026, 0, 7, 9, 0, 0);
  const abonelik = normalizeSubscription({
    plan: "basic",
    donemBasi: basi,
    harcanan: 400,
    sonAnalizler: { "kripto:BTCUSDT:4h": basi + 1000 },
  });

  // Dönem içindeyken hiçbir şey değişmez.
  const icinde = donemiTazele(abonelik, basi + DONEM_MS - 1);
  assert.equal(icinde.harcanan, 400);
  assert.equal(icinde.donemBasi, basi);

  // İki dönem geçtiyse tek adımda bugüne taşınır.
  const sonra = donemiTazele(abonelik, basi + 2 * DONEM_MS + 5_000);
  assert.equal(sonra.harcanan, 0);
  assert.equal(sonra.donemBasi, basi + 2 * DONEM_MS);
  assert.deepEqual(sonra.sonAnalizler, {});
});

test("ücretsiz tekrar penceresi geçen kayıtlar defterde birikmez", () => {
  const now = Date.now();
  const abonelik = normalizeSubscription({
    plan: "ucretsiz",
    donemBasi: now - 1000,
    harcanan: 2,
    sonAnalizler: {
      "kripto:ESKI:4h": now - TEKRAR_UCRETSIZ_MS - 1,
      "kripto:YENI:4h": now - 1000,
    },
  });

  const temiz = donemiTazele(abonelik, now);
  assert.deepEqual(Object.keys(temiz.sonAnalizler), ["kripto:YENI:4h"]);
});

test("plan değişimi hakkı ve dönemi yeniler", async () => {
  const email = await yeniKullanici();
  await krediHarca(email, "kripto:BTCUSDT:4h");

  const durum = await planDegistir(email, "premium");
  assert.equal(durum.plan.id, "premium");
  assert.equal(durum.toplam, PLANS.premium.aylikKredi);
  assert.equal(durum.kalan, PLANS.premium.aylikKredi, "yükseltmede kredi baştan başlar");
});

test("kullanıcı kaydı yoksa defter tutulmaz ama istek engellenmez", async () => {
  const sonuc = await krediHarca("olmayan@ornek.com", "kripto:BTCUSDT:4h");
  assert.equal(sonuc.ok, true);
  assert.equal(sonuc.ok && sonuc.durum, null);
});

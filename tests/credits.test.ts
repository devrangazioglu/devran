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
  DAVET_ODULU,
  DAVET_SINIRI,
  DAVETLI_ODULU,
  davetOdulu,
  DENEME_MS,
  denemeBaslat,
  donemiTazele,
  durumOlustur,
  krediHarca,
  krediIade,
  planDegistir,
} from "../lib/credits";
import {
  DONEM_MS,
  PLANS,
  planUcreti,
  TEKRAR_UCRETSIZ_MS,
  YILLIK_BEDAVA_AY,
} from "../lib/plans";
import { fileStore } from "../lib/users-file";
import { buildUser, davetKodu, normalizeSubscription } from "../lib/users-shared";

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
  assert.equal(durum.faturalama, "aylik", "belirtilmezse aylık");
  assert.equal(durum.toplam, PLANS.premium.aylikKredi);
  assert.equal(durum.kalan, PLANS.premium.aylikKredi, "yükseltmede kredi baştan başlar");
});

test("yıllık faturalama kredi hakkını değiştirmez, fiyatı değiştirir", async () => {
  const email = await yeniKullanici();
  const durum = await planDegistir(email, "basic", "yillik");

  assert.equal(durum.faturalama, "yillik");
  assert.equal(durum.toplam, PLANS.basic.aylikKredi, "kredi aylık hak; yıllık ödemek çoğaltmaz");
  assert.equal(planUcreti(durum.plan, "yillik"), PLANS.basic.yillikUcret);

  // Yıllık fiyat, aylığın on katı olmalı: iki ay bedava sözü buradan geliyor.
  for (const id of ["basic", "premium", "ultimate"] as const) {
    assert.equal(
      PLANS[id].yillikUcret,
      PLANS[id].ucret * (12 - YILLIK_BEDAVA_AY),
      `${id} yıllık fiyatı ${YILLIK_BEDAVA_AY} ay bedava ile uyuşmuyor`,
    );
    assert.equal(PLANS[id].ucret % 1, 0, "aylık fiyat tam sayı olmalı");
    assert.equal(PLANS[id].yillikUcret % 1, 0, "yıllık fiyat tam sayı olmalı");
  }
});

test("kullanıcı kaydı yoksa defter tutulmaz ama istek engellenmez", async () => {
  const sonuc = await krediHarca("olmayan@ornek.com", "kripto:BTCUSDT:4h");
  assert.equal(sonuc.ok, true);
  assert.equal(sonuc.ok && sonuc.durum, null);
});

/* ────────────────────── Deneme, ek kredi, davet ────────────────────── */

test("Premium deneme bir kez başlar, süresince Premium hakkı verir", async () => {
  const email = await yeniKullanici();
  const ilk = await denemeBaslat(email);
  assert.equal(ilk.ok, true);
  const durum = await abonelikDurumu(email);
  assert.equal(durum?.plan.id, "premium");
  assert.equal(durum?.kayitliPlan, "ucretsiz");
  assert.ok(durum?.denemeBitis);
  assert.equal(durum?.denemeHakki, false);
  assert.equal(durum?.toplam, PLANS.premium.aylikKredi);

  const ikinci = await denemeBaslat(email);
  assert.deepEqual(ikinci, { ok: false, sebep: "kullanildi" });
});

test("deneme bitince ücretsiz plana dönülür ve dönem baştan başlar", () => {
  const basi = Date.UTC(2026, 0, 1);
  const abonelik = {
    ...normalizeSubscription({}, basi),
    harcanan: 800,
    deneme: { bitis: basi + DENEME_MS, kapandi: false },
  };
  const surerken = donemiTazele(abonelik, basi + DENEME_MS - 1);
  assert.equal(durumOlustur(surerken, basi + DENEME_MS - 1).plan.id, "premium");

  const sonra = basi + DENEME_MS + 1000;
  const bitti = donemiTazele(abonelik, sonra);
  assert.equal(bitti.deneme?.kapandi, true);
  assert.equal(bitti.harcanan, 0, "denemede harcanan ücretsiz hakkı yemez");
  assert.equal(bitti.donemBasi, basi + DENEME_MS);
  const durum = durumOlustur(bitti, sonra);
  assert.equal(durum.plan.id, "ucretsiz");
  assert.equal(durum.kalan, PLANS.ucretsiz.aylikKredi);
  assert.equal(durum.denemeHakki, false);
});

test("aylık kredi bitince ek kredi harcanır, iade ek krediye döner", async () => {
  const email = await yeniKullanici();
  await fileStore.update(email, (u) => {
    u.abonelik = { ...normalizeSubscription(u.abonelik), harcanan: PLANS.ucretsiz.aylikKredi, bonus: 2 };
  });

  const bir = await krediHarca(email, "kripto:A:1h");
  assert.equal(bir.ok, true);
  assert.equal(bir.ok && bir.durum?.bonus, 1);
  assert.equal((await krediHarca(email, "kripto:B:1h")).ok, true);
  assert.equal((await krediHarca(email, "kripto:C:1h")).ok, false, "ek kredi de bitti");

  await krediIade(email, "kripto:B:1h");
  const durum = await abonelikDurumu(email);
  assert.equal(durum?.bonus, 1);
  assert.equal(durum?.harcanan, PLANS.ucretsiz.aylikKredi);
});

test("ek kredi dönem yenilenince silinmez", () => {
  const basi = Date.UTC(2026, 0, 1);
  const abonelik = { ...normalizeSubscription({}, basi), harcanan: 50, bonus: 40 };
  const yeni = donemiTazele(abonelik, basi + DONEM_MS + 1);
  assert.equal(yeni.harcanan, 0);
  assert.equal(yeni.bonus, 40);
});

test("davet iki tarafa ek kredi verir; kendini davet ve ikinci ödül olmaz", async () => {
  const davetEdenEmail = await yeniKullanici();
  const davetEden = await fileStore.findByEmail(davetEdenEmail);
  const kod = davetKodu(davetEden!.id);

  const yeni = await yeniKullanici();
  assert.equal(await davetOdulu(yeni, kod), true);
  assert.equal((await abonelikDurumu(davetEdenEmail))?.bonus, DAVET_ODULU);
  assert.equal((await abonelikDurumu(yeni))?.bonus, DAVETLI_ODULU);

  assert.equal(await davetOdulu(yeni, kod), false, "aynı kişi iki kez ödül getirmez");
  assert.equal(await davetOdulu(davetEdenEmail, kod), false, "kendini davet edemez");
  assert.equal(await davetOdulu(yeni, "0000000000"), false, "bilinmeyen kod");
});

test("davet ödülü sınırı aşınca verilmez", async () => {
  const davetEdenEmail = await yeniKullanici();
  await fileStore.update(davetEdenEmail, (u) => {
    u.abonelik = { ...normalizeSubscription(u.abonelik), davetSayisi: DAVET_SINIRI };
  });
  const kod = davetKodu((await fileStore.findByEmail(davetEdenEmail))!.id);
  assert.equal(await davetOdulu(await yeniKullanici(), kod), false);
});

test("plan değişimi ek krediyi ve deneme geçmişini korur", async () => {
  const email = await yeniKullanici();
  await denemeBaslat(email);
  await fileStore.update(email, (u) => {
    u.abonelik = { ...normalizeSubscription(u.abonelik), bonus: 30 };
  });
  await planDegistir(email, "basic");
  const durum = await abonelikDurumu(email);
  assert.equal(durum?.plan.id, "basic");
  assert.equal(durum?.bonus, 30);
  assert.equal(durum?.denemeHakki, false);
});

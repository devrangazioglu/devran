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
  donemiTazele,
  durumOlustur,
  krediHarca,
  krediIade,
  planDegistir,
} from "../lib/credits";
import {
  DONEM_MS,
  HOSGELDIN_KREDISI,
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

/**
 * Test kullanıcısı. Varsayılan olarak hoş geldin kredisi verilmiş sayılır ki
 * aylık hak kuralları tek başına ölçülebilsin; `hosgeldin: false` gerçek yeni
 * hesabı taklit eder.
 */
async function yeniKullanici({ hosgeldin = true } = {}): Promise<string> {
  const user = buildUser({
    email: `kredi-${Date.now()}-${Math.random().toString(36).slice(2)}@ornek.com`,
    passwordHash: null,
  });
  if (hosgeldin) user.abonelik = { ...user.abonelik, hosgeldin: true };
  await fileStore.insert(user);
  return user.email;
}

test("yeni hesap ücretsiz planla, aylık hak ve hoş geldin kredisiyle başlar", async () => {
  const email = await yeniKullanici({ hosgeldin: false });
  const durum = await abonelikDurumu(email);
  assert.ok(durum);
  assert.equal(durum.plan.id, "ucretsiz");
  assert.equal(durum.bonus, HOSGELDIN_KREDISI);
  assert.equal(durum.kalan, PLANS.ucretsiz.aylikKredi + HOSGELDIN_KREDISI);

  // İkinci okuma krediyi yeniden vermez.
  assert.equal((await abonelikDurumu(email))?.bonus, HOSGELDIN_KREDISI);
});

test("hoş geldin kredisi eski kayıtlara bir kez verilir, Ultimate Premium olur", () => {
  const eski = normalizeSubscription({ plan: "ultimate", bonus: 5 });
  assert.equal(eski.plan, "premium");
  assert.equal(eski.bonus, 5 + HOSGELDIN_KREDISI);
  assert.equal(normalizeSubscription(eski).bonus, 5 + HOSGELDIN_KREDISI, "tekrar normalleştirmek eklemez");
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

  // Yıllık fiyat aylığın yaklaşık on katı: iki ay bedava sözü buradan geliyor.
  // Fiyatlar ",99" ile bittiği için kuruş farkına izin verilir.
  for (const id of ["basic", "premium"] as const) {
    for (const [aylik, yillik] of [
      [PLANS[id].ucret, PLANS[id].yillikUcret],
      [PLANS[id].tl.aylik, PLANS[id].tl.yillik],
    ]) {
      assert.ok(
        Math.abs(yillik - aylik * (12 - YILLIK_BEDAVA_AY)) < 0.2,
        `${id} yıllık fiyatı ${YILLIK_BEDAVA_AY} ay bedava ile uyuşmuyor`,
      );
      assert.equal(Math.round(aylik * 100) % 100, 99, "fiyat ,99 ile bitmeli");
    }
  }
  assert.equal(planUcreti(PLANS.basic, "aylik", "TRY"), PLANS.basic.tl.aylik);
});

test("kullanıcı kaydı yoksa defter tutulmaz ama istek engellenmez", async () => {
  const sonuc = await krediHarca("olmayan@ornek.com", "kripto:BTCUSDT:4h");
  assert.equal(sonuc.ok, true);
  assert.equal(sonuc.ok && sonuc.durum, null);
});

/* ────────────────────── Ek kredi, davet ────────────────────── */

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

test("plan değişimi ek krediyi korur", async () => {
  const email = await yeniKullanici();
  await fileStore.update(email, (u) => {
    u.abonelik = { ...normalizeSubscription(u.abonelik), bonus: 30 };
  });
  await planDegistir(email, "basic");
  const durum = await abonelikDurumu(email);
  assert.equal(durum?.plan.id, "basic");
  assert.equal(durum?.bonus, 30);
});

/* ────────────────────── Yönetici ────────────────────── */

test("yönetici kredi harcamaz ve en üst planın sınırlarına sahiptir", async () => {
  const email = await yeniKullanici();
  const onceki = process.env.ADMIN_EPOSTALAR;
  process.env.ADMIN_EPOSTALAR = `baska@ornek.com, ${email.toUpperCase()}`;
  try {
    const durum = await abonelikDurumu(email);
    assert.equal(durum?.yonetici, true);
    assert.equal(durum?.plan.id, "premium");
    for (let i = 0; i < 5; i++) {
      const sonuc = await krediHarca(email, `kripto:Y${i}:1h`);
      assert.equal(sonuc.ok, true);
    }
    assert.equal((await abonelikDurumu(email))?.harcanan, 0, "yönetici kredisi düşmemeli");
  } finally {
    if (onceki === undefined) delete process.env.ADMIN_EPOSTALAR;
    else process.env.ADMIN_EPOSTALAR = onceki;
  }
  // Yönetici listesinden çıkınca normal hesaba döner.
  const normal = await abonelikDurumu(email);
  assert.equal(normal?.yonetici, false);
  assert.equal(normal?.plan.id, "ucretsiz");
});

test("yönetim: ek kredi verilir ve geri alınır", async () => {
  const { bonusVer, yonetimVerisi } = await import("../lib/yonetim");
  const email = await yeniKullanici();
  assert.equal(await bonusVer(email, 100), true);
  assert.equal((await abonelikDurumu(email))?.bonus, 100);
  assert.equal(await bonusVer(email, -500), true);
  assert.equal((await abonelikDurumu(email))?.bonus, 0, "sıfırın altına inmez");

  const veri = await yonetimVerisi();
  const satir = veri.uyeler.find((u) => u.email === email);
  assert.ok(satir);
  assert.equal("passwordHash" in (satir as object), false, "parola özeti dışarı verilmez");
  assert.ok(veri.ozet.toplam >= 1);
});

test("yönetici e-posta ayarı yazım hatalarına toleranslı okunur", async () => {
  const { yoneticiEpostalari, yoneticiMi } = await import("../lib/admin");
  const onceki = process.env.ADMIN_EPOSTALAR;
  try {
    process.env.ADMIN_EPOSTALAR = ' ADMIN_EPOSTALAR="Bir@Ornek.com" ; iki@ornek.com ';
    assert.deepEqual(yoneticiEpostalari(), ["bir@ornek.com", "iki@ornek.com"]);
    assert.equal(yoneticiMi("BIR@ornek.com"), true);
    assert.equal(yoneticiMi("uc@ornek.com"), false);
    process.env.ADMIN_EPOSTALAR = "";
    assert.equal(yoneticiMi("bir@ornek.com"), false);
  } finally {
    if (onceki === undefined) delete process.env.ADMIN_EPOSTALAR;
    else process.env.ADMIN_EPOSTALAR = onceki;
  }
});

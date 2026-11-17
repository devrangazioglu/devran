/**
 * Kredi defteri.
 *
 * Her kullanıcının planına bağlı aylık bir analiz kredisi var; bir varlığı
 * analiz etmek bir kredi düşürür. Bu dosya üç işi yapar:
 *
 *   1. **Dönem yenileme.** Krediler ayda bir sıfırlanır. Yenileme, ayrı bir
 *      zamanlanmış görev yerine kullanıcıya her dokunuşta yapılır: kullanıcı
 *      ayda bir kez bile girse doğru krediyle karşılaşır, uygulamanın da
 *      arka planda çalışan bir parçası olmaz.
 *   2. **Harcama.** Aynı varlık + aynı periyot kısa süre içinde yeniden
 *      açılırsa ücret alınmaz (bkz. `TEKRAR_UCRETSIZ_MS`); sayfa yenilemek
 *      ya da geri gelmek kredi yakmamalı.
 *   3. **İade.** Analiz veri hatasıyla düşerse kredi geri verilir; kullanıcı
 *      göremediği bir analize ödeme yapmaz.
 *
 * Sayaç kullanıcı kaydının içinde tutulur ve `store().update` ile değişir;
 * Postgres tarafında bu `select … for update` içinde çalıştığı için aynı anda
 * gelen iki istek birbirinin harcamasını ezmez.
 */

import {
  ANALIZ_KREDISI,
  DONEM_MS,
  plan,
  planUcreti,
  TEKRAR_UCRETSIZ_MS,
  type Faturalama,
  type Plan,
  type PlanId,
} from "./plans";
import { yoneticiMi } from "./admin";
import { store } from "./users";
import {
  davetKodu,
  normalizeSubscription,
  UserStoreError,
  type Subscription,
  type User,
} from "./users-shared";

/** Ücretsiz tekrar penceresinde tutulacak en fazla kayıt. */
const EN_FAZLA_ANAHTAR = 120;

export type KrediDurumu = {
  /** Etkin plan: deneme sürüyorsa Premium, değilse ödenen plan. */
  plan: Plan;
  /** Ödenen (kayıtlı) plan; deneme sırasında "ucretsiz" kalır. */
  kayitliPlan: PlanId;
  /** Süren Premium denemesinin bitişi; deneme yoksa null. */
  denemeBitis: number | null;
  /** Bu hesap ücretsiz denemeyi başlatabilir mi (hiç kullanmamış ve ücretsiz planda). */
  denemeHakki: boolean;
  /** Devreden ek kredi (kalan'ın içinde). */
  bonus: number;
  /** Yönetici hesabı: kredi harcamaz, en üst planın sınırlarına sahiptir. */
  yonetici: boolean;
  /** Aylık mı yıllık mı ödeniyor. */
  faturalama: Faturalama;
  /** Dönem başına düşen kredi + ek kredi. */
  toplam: number;
  harcanan: number;
  kalan: number;
  /** Dönemin başlangıcı ve bitişi (ms). */
  donemBasi: number;
  donemSonu: number;
};

/** Arayüze gönderilen kısa özet (API yanıtlarının `kredi` alanı). */
export type KrediOzeti = {
  plan: PlanId;
  planAd: string;
  faturalama: Faturalama;
  /** Seçilen döneme göre ödenen tutar (USD). */
  ucret: number;
  kalan: number;
  toplam: number;
  /** Kredinin yenileneceği an (ms). */
  donemSonu: number;
  /** Süren Premium denemesinin bitişi (ms) ya da null. */
  denemeBitis: number | null;
  /** Yönetici: kalan kredi sınırsız gösterilir. */
  yonetici: boolean;
};

export function krediOzeti(durum: KrediDurumu | null): KrediOzeti | null {
  if (!durum) return null;
  return {
    plan: durum.plan.id,
    planAd: durum.plan.ad,
    faturalama: durum.faturalama,
    ucret: planUcreti(durum.plan, durum.faturalama),
    kalan: durum.kalan,
    toplam: durum.toplam,
    donemSonu: durum.donemSonu,
    denemeBitis: durum.denemeBitis,
    yonetici: durum.yonetici,
  };
}

/**
 * `durum: null`, defterin tutulamadığı anlamına gelir (kullanıcı kaydı yok ya
 * da depo yazılamıyor). Bu durumda **kısıtlama uygulanmaz**: altyapı sorunu
 * yüzünden kimse ödediği hizmeti kaybetmemeli.
 */
export type HarcamaSonucu =
  | { ok: true; ucretsiz: boolean; durum: KrediDurumu | null }
  | { ok: false; sebep: "yetersiz"; durum: KrediDurumu };

/* ────────────────────── Deneme ve davet ────────────────────── */

/** Davet kodunu kayıt anına kadar taşıyan çerez (bkz. middleware.ts). */
export const DAVET_CEREZI = "davet";

/** Ücretsiz Premium denemesinin süresi. */
export const DENEME_MS = 7 * 24 * 60 * 60_000;
/** Deneme sırasında geçerli plan. */
export const DENEME_PLANI: PlanId = "premium";
/** Davet eden ve davet edilenin kazandığı ek kredi. */
export const DAVET_ODULU = 50;
export const DAVETLI_ODULU = 25;
/** Bir hesabın davetle ödül kazanabileceği en fazla kişi (sahte hesap sınırı). */
export const DAVET_SINIRI = 20;

/** Deneme şu anda sürüyor mu? Yalnızca ücretsiz planda anlamlı. */
function denemeSuruyor(abonelik: Subscription, now: number): boolean {
  return (
    abonelik.plan === "ucretsiz" &&
    abonelik.deneme !== undefined &&
    !abonelik.deneme.kapandi &&
    now < abonelik.deneme.bitis
  );
}

/** Etkin plan: deneme sürüyorsa Premium, değilse kayıtlı plan. */
export function etkinPlanId(abonelik: Subscription, now = Date.now()): PlanId {
  return denemeSuruyor(abonelik, now) ? DENEME_PLANI : abonelik.plan;
}

/* ────────────────────── Dönem ────────────────────── */

/**
 * Dönemi bugüne taşır.
 *
 * Aradan birden çok dönem geçmiş olabilir (kullanıcı üç ay uğramadıysa);
 * bu yüzden tek tek ilerlemek yerine kaç dönem geçtiği hesaplanır. Dönem
 * başlangıcı korunur: kullanıcı ayın 7'sinde katıldıysa kredisi hep ayın
 * 7'sinde yenilenir.
 */
export function donemiTazele(abonelik: Subscription, now = Date.now()): Subscription {
  // Deneme bitti: ücretsiz plana dönülür ve dönem bitiş anından baştan
  // başlar. Denemede harcanan Premium kredisi ücretsiz hakkı yemesin.
  if (abonelik.deneme && !abonelik.deneme.kapandi && now >= abonelik.deneme.bitis) {
    abonelik = {
      ...abonelik,
      deneme: { ...abonelik.deneme, kapandi: true },
      ...(abonelik.plan === "ucretsiz"
        ? { donemBasi: abonelik.deneme.bitis, harcanan: 0, sonAnalizler: {} }
        : {}),
    };
  }
  const gecen = Math.floor((now - abonelik.donemBasi) / DONEM_MS);
  if (gecen <= 0) return budaAnahtarlar(abonelik, now);

  return {
    ...abonelik,
    donemBasi: abonelik.donemBasi + gecen * DONEM_MS,
    harcanan: 0,
    sonAnalizler: {},
  };
}

/** Ücretsiz tekrar penceresi geçmiş kayıtları atar; defter şişmesin. */
function budaAnahtarlar(abonelik: Subscription, now: number): Subscription {
  const taze = Object.entries(abonelik.sonAnalizler)
    .filter(([, at]) => now - at < TEKRAR_UCRETSIZ_MS)
    .sort((a, b) => b[1] - a[1])
    .slice(0, EN_FAZLA_ANAHTAR);

  if (taze.length === Object.keys(abonelik.sonAnalizler).length) return abonelik;
  return { ...abonelik, sonAnalizler: Object.fromEntries(taze) };
}

/** Yöneticiye gösterilen "sınırsız" kredi (JSON'da Infinity taşınamıyor). */
export const YONETICI_KREDISI = 999_999;

export function durumOlustur(
  abonelik: Subscription,
  now = Date.now(),
  yonetici = false,
): KrediDurumu {
  if (yonetici) {
    const ust = plan("ultimate");
    return {
      plan: ust,
      kayitliPlan: abonelik.plan,
      denemeBitis: null,
      denemeHakki: false,
      bonus: abonelik.bonus,
      yonetici: true,
      faturalama: abonelik.faturalama,
      toplam: YONETICI_KREDISI,
      harcanan: 0,
      kalan: YONETICI_KREDISI,
      donemBasi: abonelik.donemBasi,
      donemSonu: abonelik.donemBasi + DONEM_MS,
    };
  }
  const secili = plan(etkinPlanId(abonelik, now));
  return {
    yonetici: false,
    plan: secili,
    kayitliPlan: abonelik.plan,
    denemeBitis: denemeSuruyor(abonelik, now) ? abonelik.deneme!.bitis : null,
    denemeHakki: abonelik.plan === "ucretsiz" && abonelik.deneme === undefined,
    bonus: abonelik.bonus,
    faturalama: abonelik.faturalama,
    toplam: secili.aylikKredi + abonelik.bonus,
    harcanan: abonelik.harcanan,
    kalan: Math.max(secili.aylikKredi - abonelik.harcanan, 0) + abonelik.bonus,
    donemBasi: abonelik.donemBasi,
    donemSonu: abonelik.donemBasi + DONEM_MS,
  };
}

/** Kullanıcı kaydından, dönem yenilemesi uygulanmış durum. */
export function kullanicidanDurum(user: User, now = Date.now()): KrediDurumu {
  return durumOlustur(
    donemiTazele(normalizeSubscription(user.abonelik, now), now),
    now,
    yoneticiMi(user.email),
  );
}

/* ────────────────────── Okuma ────────────────────── */

/**
 * Kullanıcının kredi durumu. Dönem geçmişse yenilenmiş hâli **yazılır**;
 * böylece kullanıcı panelde gördüğü kalanla analizde karşılaştığı kalanın
 * aynı olduğuna güvenebilir.
 */
export async function abonelikDurumu(email: string): Promise<KrediDurumu | null> {
  let durum: KrediDurumu | null = null;
  try {
    await store().update(email, (user) => {
      const now = Date.now();
      user.abonelik = donemiTazele(normalizeSubscription(user.abonelik, now), now);
      durum = durumOlustur(user.abonelik, now, yoneticiMi(user.email));
    });
  } catch (error) {
    console.error("Kredi durumu okunamadı:", error);
    return null;
  }
  return durum;
}

/* ────────────────────── Harcama ────────────────────── */

/**
 * Bir analiz için kredi düşer.
 *
 * `anahtar` aynı analizi tanımlar ("kripto:BTCUSDT:4h"). Aynı anahtar
 * `TEKRAR_UCRETSIZ_MS` içinde yeniden gelirse ücret alınmaz ve pencere
 * uzatılmaz — pencere ilk **ödenen** andan başlar.
 */
export async function krediHarca(
  email: string,
  anahtar: string,
  maliyet: number = ANALIZ_KREDISI,
): Promise<HarcamaSonucu> {
  // Kullanıcı kaydı bulunamazsa defter tutulamaz; istek geçer.
  let sonuc: HarcamaSonucu = { ok: true, ucretsiz: true, durum: null };

  try {
    await store().update(email, (user) => {
      const now = Date.now();
      const abonelik = donemiTazele(normalizeSubscription(user.abonelik, now), now);
      const oncekiOdeme = abonelik.sonAnalizler[anahtar];
      const yonetici = yoneticiMi(user.email);
      if (yonetici) {
        // Yönetici kredi harcamaz.
        user.abonelik = abonelik;
        sonuc = { ok: true, ucretsiz: true, durum: durumOlustur(abonelik, now, true) };
        return;
      }
      const ucretsiz = oncekiOdeme !== undefined && now - oncekiOdeme < TEKRAR_UCRETSIZ_MS;

      if (!ucretsiz) {
        const hak = plan(etkinPlanId(abonelik, now)).aylikKredi;
        if (abonelik.harcanan + maliyet <= hak) {
          abonelik.harcanan += maliyet;
        } else if (abonelik.bonus >= maliyet) {
          // Aylık hak bitti; devreden ek krediden düşülür.
          abonelik.bonus -= maliyet;
        } else {
          // Dönem yenilemesi yine de kaydedilir; yalnızca harcama yapılmaz.
          user.abonelik = abonelik;
          sonuc = { ok: false, sebep: "yetersiz", durum: durumOlustur(abonelik, now) };
          return;
        }
        abonelik.sonAnalizler = { ...abonelik.sonAnalizler, [anahtar]: now };
      }

      user.abonelik = abonelik;
      sonuc = { ok: true, ucretsiz, durum: durumOlustur(abonelik, now) };
    });
  } catch (error) {
    // Depo yazılamıyorsa (yerel dosya deposu, salt okunur disk) kredi
    // sayılamaz. Kullanıcıyı cezalandırmak yerine isteği geçiririz.
    console.error("Kredi düşülemedi:", error);
    return { ok: true, ucretsiz: true, durum: null };
  }

  return sonuc;
}

/**
 * Harcanan krediyi geri verir.
 *
 * Yalnızca gerçekten ücret alınmış bir istek başarısız olduğunda çağrılmalı
 * (`ok && !ucretsiz`); ücretsiz tekrar için çağrılırsa kullanıcının o dönemki
 * penceresi boşuna silinir.
 */
export async function krediIade(
  email: string,
  anahtar: string,
  maliyet: number = ANALIZ_KREDISI,
): Promise<void> {
  try {
    await store().update(email, (user) => {
      const abonelik = normalizeSubscription(user.abonelik);
      const { [anahtar]: _silinen, ...kalanlar } = abonelik.sonAnalizler;
      // Aylık hak doluysa harcama büyük olasılıkla ek krediden yapılmıştı;
      // iade oraya döner. (Son aylık kredi harcanmışsa da ek krediye dönmesi
      // kullanıcı lehine: ek kredi ay sonunda silinmez.)
      const hak = plan(etkinPlanId(abonelik)).aylikKredi;
      const sayactan = abonelik.harcanan >= maliyet && abonelik.harcanan < hak;
      user.abonelik = {
        ...abonelik,
        harcanan: sayactan ? abonelik.harcanan - maliyet : abonelik.harcanan,
        bonus: sayactan ? abonelik.bonus : abonelik.bonus + maliyet,
        sonAnalizler: kalanlar,
      };
    });
  } catch (error) {
    console.error("Kredi iadesi yazılamadı:", error);
  }
}

/* ────────────────────── Plan değişimi ────────────────────── */

/**
 * Planı değiştirir ve krediyi yeni dönemle sıfırdan başlatır.
 *
 * Ödeme sağlayıcısı bağlandığında çağıracak yer burasıdır (ödeme onayı →
 * `planDegistir`). Yükseltmede dönem baştan başlar: kullanıcı parasını
 * verdiği anda tam krediyle başlamalı, ayın kalanıyla değil.
 */
export async function planDegistir(
  email: string,
  yeni: PlanId,
  faturalama: Faturalama = "aylik",
): Promise<KrediDurumu> {
  let durum: KrediDurumu | null = null;
  await store().update(email, (user) => {
    const onceki = normalizeSubscription(user.abonelik);
    user.abonelik = {
      // Ek kredi, deneme ve davet geçmişi plan değişiminde korunur.
      ...onceki,
      plan: yeni,
      faturalama,
      donemBasi: Date.now(),
      harcanan: 0,
      sonAnalizler: {},
    };
    durum = durumOlustur(user.abonelik);
  });
  // Burada hata yutulmaz: plan değişimi kullanıcının açıkça istediği bir işlem,
  // sessizce başarısız olursa "değişti" sanır.
  if (!durum) throw new UserStoreError("Kullanıcı kaydı bulunamadı.");
  return durum;
}

/* ────────────────────── Deneme başlatma ve davet ödülü ────────────────────── */

export type DenemeSonucu =
  | { ok: true; durum: KrediDurumu }
  | { ok: false; sebep: "kullanildi" | "ucretli" | "kayit-yok" };

/**
 * 7 günlük ücretsiz Premium denemesini başlatır. Her hesap bir kez dener;
 * ücretli plandaki hesapta anlamı yok.
 */
export async function denemeBaslat(email: string, now = Date.now()): Promise<DenemeSonucu> {
  let sonuc: DenemeSonucu = { ok: false, sebep: "kayit-yok" };
  await store().update(email, (user) => {
    const abonelik = donemiTazele(normalizeSubscription(user.abonelik, now), now);
    if (abonelik.deneme) {
      sonuc = { ok: false, sebep: "kullanildi" };
      return;
    }
    if (abonelik.plan !== "ucretsiz") {
      sonuc = { ok: false, sebep: "ucretli" };
      return;
    }
    abonelik.deneme = { bitis: now + DENEME_MS, kapandi: false };
    user.abonelik = abonelik;
    sonuc = { ok: true, durum: durumOlustur(abonelik, now) };
  });
  return sonuc;
}

/**
 * Davetle gelen yeni hesabı ödüllendirir: davet edene ve davetliye ek kredi.
 *
 * Kendi kendini davet etmek, ikinci kez davetli sayılmak ve sınırı aşan
 * davetler ödül getirmez. Hata kaydı engellemez; davet bir jest, kaydın
 * parçası değil.
 */
export async function davetOdulu(yeniEmail: string, kod: string): Promise<boolean> {
  try {
    const davetEden = await store().findByDavetKodu(kod);
    const yeni = await store().findByEmail(yeniEmail);
    if (!davetEden || !yeni || davetEden.id === yeni.id) return false;
    if (normalizeSubscription(yeni.abonelik).davetEden) return false;

    let odullendi = false;
    await store().update(davetEden.email, (user) => {
      const ab = normalizeSubscription(user.abonelik);
      if (ab.davetSayisi >= DAVET_SINIRI) return;
      user.abonelik = { ...ab, bonus: ab.bonus + DAVET_ODULU, davetSayisi: ab.davetSayisi + 1 };
      odullendi = true;
    });
    if (!odullendi) return false;

    await store().update(yeniEmail, (user) => {
      const ab = normalizeSubscription(user.abonelik);
      user.abonelik = { ...ab, bonus: ab.bonus + DAVETLI_ODULU, davetEden: davetEden.id };
    });
    return true;
  } catch (error) {
    console.error("Davet ödülü yazılamadı:", error);
    return false;
  }
}

/**
 * Yeni hesaba hoş geldin: Premium denemesi ve (varsa) davet ödülü.
 * Kayıt (e-posta) ve ilk Google/Apple girişinde çağrılır.
 */
export async function yeniHesapKarsila(email: string, davet?: string | null): Promise<void> {
  try {
    await denemeBaslat(email);
  } catch (error) {
    console.error("Deneme başlatılamadı:", error);
  }
  if (davet) await davetOdulu(email, davet);
}

/** Kullanıcının davet bağlantısı için kod ve şimdiye kadarki davet sayısı. */
export function davetBilgisi(user: User): { kod: string; sayi: number; sinir: number; odul: number } {
  return {
    kod: davetKodu(user.id),
    sayi: normalizeSubscription(user.abonelik).davetSayisi,
    sinir: DAVET_SINIRI,
    odul: DAVET_ODULU,
  };
}

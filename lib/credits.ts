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
  TEKRAR_UCRETSIZ_MS,
  type Plan,
  type PlanId,
} from "./plans";
import { store } from "./users";
import {
  normalizeSubscription,
  UserStoreError,
  type Subscription,
  type User,
} from "./users-shared";

/** Ücretsiz tekrar penceresinde tutulacak en fazla kayıt. */
const EN_FAZLA_ANAHTAR = 120;

export type KrediDurumu = {
  plan: Plan;
  /** Dönem başına düşen kredi. */
  toplam: number;
  harcanan: number;
  kalan: number;
  /** Dönemin başlangıcı ve bitişi (ms). */
  donemBasi: number;
  donemSonu: number;
};

/**
 * `durum: null`, defterin tutulamadığı anlamına gelir (kullanıcı kaydı yok ya
 * da depo yazılamıyor). Bu durumda **kısıtlama uygulanmaz**: altyapı sorunu
 * yüzünden kimse ödediği hizmeti kaybetmemeli.
 */
/** Arayüze gönderilen kısa özet (API yanıtlarının `kredi` alanı). */
export type KrediOzeti = {
  plan: PlanId;
  planAd: string;
  kalan: number;
  toplam: number;
  /** Kredinin yenileneceği an (ms). */
  donemSonu: number;
};

export function krediOzeti(durum: KrediDurumu | null): KrediOzeti | null {
  if (!durum) return null;
  return {
    plan: durum.plan.id,
    planAd: durum.plan.ad,
    kalan: durum.kalan,
    toplam: durum.toplam,
    donemSonu: durum.donemSonu,
  };
}

export type HarcamaSonucu =
  | { ok: true; ucretsiz: boolean; durum: KrediDurumu | null }
  | { ok: false; sebep: "yetersiz"; durum: KrediDurumu };

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

export function durumOlustur(abonelik: Subscription): KrediDurumu {
  const secili = plan(abonelik.plan);
  return {
    plan: secili,
    toplam: secili.aylikKredi,
    harcanan: abonelik.harcanan,
    kalan: Math.max(secili.aylikKredi - abonelik.harcanan, 0),
    donemBasi: abonelik.donemBasi,
    donemSonu: abonelik.donemBasi + DONEM_MS,
  };
}

/** Kullanıcı kaydından, dönem yenilemesi uygulanmış durum. */
export function kullanicidanDurum(user: User, now = Date.now()): KrediDurumu {
  return durumOlustur(donemiTazele(normalizeSubscription(user.abonelik, now), now));
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
      durum = durumOlustur(user.abonelik);
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
      const ucretsiz = oncekiOdeme !== undefined && now - oncekiOdeme < TEKRAR_UCRETSIZ_MS;

      if (!ucretsiz) {
        const hak = plan(abonelik.plan).aylikKredi;
        if (abonelik.harcanan + maliyet > hak) {
          // Dönem yenilemesi yine de kaydedilir; yalnızca harcama yapılmaz.
          user.abonelik = abonelik;
          sonuc = { ok: false, sebep: "yetersiz", durum: durumOlustur(abonelik) };
          return;
        }
        abonelik.harcanan += maliyet;
        abonelik.sonAnalizler = { ...abonelik.sonAnalizler, [anahtar]: now };
      }

      user.abonelik = abonelik;
      sonuc = { ok: true, ucretsiz, durum: durumOlustur(abonelik) };
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
      user.abonelik = {
        ...abonelik,
        harcanan: Math.max(abonelik.harcanan - maliyet, 0),
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
export async function planDegistir(email: string, yeni: PlanId): Promise<KrediDurumu> {
  let durum: KrediDurumu | null = null;
  await store().update(email, (user) => {
    user.abonelik = { plan: yeni, donemBasi: Date.now(), harcanan: 0, sonAnalizler: {} };
    durum = durumOlustur(user.abonelik);
  });
  // Burada hata yutulmaz: plan değişimi kullanıcının açıkça istediği bir işlem,
  // sessizce başarısız olursa "değişti" sanır.
  if (!durum) throw new UserStoreError("Kullanıcı kaydı bulunamadı.");
  return durum;
}

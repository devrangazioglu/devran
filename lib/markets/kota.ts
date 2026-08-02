/**
 * Ücretsiz veri katmanının kredi kotasını yönetir.
 *
 * Neden ayrı bir modül: sağlayıcı dakikada sabit sayıda kredi veriyor ve bu
 * sınır **hesap başına** işliyor. Uygulama sunucusuz çalıştığı için aynı anda
 * birden çok örnek ayağa kalkıyor; her biri kendi belleğinde "8 kredim var"
 * diye saydığında toplamda sınırın katı kadar istek gidiyor ve sağlayıcı hepsini
 * 429 ile geri çeviriyordu. Ekranda liste boş kalmasının asıl sebebi buydu.
 *
 * Çözüm: sayaç veritabanında, tek satırda ve atomik olarak tutulur. Hangi örnek
 * çalışırsa çalışsın aynı sayacı görür.
 *
 * Veritabanı yoksa (yerel geliştirme) bellek içi sayaca düşülür; tek süreç
 * olduğu için orada doğru sonuç verir.
 */

import { ensureSchema, postgresEnabled, query } from "../db";

const PENCERE_MS = 60_000;

/** Dakikalık kredi sınırı. Ücretli plana geçilirse yükseltilir. */
export const KREDI_LIMITI = Math.max(1, Number(process.env.TWELVEDATA_CREDITS_PER_MIN ?? 8));

/**
 * Günlük kredi sınırı.
 *
 * Asıl duvar bu: dakikalık sınıra takılmak birkaç saniye gecikme demek, ama
 * günlük kota bitince sağlayıcı ertesi güne kadar hiçbir şey vermiyor. Ölçüldü:
 * bir günde 800 kredilik sınıra karşı 1508 kredi harcanmış ve site bütün gün
 * boş kalmıştı. Bu yüzden günlük harcama da sayılır ve sınıra yaklaşınca
 * istekler kesilir; kalan kredi kullanıcının tıkladığı varlıklara saklanır.
 */
export const GUNLUK_LIMIT = Math.max(1, Number(process.env.TWELVEDATA_CREDITS_PER_DAY ?? 800));

/** Günlük sınırın son bu kadarı yalnızca tekil isteklere (detay sayfası) kalır. */
const GUNLUK_YEDEK = Math.max(0, Math.floor(GUNLUK_LIMIT * 0.15));

/** Sayaç anahtarı: gün UTC'ye göre değişir, sağlayıcının sıfırlama anıyla aynı. */
function gunAnahtari(): string {
  return `gunluk:${new Date().toISOString().slice(0, 10)}`;
}

/** Sağlayıcının günlük kotası UTC gece yarısı sıfırlanır. */
function gunSonunaKalanMs(): number {
  const simdi = new Date();
  const ertesi = Date.UTC(
    simdi.getUTCFullYear(),
    simdi.getUTCMonth(),
    simdi.getUTCDate() + 1,
    0, 0, 0, 0,
  );
  return ertesi - simdi.getTime();
}

/**
 * Toplu listelere ayrılan üst sınır. Tamamı listeye gitseydi kullanıcı bir
 * varlığa tıkladığında o sembol için kredi kalmazdı; detay sayfası listeden
 * daha önemli.
 */
export const TOPLU_PAY = Math.max(1, KREDI_LIMITI - 2);

/**
 * Tek bir piyasanın bir turda alabileceği en fazla kredi.
 *
 * Sınırsız bırakılınca ilk açılan piyasa bütçenin tamamını yiyor, diğerine
 * geçen kullanıcı bomboş bir ekran görüyordu. Piyasa başına pay verilince üç
 * piyasa da her turda biraz ilerler; hepsi birkaç dakikada dolar.
 */
export const PIYASA_PAY = Math.max(2, Math.floor(TOPLU_PAY / 2));

/* ────────────────────────── Bellek içi sayaç ────────────────────────── */

let pencereBasi = 0;
let kullanilan = 0;
let blokBitis = 0;

function yerelAyir(adet: number): number {
  const simdi = Date.now();
  if (simdi - pencereBasi > PENCERE_MS) {
    pencereBasi = simdi;
    kullanilan = 0;
  }
  const verilen = Math.min(adet, Math.max(0, KREDI_LIMITI - kullanilan));
  kullanilan += verilen;
  return verilen;
}

/** Testler ve yeniden başlatma için. */
export function krediSifirla(): void {
  pencereBasi = 0;
  kullanilan = 0;
  blokBitis = 0;
}

/* ────────────────────────── Paylaşımlı sayaç ────────────────────────── */

type SayacSatiri = { sayac: number };

/**
 * İstenen kadar kredi ayırmayı dener; ayrılabilen sayıyı döndürür.
 *
 * Önce bellekteki sayaç bakar (hızlı ve veritabanına gitmeden reddeder), sonra
 * paylaşımlı sayacı atomik olarak artırır. Fazla sayıldıysa artan kadarı geri
 * verilir; böylece iki örnek aynı anda istese bile toplam sınır aşılmaz.
 */
export async function krediAyir(adet: number, tekil = false): Promise<number> {
  if (adet < 1) return 0;
  if (await kotaBloklu()) return 0;

  const yerel = yerelAyir(adet);
  if (yerel < 1 || !postgresEnabled()) return yerel;

  // Önce dakikalık, sonra günlük sayaç. İkisi de aşılmamalı.
  const dakikalik = await sayacArtir("kredi", yerel, PENCERE_MS, KREDI_LIMITI);
  if (dakikalik < 1) return 0;

  const gunlukSinir = tekil ? GUNLUK_LIMIT : GUNLUK_LIMIT - GUNLUK_YEDEK;
  const gunluk = await sayacArtir(gunAnahtari(), dakikalik, gunSonunaKalanMs(), gunlukSinir);

  // Günlük sınır yüzünden verilemeyen kısım dakikalık sayaçtan da düşülür.
  if (gunluk < dakikalik) await sayacGeriVer("kredi", dakikalik - gunluk);
  return gunluk;
}

/**
 * Sayacı atomik olarak artırır ve verilebilen krediyi döndürür.
 * Süresi geçmiş pencere sıfırlanır; fazlası aynı sorguda geri alınır.
 */
async function sayacArtir(
  anahtar: string,
  adet: number,
  omurMs: number,
  sinir: number,
): Promise<number> {
  try {
    await ensureSchema();
    const simdi = Date.now();
    const satirlar = await query<SayacSatiri>(
      `insert into piyasa_kota (anahtar, sayac, biter)
       values ($4, $1, $2)
       on conflict (anahtar) do update
         set sayac = case when piyasa_kota.biter < $3 then $1 else piyasa_kota.sayac + $1 end,
             biter = case when piyasa_kota.biter < $3 then $2 else piyasa_kota.biter end
       returning sayac`,
      [adet, simdi + omurMs, simdi, anahtar],
    );

    const toplam = Number(satirlar[0]?.sayac ?? adet);
    const oncekiler = toplam - adet;
    const verilen = Math.min(adet, Math.max(0, sinir - oncekiler));

    if (verilen < adet) await sayacGeriVer(anahtar, adet - verilen);
    return verilen;
  } catch {
    // Veritabanına ulaşılamazsa bellek içi sayaç tek koruma olarak kalır.
    return adet;
  }
}

async function sayacGeriVer(anahtar: string, adet: number): Promise<void> {
  if (adet < 1) return;
  await query("update piyasa_kota set sayac = greatest(0, sayac - $1) where anahtar = $2", [
    adet,
    anahtar,
  ]).catch(() => undefined);
}

/* ────────────────────────── Ortak geri çekilme ────────────────────────── */

/**
 * Sağlayıcıdan gerçek bir kota hatası gelince tüm örnekler susar.
 *
 * Tek örneğin susması yetmiyor: diğerleri istemeye devam edince sağlayıcı
 * hesabı daha da kısıtlıyor. Bloğu veritabanına yazmak, bir örneğin öğrendiğini
 * hepsine öğretir.
 */
export async function kotaBlokla(saniye = 60): Promise<void> {
  const biter = Date.now() + saniye * 1000;
  blokBitis = Math.max(blokBitis, biter);
  if (!postgresEnabled()) return;

  try {
    await ensureSchema();
    await query(
      `insert into piyasa_kota (anahtar, sayac, biter) values ('blok', 0, $1)
       on conflict (anahtar) do update set biter = greatest(piyasa_kota.biter, excluded.biter)`,
      [biter],
    );
  } catch {
    // Yazamazsak yalnızca bu örnek geri çekilir.
  }
}

export async function kotaBloklu(): Promise<boolean> {
  if (blokBitis > Date.now()) return true;
  if (!postgresEnabled()) return false;

  try {
    await ensureSchema();
    const satirlar = await query<{ biter: string }>(
      "select biter from piyasa_kota where anahtar = 'blok' and biter > $1",
      [Date.now()],
    );
    if (satirlar.length === 0) return false;
    blokBitis = Number(satirlar[0].biter);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sağlayıcının hata metnine bakarak ne kadar susulacağına karar verir.
 *
 * "for the day" diyen bir yanıttan sonra bir dakika bekleyip yeniden denemek
 * boşuna: kota ertesi güne kadar dolu. Günlük hatada gün sonuna, dakikalık
 * hatada bir dakikaya kadar susulur.
 */
export async function kotaHatasiniIsle(mesaj: string): Promise<void> {
  const gunluk = /for the day|daily limit|günlük/i.test(mesaj);
  await kotaBlokla(gunluk ? Math.ceil(gunSonunaKalanMs() / 1000) : 60);
}

/** Bloğun bitişine kalan saniye. */
export function blokKalanSaniye(): number {
  return Math.max(0, Math.ceil((blokBitis - Date.now()) / 1000));
}

/**
 * Kullanıcıya gösterilecek kota mesajı.
 *
 * "Birazdan tekrar deneyin" demek, günlük kota bittiğinde yanlış bilgi olur:
 * kullanıcı sayfayı boşuna yeniler. Bekleme süresine göre doğru cümle seçilir.
 */
export function kotaMesaji(): string {
  const kalan = blokKalanSaniye();
  if (kalan > 300) {
    const saat = Math.floor(kalan / 3600);
    const dakika = Math.round((kalan % 3600) / 60);
    const sure = saat > 0 ? `${saat} saat ${dakika} dakika` : `${dakika} dakika`;
    return (
      `Günlük ücretsiz veri kotası doldu; sağlayıcı ${sure} sonra sıfırlıyor. ` +
      "O zamana kadar kripto piyasası ve daha önce yüklenmiş veriler çalışmaya devam eder."
    );
  }
  return (
    "Ücretsiz veri kotası şu an dolu. Liste birkaç dakika içinde kendiliğinden dolacak; " +
    "aradığınız varlığı arama kutusundan bulup hemen analiz edebilirsiniz."
  );
}

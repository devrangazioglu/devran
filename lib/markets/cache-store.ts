/**
 * Piyasa verisi için paylaşımlı önbellek (Postgres).
 *
 * Neden bellek yetmiyor: ücretsiz veri katmanı günde sabit sayıda kredi
 * veriyor ve her sembol bir kredi harcıyor. Uygulama sunucusuz çalıştığı için
 * her örneğin kendi belleği var ve soğuk başlangıçta siliniyor; aynı sembol
 * gün içinde defalarca isteniyor, günlük kota öğlene kalmadan bitiyordu.
 *
 * Günlük mumlar günde bir kez değiştiğinden veriyi veritabanında paylaşmak
 * hem kotayı koruyor hem de bir kez dolan listenin dolu kalmasını sağlıyor:
 * bir ziyaretçinin doldurduğu sembolleri sonraki ziyaretçi bedavaya görüyor.
 *
 * Önbellek asla sayfayı düşürmemeli; bu yüzden buradaki tüm hatalar yutulur,
 * hata durumunda çağıran "önbellekte yok" muamelesi görür.
 */

import { ensureSchema, postgresEnabled, query } from "../db";

export type SharedEntry<T> = { deger: T; biter: number };

type Satir = { anahtar: string; deger: unknown; biter: string };

/** Süresi geçmiş kayıtlar ara sıra temizlenir; her istekte silmeye gerek yok. */
let sonTemizlik = 0;
const TEMIZLIK_ARASI_MS = 10 * 60_000;

async function temizle(): Promise<void> {
  const simdi = Date.now();
  if (simdi - sonTemizlik < TEMIZLIK_ARASI_MS) return;
  sonTemizlik = simdi;
  await query("delete from piyasa_onbellek where biter < $1", [simdi]).catch(() => undefined);
}

/** Verilen anahtarların süresi geçmemiş kayıtları. */
export async function paylasilanOku<T>(anahtarlar: string[]): Promise<Map<string, SharedEntry<T>>> {
  const out = new Map<string, SharedEntry<T>>();
  if (!postgresEnabled() || anahtarlar.length === 0) return out;

  try {
    await ensureSchema();
    const satirlar = await query<Satir>(
      "select anahtar, deger, biter from piyasa_onbellek where anahtar = any($1) and biter > $2",
      [anahtarlar, Date.now()],
    );
    for (const satir of satirlar) {
      out.set(satir.anahtar, { deger: satir.deger as T, biter: Number(satir.biter) });
    }
  } catch {
    // Veritabanı erişilemezse önbellek yokmuş gibi devam edilir.
  }
  return out;
}

/** Tek kaydı yazar (varsa üzerine). */
export async function paylasilanYaz(
  anahtar: string,
  deger: unknown,
  ttlMs: number,
): Promise<void> {
  if (!postgresEnabled()) return;

  try {
    await ensureSchema();
    await query(
      `insert into piyasa_onbellek (anahtar, deger, biter)
       values ($1, $2::jsonb, $3)
       on conflict (anahtar) do update set deger = excluded.deger, biter = excluded.biter`,
      [anahtar, JSON.stringify(deger), Date.now() + ttlMs],
    );
    await temizle();
  } catch {
    // Yazamamak veriyi bozmaz, yalnızca bir sonraki istekte yeniden çekilir.
  }
}

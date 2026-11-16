/**
 * Engellenen kaynaklara açık aktarıcı üzerinden erişim.
 *
 * Sorun: Yahoo, isteği **nereden** geldiğine bakarak engelliyor. Vercel'in IP
 * aralığı da GitHub çalıştırıcılarının aralığı da yasaklı — ikisinde de her
 * sembolde HTTP 429 geliyor (ölçüldü: 2026-11-16, `scripts/kaynak-tara.ts`).
 * Verinin kendisi ücretsiz ve açık; kapalı olan tek şey bizim adresimiz.
 *
 * Çözüm: isteği araya giren açık bir aktarıcıya yaptırmak. Aktarıcı isteği
 * kendi makinesinden geçirdiği için yanıt normal şekilde geliyor. Aynı ölçümde
 * `allorigins` üzerinden THYAO.IS günlük mumları ve AAPL 15 dakikalık serisi
 * sorunsuz alındı.
 *
 * Bunun bedeli var ve görmezden gelinmemeli:
 *   • Aktarıcı üçüncü bir taraf; yavaşlayabilir, kapanabilir, hız sınırı
 *     koyabilir. Bu yüzden birden çok aktarıcı sırayla denenir ve çalışan
 *     hatırlanır.
 *   • Her istek bir kez daha ağ atlaması demek; bu yüzden yanıtlar
 *     veritabanındaki paylaşımlı önbelleğe yazılır ve asıl yük beslemeye
 *     (GitHub Actions) bırakılır.
 *   • Gizli bir veri gönderilmez: sorgular herkese açık fiyat adresleridir,
 *     kullanıcıya ait hiçbir bilgi taşımaz.
 *
 * `ARACI_KAPALI=1` ile tümüyle devre dışı bırakılabilir.
 */

/** Bir aktarıcı: verilen adresi kendi adresine sarar. */
export type Aktarici = {
  ad: string;
  sar: (url: string) => string;
};

/**
 * Sıra önemli: ölçümde en hızlı ve en kararlı çıkan başta.
 * `ARACILAR` ortam değişkeniyle değiştirilebilir (virgülle ayrılmış,
 * `{url}` yer tutuculu şablonlar) — bir aktarıcı kapanırsa yeniden dağıtım
 * beklemeden değiştirilebilsin diye.
 */
export const AKTARICILAR: Aktarici[] = ozelAktaricilar() ?? [
  {
    ad: "allorigins",
    sar: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  },
  {
    ad: "corsproxy",
    sar: (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  },
  {
    ad: "cors.lol",
    sar: (url) => `https://api.cors.lol/?url=${encodeURIComponent(url)}`,
  },
];

function ozelAktaricilar(): Aktarici[] | null {
  const ham = process.env.ARACILAR?.trim();
  if (!ham) return null;
  const sablonlar = ham
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.includes("{url}"));
  if (sablonlar.length === 0) return null;
  return sablonlar.map((sablon, index) => ({
    ad: `özel-${index + 1}`,
    sar: (url: string) => sablon.replace("{url}", encodeURIComponent(url)),
  }));
}

export function aktariciAcik(): boolean {
  return process.env.ARACI_KAPALI !== "1" && AKTARICILAR.length > 0;
}

/**
 * Çalıştığı bilinen aktarıcı.
 *
 * Her istekte listenin başından başlamak, kapalı bir aktarıcıya sürekli
 * zaman kaybettirmek demek; çalışan hatırlanır ve bir sonraki istek oradan
 * başlar.
 */
let sonCalisan: string | null = null;

/** Sıralı aktarıcı listesi: çalıştığı bilinen önce. */
function sira(): Aktarici[] {
  if (!sonCalisan) return AKTARICILAR;
  const once = AKTARICILAR.filter((a) => a.ad === sonCalisan);
  return [...once, ...AKTARICILAR.filter((a) => a.ad !== sonCalisan)];
}

/** Testler için. */
export function aktariciDurumunuSifirla(): void {
  sonCalisan = null;
}

export function calisanAktarici(): string | null {
  return sonCalisan;
}

export type AktariciSonuc = {
  govde: string;
  aktarici: string;
  sure: number;
};

/**
 * Adresi aktarıcılar üzerinden çeker; ilk başarılı yanıtı döndürür.
 *
 * Boş ya da HTML (engel sayfası) yanıt başarı sayılmaz: aktarıcılar hatayı
 * çoğu zaman 200 ile birlikte gövdede gönderiyor.
 */
export async function aktariciIleGetir(
  url: string,
  { zamanAsimiMs = 9_000 }: { zamanAsimiMs?: number } = {},
): Promise<AktariciSonuc | null> {
  if (!aktariciAcik()) return null;

  for (const aktarici of sira()) {
    const basladi = Date.now();
    try {
      const yanit = await fetch(aktarici.sar(url), {
        headers: { accept: "application/json, text/plain, */*" },
        signal: AbortSignal.timeout(zamanAsimiMs),
        cache: "no-store",
      });
      if (!yanit.ok) continue;

      const govde = await yanit.text();
      // Aktarıcının kendi hata sayfası JSON gibi görünmez; ucuz bir elek.
      if (govde.length < 2 || govde.trimStart().startsWith("<")) continue;

      sonCalisan = aktarici.ad;
      return { govde, aktarici: aktarici.ad, sure: Date.now() - basladi };
    } catch {
      // Sıradaki aktarıcı denenir; hangisinin neden düştüğü çağıranı
      // ilgilendirmiyor, önemli olan veri geldi mi gelmedi mi.
      continue;
    }
  }

  sonCalisan = null;
  return null;
}

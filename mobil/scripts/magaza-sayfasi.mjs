#!/usr/bin/env node
/**
 * App Store sayfasını App Store Connect API ile doldurur.
 *
 * Her adım bağımsızdır: biri başarısız olursa diğerleri yine çalışır ve
 * sonunda neyin yapıldığı, neyin elle yapılması gerektiği özetlenir.
 * Yeniden çalıştırmak güvenlidir; var olan kayıtları günceller.
 *
 *   1. Kategori, ad, alt başlık, gizlilik adresi (Türkçe + İngilizce)
 *   2. Yaş derecelendirmesi
 *   3. Sürüm: numara, telif, açıklama, anahtar kelimeler, adresler
 *   4. Fiyat (ücretsiz) ve ülkeler (Çin hariç; orada ayrı lisans gerekir)
 *   5. İnceleme ekibi için demo hesap: sitede açar, bilgileri yalnızca
 *      App Store Connect'e yazar (günlüğe hiçbir zaman yazılmaz)
 *   6. Ekran görüntüleri: demo hesapla sitede gezip uygulama görünümünde
 *      çeker, başlıklı mağaza görseline dönüştürür, yükler
 *   7. Son yüklenen derlemeyi sürüme bağlar
 *   8. (GONDER=evet ise) incelemeye gönderir
 *
 * Ortam: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8, PAKET_KIMLIGI, SURUM,
 *        GONDER, GORSEL_KLASORU; isteğe bağlı INCELEME_AD/SOYAD/TELEFON/EPOSTA.
 */

import { randomBytes } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { AscHatasi, istemci } from "./asc-istemci.mjs";
import {
  AD_ADAYLARI,
  ADRESLER,
  DILLER,
  EKRANLAR,
  INCELEME_NOTU,
  SITE,
  TELIF,
} from "../magaza/metinler.mjs";

const ENV = process.env;
const PAKET = ENV.PAKET_KIMLIGI;
const SURUM = ENV.SURUM || "1.0.0";
const GONDER = ENV.GONDER === "evet" || ENV.GONDER === "true";
const GORSEL = ENV.GORSEL_KLASORU || "magaza-gorselleri";

const { istek, parcaliYukle } = istemci({
  keyId: ENV.ASC_KEY_ID.trim(),
  issuerId: ENV.ASC_ISSUER_ID.trim(),
  p8: ENV.ASC_KEY_P8,
});

/* ─────────────────────────── özet ─────────────────────────── */

const sonuclar = [];
const elle = [];

function ozetYaz() {
  const satirlar = [
    "## Mağaza sayfası",
    "",
    "| Adım | Durum | Ayrıntı |",
    "|---|---|---|",
    ...sonuclar.map(([ad, ok, not]) => `| ${ad} | ${ok ? "tamam" : "**hata**"} | ${String(not).replace(/\|/g, "/")} |`),
    "",
  ];
  if (elle.length) {
    satirlar.push("### Elle yapılacaklar", "", ...elle.map((x, i) => `${i + 1}. ${x}`), "");
  }
  const metin = satirlar.join("\n");
  console.log(metin);
  if (ENV.GITHUB_STEP_SUMMARY) appendFileSync(ENV.GITHUB_STEP_SUMMARY, metin + "\n");
}

async function adim(ad, is) {
  try {
    const not = await is();
    sonuclar.push([ad, true, not ?? ""]);
    console.log(`✓ ${ad}${not ? ` — ${not}` : ""}`);
    return true;
  } catch (hata) {
    const not = hata instanceof AscHatasi ? hata.message : hata?.message ?? String(hata);
    sonuclar.push([ad, false, not]);
    console.log(`✗ ${ad} — ${not}`);
    return false;
  }
}

const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

/* ───────────────────────── uygulama ───────────────────────── */

const uygulamalar = await istek(`/apps?filter[bundleId]=${encodeURIComponent(PAKET)}&limit=10`);
const uygulama = uygulamalar.data.find((u) => u.attributes.bundleId === PAKET);
if (!uygulama) {
  sonuclar.push(["Uygulama", false, `App Store Connect'te ${PAKET} kimlikli uygulama yok`]);
  ozetYaz();
  process.exit(1);
}
const APP = uygulama.id;

const DUZENLENEBILIR = new Set([
  "PREPARE_FOR_SUBMISSION",
  "DEVELOPER_REJECTED",
  "REJECTED",
  "METADATA_REJECTED",
  "INVALID_BINARY",
  "WAITING_FOR_REVIEW",
]);

const bilgiler = await istek(`/apps/${APP}/appInfos?limit=10`);
const bilgi =
  bilgiler.data.find((b) => DUZENLENEBILIR.has(b.attributes.state ?? b.attributes.appStoreState)) ??
  bilgiler.data[0];

const surumler = await istek(`/apps/${APP}/appStoreVersions?filter[platform]=IOS&limit=20`);
let surum = surumler.data.find((s) =>
  DUZENLENEBILIR.has(s.attributes.appVersionState ?? s.attributes.appStoreState),
);

/* ─────────────────── 1. kategori ve uygulama bilgisi ─────────────────── */

await adim("Kategori (Finans / İş)", async () => {
  await istek(`/appInfos/${bilgi.id}`, {
    method: "PATCH",
    body: {
      data: {
        type: "appInfos",
        id: bilgi.id,
        relationships: {
          primaryCategory: { data: { type: "appCategories", id: "FINANCE" } },
          secondaryCategory: { data: { type: "appCategories", id: "BUSINESS" } },
        },
      },
    },
  });
});

const bilgiYerelleri = await istek(`/appInfos/${bilgi.id}/appInfoLocalizations?limit=50`);

async function bilgiYereliYaz(dil, alanlar) {
  const var_ = bilgiYerelleri.data.find((y) => y.attributes.locale === dil);
  if (var_) {
    await istek(`/appInfoLocalizations/${var_.id}`, {
      method: "PATCH",
      body: { data: { type: "appInfoLocalizations", id: var_.id, attributes: alanlar } },
    });
    return var_.id;
  }
  const yeni = await istek(`/appInfoLocalizations`, {
    method: "POST",
    body: {
      data: {
        type: "appInfoLocalizations",
        attributes: { locale: dil, ...alanlar },
        relationships: { appInfo: { data: { type: "appInfos", id: bilgi.id } } },
      },
    },
  });
  bilgiYerelleri.data.push(yeni.data);
  return yeni.data.id;
}

for (const dil of Object.keys(DILLER)) {
  await adim(`Ad, alt başlık, gizlilik adresi (${dil})`, async () => {
    const temel = { subtitle: DILLER[dil].altBaslik, privacyPolicyUrl: ADRESLER.gizlilik };
    // Ad mağazada benzersiz olmalı; alınmışsa sıradaki aday denenir.
    // Yeni dil eklerken Apple adı da zorunlu tutuyor, o yüzden birlikte gönderilir.
    let sonHata = null;
    for (const ad of AD_ADAYLARI) {
      try {
        await bilgiYereliYaz(dil, { ...temel, name: ad });
        return `ad: ${ad}`;
      } catch (hata) {
        sonHata = hata;
        if (hata?.durum === 401 || hata?.durum === 403) break;
      }
    }
    const varMi = bilgiYerelleri.data.some((y) => y.attributes.locale === dil);
    if (varMi) {
      await bilgiYereliYaz(dil, temel);
      elle.push(
        `Uygulama adı (${dil}) değiştirilemedi: App Store Connect → Uygulama Bilgileri → Ad. Apple'ın cevabı: ${sonHata?.ayrinti ?? sonHata?.message}`,
      );
      return "alt başlık yazıldı; ad değiştirilemedi";
    }
    throw sonHata;
  });
}

/* ─────────────────────── 2. yaş derecelendirmesi ─────────────────────── */

await adim("Yaş derecelendirmesi", async () => {
  const yanit = await istek(`/appInfos/${bilgi.id}/ageRatingDeclaration`);
  const kayit = yanit.data;
  const mevcut = kayit.attributes ?? {};
  // İçerik soruları: hepsi "yok". Yalnızca Apple'ın bu hesapta sorduğu
  // alanlar gönderilir; yeni eklenen bilinmeyen bir soru varsa elle yapılır.
  const YOK = "NONE";
  const istenen = {
    alcoholTobaccoOrDrugUseOrReferences: YOK,
    contests: YOK,
    gamblingSimulated: YOK,
    gunsOrOtherWeapons: YOK,
    horrorOrFearThemes: YOK,
    matureOrSuggestiveThemes: YOK,
    medicalOrTreatmentInformation: YOK,
    profanityOrCrudeHumor: YOK,
    sexualContentGraphicAndNudity: YOK,
    sexualContentOrNudity: YOK,
    violenceCartoonOrFantasy: YOK,
    violenceRealistic: YOK,
    violenceRealisticProlongedGraphicOrSadistic: YOK,
    gambling: false,
    lootBox: false,
    unrestrictedWebAccess: false,
    messagingAndChat: false,
    userGeneratedContent: false,
    advertising: false,
    parentalControls: false,
    ageAssurance: false,
    healthOrWellnessTopics: false,
  };
  const gonderilecek = Object.fromEntries(Object.entries(istenen).filter(([k]) => k in mevcut));
  // Apple yeni bir soru eklediyse adını hata mesajında söylüyor: önce "hayır"
  // (false), değer türü uymazsa "yok" (NONE) olarak yanıtlanır.
  for (let deneme = 0; deneme < 12; deneme++) {
    try {
      await istek(`/ageRatingDeclarations/${kayit.id}`, {
        method: "PATCH",
        body: { data: { type: "ageRatingDeclarations", id: kayit.id, attributes: gonderilecek } },
      });
      break;
    } catch (hata) {
      const eksik = /attribute '([A-Za-z]+)'/.exec(hata?.ayrinti ?? "")?.[1];
      if (!eksik || deneme === 11) throw hata;
      if (!(eksik in gonderilecek)) gonderilecek[eksik] = false;
      else if (gonderilecek[eksik] === false) gonderilecek[eksik] = YOK;
      else throw hata;
      istenen[eksik] = gonderilecek[eksik];
      console.log(`  yaş sorusu eklendi: ${eksik} = ${gonderilecek[eksik]}`);
    }
  }
  const bilinmeyen = Object.keys(mevcut).filter(
    (k) => !(k in istenen) && mevcut[k] === null && !["kidsAgeBand", "ageRatingOverride", "ageRatingOverrideV2", "koreaAgeRatingOverride", "seventeenPlus", "developerAgeRatingInfoUrl"].includes(k),
  );
  if (bilinmeyen.length) {
    elle.push(`Yaş derecelendirmesinde yanıtlanmamış soru(lar): ${bilinmeyen.join(", ")} — App Store Connect → Uygulama Bilgileri → Yaş Derecelendirmesi.`);
  }
  return `${Object.keys(gonderilecek).length} soru yanıtlandı`;
});

/* ───────────────────────────── 3. sürüm ───────────────────────────── */

await adim(`Sürüm ${SURUM}`, async () => {
  if (!surum) {
    const yeni = await istek(`/appStoreVersions`, {
      method: "POST",
      body: {
        data: {
          type: "appStoreVersions",
          attributes: { platform: "IOS", versionString: SURUM, copyright: TELIF, releaseType: "AFTER_APPROVAL" },
          relationships: { app: { data: { type: "apps", id: APP } } },
        },
      },
    });
    surum = yeni.data;
    return "yeni sürüm açıldı";
  }
  await istek(`/appStoreVersions/${surum.id}`, {
    method: "PATCH",
    body: {
      data: {
        type: "appStoreVersions",
        id: surum.id,
        attributes: { versionString: SURUM, copyright: TELIF, releaseType: "AFTER_APPROVAL" },
      },
    },
  });
  return `telif: ${TELIF}, onaydan sonra otomatik yayın`;
});

let surumYerelleri = surum ? await istek(`/appStoreVersions/${surum.id}/appStoreVersionLocalizations?limit=50`) : { data: [] };

async function surumYereli(dil) {
  let yerel = surumYerelleri.data.find((y) => y.attributes.locale === dil);
  if (!yerel) {
    const yeni = await istek(`/appStoreVersionLocalizations`, {
      method: "POST",
      body: {
        data: {
          type: "appStoreVersionLocalizations",
          attributes: { locale: dil },
          relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: surum.id } } },
        },
      },
    });
    yerel = yeni.data;
    surumYerelleri.data.push(yerel);
  }
  return yerel;
}

for (const [dil, m] of Object.entries(DILLER)) {
  await adim(`Açıklama ve anahtar kelimeler (${dil})`, async () => {
    const yerel = await surumYereli(dil);
    await istek(`/appStoreVersionLocalizations/${yerel.id}`, {
      method: "PATCH",
      body: {
        data: {
          type: "appStoreVersionLocalizations",
          id: yerel.id,
          attributes: {
            description: m.aciklama,
            keywords: m.anahtarKelimeler,
            promotionalText: m.promosyon,
            supportUrl: ADRESLER.destek,
            marketingUrl: ADRESLER.pazarlama,
          },
        },
      },
    });
  });
}

/* ───────────────────── 4. fiyat ve ülkeler ───────────────────── */

await adim("Fiyat: ücretsiz", async () => {
  try {
    const mevcut = await istek(`/apps/${APP}/appPriceSchedule`);
    if (mevcut.data?.id) {
      const fiyatlar = await istek(`/appPriceSchedules/${mevcut.data.id}/manualPrices?include=appPricePoint&limit=5`).catch(() => null);
      const nokta = fiyatlar?.included?.find((i) => i.type === "appPricePoints");
      if (nokta && Number(nokta.attributes.customerPrice) === 0) return "zaten ücretsiz";
    }
  } catch {
    /* fiyat yok: oluşturulacak */
  }
  let sifir = null;
  let sonraki = `/apps/${APP}/appPricePoints?filter[territory]=USA&limit=200`;
  while (sonraki && !sifir) {
    const sayfa = await istek(sonraki);
    sifir = sayfa.data.find((p) => Number(p.attributes.customerPrice) === 0);
    sonraki = sayfa.links?.next ?? null;
  }
  if (!sifir) throw new Error("ücretsiz fiyat noktası bulunamadı");
  await istek(`/appPriceSchedules`, {
    method: "POST",
    body: {
      data: {
        type: "appPriceSchedules",
        relationships: {
          app: { data: { type: "apps", id: APP } },
          baseTerritory: { data: { type: "territories", id: "USA" } },
          manualPrices: { data: [{ type: "appPrices", id: "${fiyat}" }] },
        },
      },
      included: [
        {
          type: "appPrices",
          id: "${fiyat}",
          attributes: { startDate: null },
          relationships: { appPricePoint: { data: { type: "appPricePoints", id: sifir.id } } },
        },
      ],
    },
  });
  return "ücretsiz olarak ayarlandı";
});

await adim("Ülkeler (Çin hariç tümü)", async () => {
  try {
    const mevcut = await istek(`/apps/${APP}/appAvailabilityV2`);
    if (mevcut.data?.id) return "zaten ayarlı (değiştirilmedi)";
  } catch {
    /* yok: oluşturulacak */
  }
  const ulkeler = [];
  let sonraki = `/territories?limit=200`;
  while (sonraki) {
    const sayfa = await istek(sonraki);
    ulkeler.push(...sayfa.data.map((t) => t.id));
    sonraki = sayfa.links?.next ?? null;
  }
  // Apple listede bütün ülkeleri istiyor; Çin "kapalı" olarak gönderilir.
  const acik = ulkeler.filter((id) => id !== "CHN");
  await istek(`/v2/appAvailabilities`, {
    method: "POST",
    body: {
      data: {
        type: "appAvailabilities",
        attributes: { availableInNewTerritories: true },
        relationships: {
          app: { data: { type: "apps", id: APP } },
          territoryAvailabilities: { data: ulkeler.map((id) => ({ type: "territoryAvailabilities", id: `\${${id}}` })) },
        },
      },
      included: ulkeler.map((id) => ({
        type: "territoryAvailabilities",
        id: `\${${id}}`,
        attributes: { available: id !== "CHN" },
        relationships: { territory: { data: { type: "territories", id } } },
      })),
    },
  });
  return `${acik.length} ülke`;
});

/* ──────────────────── 5. demo hesap ve inceleme bilgisi ──────────────────── */

let demo = null;

async function siteyeKaydol(eposta, parola) {
  const yanit = await fetch(`${SITE}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: eposta, password: parola, name: "App Review", kabul: true }),
  });
  return yanit.status; // 201 açıldı, 409 zaten var
}

async function siteyeGirebilir(eposta, parola) {
  // Auth.js kimlik bilgisi girişi: önce CSRF, sonra form gönderimi.
  const csrfYanit = await fetch(`${SITE}/api/auth/csrf`);
  const { csrfToken } = await csrfYanit.json();
  const cerez = (csrfYanit.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  const yanit = await fetch(`${SITE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: cerez },
    body: new URLSearchParams({ csrfToken, email: eposta, password: parola, callbackUrl: `${SITE}/panel` }),
  });
  const yer = yanit.headers.get("location") ?? "";
  const oturum = (yanit.headers.getSetCookie?.() ?? []).some((c) => /session-token=/.test(c));
  return oturum && !/error=/.test(yer);
}

await adim("Demo hesap ve inceleme notu", async () => {
  if (!surum) throw new Error("düzenlenebilir sürüm yok");
  let detay = null;
  try {
    detay = (await istek(`/appStoreVersions/${surum.id}/appStoreReviewDetail`)).data;
  } catch {
    detay = null;
  }
  const kayitli = detay?.attributes;
  if (kayitli?.demoAccountName && kayitli?.demoAccountPassword) {
    console.log(`::add-mask::${kayitli.demoAccountPassword}`);
    if (await siteyeGirebilir(kayitli.demoAccountName, kayitli.demoAccountPassword)) {
      demo = { eposta: kayitli.demoAccountName, parola: kayitli.demoAccountPassword };
    }
  }
  let yeniAcildi = false;
  if (!demo) {
    for (let i = 1; i <= 6 && !demo; i++) {
      const eposta = i === 1 ? "inceleme@fibonex360.com" : `inceleme${i}@fibonex360.com`;
      const parola = `Fx${randomBytes(12).toString("base64url")}7a`;
      console.log(`::add-mask::${parola}`);
      const durum = await siteyeKaydol(eposta, parola);
      if (durum === 201) {
        demo = { eposta, parola };
        yeniAcildi = true;
      } else if (durum !== 409) {
        throw new Error(`sitede hesap açılamadı (HTTP ${durum})`);
      }
    }
    if (!demo) throw new Error("boş bir demo e-postası bulunamadı");
  }

  const iletisim = Object.fromEntries(
    [
      ["contactFirstName", ENV.INCELEME_AD],
      ["contactLastName", ENV.INCELEME_SOYAD],
      ["contactPhone", ENV.INCELEME_TELEFON],
      ["contactEmail", ENV.INCELEME_EPOSTA],
    ].filter(([, v]) => v && v.trim()),
  );
  const alanlar = {
    demoAccountRequired: true,
    demoAccountName: demo.eposta,
    demoAccountPassword: demo.parola,
    notes: INCELEME_NOTU,
    ...iletisim,
  };
  if (detay?.id) {
    await istek(`/appStoreReviewDetails/${detay.id}`, {
      method: "PATCH",
      body: { data: { type: "appStoreReviewDetails", id: detay.id, attributes: alanlar } },
    });
  } else {
    await istek(`/appStoreReviewDetails`, {
      method: "POST",
      body: {
        data: {
          type: "appStoreReviewDetails",
          attributes: alanlar,
          relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: surum.id } } },
        },
      },
    });
  }
  const eksikIletisim = !kayitli?.contactPhone && !iletisim.contactPhone;
  if (eksikIletisim) {
    elle.push(
      "İnceleme iletişim bilgisi: App Store Connect → sürüm 1.0.0 → App İnceleme Bilgileri → ad, soyad, telefon, e-posta (Apple yalnızca soru sormak için kullanır).",
    );
  }
  return `${demo.eposta} ${yeniAcildi ? "(yeni açıldı)" : "(var olan)"}; parola yalnızca App Store Connect'te`;
});

/* ─────────────────────────── 6. ekran görüntüleri ─────────────────────────── */

const SAHNE = (baslik, alt, resim) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;700;800&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:440px;height:956px;overflow:hidden}
  body{font-family:Inter,system-ui,sans-serif;color:#fff;
    background:radial-gradient(120% 60% at 50% 0%,#0f3d2e 0%,#071a14 45%,#05070c 100%);}
  .ust{padding:58px 34px 0;text-align:center}
  .rozet{display:inline-flex;gap:6px;align-items:center;font-size:12px;font-weight:700;letter-spacing:.14em;
    color:#4ade80;text-transform:uppercase;margin-bottom:14px}
  .rozet i{width:6px;height:6px;border-radius:50%;background:#4ade80;box-shadow:0 0 12px #4ade80}
  h1{font-size:38px;line-height:1.08;font-weight:800;letter-spacing:-.02em;white-space:pre-line}
  p{margin:14px auto 0;max-width:340px;font-size:15.5px;line-height:1.4;color:#a7b4c2;font-weight:500}
  .cerceve{position:absolute;left:50%;transform:translateX(-50%);top:262px;width:356px;height:774px;
    border-radius:46px;padding:10px;background:linear-gradient(160deg,#2a3340,#0c1118 60%);
    box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.08) inset}
  .ekran{width:100%;height:100%;border-radius:37px;overflow:hidden;background:#05070c}
  .ekran img{width:100%;display:block}
</style></head><body>
<div class="ust"><div class="rozet"><i></i>Fibonex360</div><h1>${baslik}</h1><p>${alt}</p></div>
<div class="cerceve"><div class="ekran"><img src="data:image/png;base64,${resim}"></div></div>
</body></html>`;

const gorseller = [];

await adim("Ekran görüntüleri: çekim", async () => {
  if (!demo) throw new Error("demo hesap yok, üye sayfaları çekilemedi");
  const { chromium } = await import("playwright");
  mkdirSync(join(GORSEL, "ham"), { recursive: true });
  const tarayici = await chromium.launch();
  try {
    // Uygulamanın içindeki görünüm: iPhone + kabuğun kullanıcı aracı eki.
    const baglam = await tarayici.newContext({
      viewport: { width: 440, height: 956 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      locale: "tr-TR",
      timezoneId: "Europe/Istanbul",
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Fibonex360App",
    });
    const sayfa = await baglam.newPage();
    await sayfa.goto(`${SITE}/giris`, { waitUntil: "networkidle", timeout: 60_000 });
    await sayfa.fill('input[type="email"]', demo.eposta);
    await sayfa.fill('input[type="password"]', demo.parola);
    await sayfa.click('button[type="submit"]');
    await sayfa.waitForURL(/\/panel/, { timeout: 45_000 });

    for (const e of EKRANLAR) {
      await sayfa.goto(`${SITE}${e.yol}`, { waitUntil: "networkidle", timeout: 90_000 }).catch(() => {});
      await sayfa.waitForTimeout(6000);
      if (e.kaydir) {
        await sayfa
          .locator(e.kaydir)
          .first()
          .evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 70))
          .catch(() => {});
      } else {
        await sayfa.evaluate(() => window.scrollTo(0, 0));
      }
      await sayfa.waitForTimeout(1500);
      const yol = join(GORSEL, "ham", `${e.ad}.png`);
      await sayfa.screenshot({ path: yol });
      console.log(`  çekildi: ${e.ad}`);
    }

    const sahne = await (await tarayici.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 3 })).newPage();
    for (const e of EKRANLAR) {
      const ham = readFileSync(join(GORSEL, "ham", `${e.ad}.png`)).toString("base64");
      await sahne.setContent(SAHNE(e.baslik, e.alt, ham), { waitUntil: "networkidle" });
      await sahne.evaluate(() => document.fonts.ready);
      // JPEG: saydamlık kanalı olmasın (App Store saydam görseli reddedebiliyor).
      const yol = join(GORSEL, `${e.ad}.jpg`);
      await sahne.screenshot({ path: yol, type: "jpeg", quality: 92 });
      gorseller.push(yol);
    }
  } finally {
    await tarayici.close();
  }
  return `${gorseller.length} görsel (1320×2868)`;
});

await adim("Ekran görüntüleri: yükleme (6.9 inç iPhone)", async () => {
  if (!gorseller.length) throw new Error("yüklenecek görsel yok");
  const yerel = await surumYereli("tr");
  const setler = await istek(`/appStoreVersionLocalizations/${yerel.id}/appScreenshotSets?limit=50`);
  const TUR = "APP_IPHONE_67";
  let set = setler.data.find((s) => s.attributes.screenshotDisplayType === TUR);
  if (!set) {
    set = (
      await istek(`/appScreenshotSets`, {
        method: "POST",
        body: {
          data: {
            type: "appScreenshotSets",
            attributes: { screenshotDisplayType: TUR },
            relationships: {
              appStoreVersionLocalization: { data: { type: "appStoreVersionLocalizations", id: yerel.id } },
            },
          },
        },
      })
    ).data;
  }
  // Eskileri sil: her çalıştırma son görselleri koyar.
  const eskiler = await istek(`/appScreenshotSets/${set.id}/appScreenshots?limit=50`);
  for (const eski of eskiler.data) await istek(`/appScreenshots/${eski.id}`, { method: "DELETE" });

  for (const yol of gorseller) {
    const veri = readFileSync(yol);
    const kayit = (
      await istek(`/appScreenshots`, {
        method: "POST",
        body: {
          data: {
            type: "appScreenshots",
            attributes: { fileName: yol.split("/").pop(), fileSize: statSync(yol).size },
            relationships: { appScreenshotSet: { data: { type: "appScreenshotSets", id: set.id } } },
          },
        },
      })
    ).data;
    const md5 = await parcaliYukle(kayit.attributes.uploadOperations, veri);
    await istek(`/appScreenshots/${kayit.id}`, {
      method: "PATCH",
      body: { data: { type: "appScreenshots", id: kayit.id, attributes: { uploaded: true, sourceFileChecksum: md5 } } },
    });
  }
  // Apple görselleri işlerken birkaç saniye bekle, sonra durumlarını kontrol et.
  await bekle(8000);
  const son = await istek(`/appScreenshotSets/${set.id}/appScreenshots?limit=50`);
  const hatali = son.data.filter((s) => s.attributes.assetDeliveryState?.state === "FAILED");
  if (hatali.length) {
    throw new Error(
      `${hatali.length} görsel reddedildi: ${hatali.map((s) => s.attributes.assetDeliveryState?.errors?.map((e) => e.description).join(", ")).join(" / ")}`,
    );
  }
  return `${son.data.length} görsel yüklendi (Türkçe; İngilizce sayfa da bunları kullanır)`;
});

/* ───────────────────────────── 7. derleme ───────────────────────────── */

await adim("Derlemeyi sürüme bağla", async () => {
  if (!surum) throw new Error("düzenlenebilir sürüm yok");
  const sinir = Date.now() + 25 * 60 * 1000;
  let derleme = null;
  while (Date.now() < sinir) {
    const liste = await istek(
      `/builds?filter[app]=${APP}&filter[preReleaseVersion.version]=${encodeURIComponent(SURUM)}&sort=-uploadedDate&limit=5`,
    );
    derleme = liste.data[0] ?? null;
    if (derleme?.attributes.processingState === "VALID") break;
    if (derleme && ["FAILED", "INVALID"].includes(derleme.attributes.processingState)) {
      throw new Error(`derleme ${derleme.attributes.version} Apple tarafından reddedildi (${derleme.attributes.processingState})`);
    }
    console.log(`  derleme bekleniyor: ${derleme ? derleme.attributes.processingState : "henüz görünmüyor"}`);
    await bekle(60_000);
  }
  if (derleme?.attributes.processingState !== "VALID") throw new Error("derleme 25 dakikada işlenmedi; iş akışını sonra yeniden çalıştırın");
  await istek(`/appStoreVersions/${surum.id}/relationships/build`, {
    method: "PATCH",
    body: { data: { type: "builds", id: derleme.id } },
  });
  return `derleme ${derleme.attributes.version}`;
});

/* ───────────────────── elle yapılması gerekenler ───────────────────── */

elle.push(
  "App Gizliliği (Apple bunu API ile kabul etmiyor): App Store Connect → Fibonex → App Gizliliği → Başla. Cevaplar mobil/MAGAZA.md'de: e-posta adresi, ad, kullanıcı kimliği, diğer kullanıcı içeriği toplanıyor; hepsi \"Uygulama işlevselliği\", kimliğe bağlı, izleme yok. Sonra Yayınla.",
  "İçerik hakları: App Store Connect → Uygulama Bilgileri → İçerik Hakları. Uygulama üçüncü taraf piyasa verisi gösteriyor; bu soruyu veri sağlayıcınızla olan izninize göre siz yanıtlayın.",
);

/* ───────────────────────────── 8. gönderim ───────────────────────────── */

if (GONDER) {
  await adim("İncelemeye gönder", async () => {
    const gonderim = (
      await istek(`/reviewSubmissions`, {
        method: "POST",
        body: {
          data: {
            type: "reviewSubmissions",
            attributes: { platform: "IOS" },
            relationships: { app: { data: { type: "apps", id: APP } } },
          },
        },
      })
    ).data;
    await istek(`/reviewSubmissionItems`, {
      method: "POST",
      body: {
        data: {
          type: "reviewSubmissionItems",
          relationships: {
            reviewSubmission: { data: { type: "reviewSubmissions", id: gonderim.id } },
            appStoreVersion: { data: { type: "appStoreVersions", id: surum.id } },
          },
        },
      },
    });
    await istek(`/reviewSubmissions/${gonderim.id}`, {
      method: "PATCH",
      body: { data: { type: "reviewSubmissions", id: gonderim.id, attributes: { submitted: true } } },
    });
    elle.length = 0;
    return "gönderildi; Apple genelde 24–48 saatte yanıt verir";
  });
}

ozetYaz();
process.exit(sonuclar.some(([, ok]) => !ok) ? 1 : 0);

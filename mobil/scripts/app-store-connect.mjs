#!/usr/bin/env node
/**
 * App Store Connect hazırlığı (GitHub Actions'ta, derlemeden önce çalışır).
 *
 * 1. Paket kimliği (com.fibonex360.app) Apple Developer hesabında yoksa kaydeder.
 * 2. App Store Connect'te bu kimlikle bir uygulama kaydı var mı bakar. Yoksa
 *    derlemeyi boşuna yapmamak için durur ve ne yapılacağını yazar: uygulama
 *    kaydı API ile açılamıyor, App Store Connect'te elle oluşturulmalı.
 *
 * Gerekli ortam değişkenleri: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8 (anahtar
 * dosyasının içeriği), PAKET_KIMLIGI.
 */

import { createPrivateKey, sign } from "node:crypto";
import { appendFileSync } from "node:fs";

const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8, PAKET_KIMLIGI, GITHUB_STEP_SUMMARY, GITHUB_OUTPUT } =
  process.env;
const API = "https://api.appstoreconnect.apple.com/v1";

function ozet(metin) {
  console.log(metin);
  if (GITHUB_STEP_SUMMARY) appendFileSync(GITHUB_STEP_SUMMARY, `${metin}\n`);
}

function dur(metin) {
  ozet(`\n### Durdu\n\n${metin}`);
  process.exit(1);
}

const eksik = ["ASC_KEY_ID", "ASC_ISSUER_ID", "ASC_KEY_P8", "PAKET_KIMLIGI"].filter(
  (ad) => !process.env[ad]?.trim(),
);
if (eksik.length) {
  dur(
    `GitHub Secrets'ta şu değerler eksik: **${eksik.join(", ")}**. ` +
      "Depo → Settings → Secrets and variables → Actions sayfasından ekleyin.",
  );
}

/** App Store Connect API için 20 dakikalık ES256 JWT. */
function jeton() {
  const b64 = (x) => Buffer.from(typeof x === "string" ? x : JSON.stringify(x)).toString("base64url");
  const simdi = Math.floor(Date.now() / 1000);
  const govde = `${b64({ alg: "ES256", kid: ASC_KEY_ID.trim(), typ: "JWT" })}.${b64({
    iss: ASC_ISSUER_ID.trim(),
    iat: simdi,
    exp: simdi + 19 * 60,
    aud: "appstoreconnect-v1",
  })}`;
  let anahtar;
  try {
    // Telefondan kopyalanan anahtarda satır sonları boşluğa dönüşebiliyor;
    // gövdeyi yeniden 64'lük satırlara bölerek düzelt.
    const ham = ASC_KEY_P8.replace(/\\n/g, "\n");
    const govdeB64 = ham
      .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "")
      .replace(/\s+/g, "");
    const pem = `-----BEGIN PRIVATE KEY-----\n${govdeB64.match(/.{1,64}/g).join("\n")}\n-----END PRIVATE KEY-----\n`;
    anahtar = createPrivateKey(pem);
  } catch {
    dur(
      "**ASC_KEY_P8** okunamadı. `.p8` dosyasının tamamını (BEGIN ve END satırları dahil) " +
        "kopyalayıp yapıştırdığınızdan emin olun.",
    );
  }
  const imza = sign("sha256", Buffer.from(govde), { key: anahtar, dsaEncoding: "ieee-p1363" });
  return `${govde}.${imza.toString("base64url")}`;
}

const JETON = jeton();

async function istek(yol, secenek = {}) {
  const yanit = await fetch(`${API}${yol}`, {
    ...secenek,
    headers: {
      Authorization: `Bearer ${JETON}`,
      "Content-Type": "application/json",
      ...(secenek.headers ?? {}),
    },
  });
  const metin = await yanit.text();
  const veri = metin ? JSON.parse(metin) : {};
  if (yanit.status === 401) {
    dur(
      "Apple anahtarı reddetti (401). **ASC_KEY_ID**, **ASC_ISSUER_ID** ve **ASC_KEY_P8** " +
        "değerlerinin aynı anahtara ait olduğunu kontrol edin.",
    );
  }
  if (yanit.status === 403) {
    dur(
      "Anahtarın yetkisi yetmiyor (403). App Store Connect → Kullanıcılar ve Erişim → " +
        "Entegrasyonlar'da anahtarı **Admin** rolüyle yeniden oluşturun.",
    );
  }
  if (!yanit.ok) {
    const hata = veri.errors?.map((e) => e.detail ?? e.title).join(" / ") ?? metin;
    throw new Error(`${yanit.status} ${yol}: ${hata}`);
  }
  return veri;
}

const kimlik = PAKET_KIMLIGI.trim();

// 1. Paket kimliği
const kimlikler = await istek(`/bundleIds?filter[identifier]=${encodeURIComponent(kimlik)}&limit=200`);
const kayitli = kimlikler.data.find((k) => k.attributes.identifier === kimlik);
if (kayitli) {
  ozet(`- Paket kimliği kayıtlı: \`${kimlik}\``);
} else {
  await istek("/bundleIds", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "bundleIds",
        attributes: { identifier: kimlik, name: "Fibonex360", platform: "IOS" },
      },
    }),
  });
  ozet(`- Paket kimliği kaydedildi: \`${kimlik}\``);
}

// 2. Uygulama kaydı
const uygulamalar = await istek(`/apps?filter[bundleId]=${encodeURIComponent(kimlik)}&limit=10`);
const uygulama = uygulamalar.data.find((u) => u.attributes.bundleId === kimlik);
if (!uygulama) {
  dur(
    "App Store Connect'te bu paket kimliğiyle bir uygulama yok. Bir kez elle oluşturun, " +
      "sonra bu iş akışını yeniden çalıştırın:\n\n" +
      "1. appstoreconnect.apple.com → **Uygulamalar** → **+** → **Yeni Uygulama**\n" +
      "2. Platform: **iOS** · Ad: **Fibonex360** · Birincil dil: **Türkçe**\n" +
      `3. Paket kimliği: **${kimlik}** · SKU: **fibonex360-ios-1** · Erişim: **Tam erişim**\n` +
      "4. **Oluştur**",
  );
}
ozet(`- App Store Connect uygulaması: **${uygulama.attributes.name}** (${uygulama.id})`);
if (GITHUB_OUTPUT) appendFileSync(GITHUB_OUTPUT, `uygulama_id=${uygulama.id}\n`);

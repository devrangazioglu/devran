/**
 * App Store Connect API istemcisi (yalnızca Node'un kendi modülleri).
 *
 * Kimlik: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8 (anahtar dosyasının içeriği).
 * Depo herkese açık olduğu için hiçbir yanıt gövdesi ya da gizli değer
 * günlüğe yazılmaz; hatalarda yalnızca Apple'ın hata başlığı gösterilir.
 */

import { createHash, createPrivateKey, sign } from "node:crypto";

const API = "https://api.appstoreconnect.apple.com";

export class AscHatasi extends Error {
  constructor(durum, yol, ayrinti) {
    super(`${durum} ${yol}: ${ayrinti}`);
    this.durum = durum;
    this.ayrinti = ayrinti;
  }
}

function anahtarOku(ham) {
  const govde = ham
    .replace(/\\n/g, "\n")
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const pem = `-----BEGIN PRIVATE KEY-----\n${govde.match(/.{1,64}/g).join("\n")}\n-----END PRIVATE KEY-----\n`;
  return createPrivateKey(pem);
}

export function istemci({ keyId, issuerId, p8 }) {
  const anahtar = anahtarOku(p8);
  let jeton = null;
  let jetonBitis = 0;

  function yeniJeton() {
    const b64 = (x) => Buffer.from(JSON.stringify(x)).toString("base64url");
    const simdi = Math.floor(Date.now() / 1000);
    const govde = `${b64({ alg: "ES256", kid: keyId, typ: "JWT" })}.${b64({
      iss: issuerId,
      iat: simdi,
      exp: simdi + 19 * 60,
      aud: "appstoreconnect-v1",
    })}`;
    const imza = sign("sha256", Buffer.from(govde), { key: anahtar, dsaEncoding: "ieee-p1363" });
    jetonBitis = Date.now() + 15 * 60 * 1000;
    return `${govde}.${imza.toString("base64url")}`;
  }

  async function istek(yol, { method = "GET", body } = {}) {
    if (!jeton || Date.now() > jetonBitis) jeton = yeniJeton();
    const tam = yol.startsWith("http") ? yol : `${API}${yol.startsWith("/v") ? "" : "/v1"}${yol}`;
    for (let deneme = 0; deneme < 4; deneme++) {
      const yanit = await fetch(tam, {
        method,
        headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (yanit.status === 429 || yanit.status >= 500) {
        await new Promise((r) => setTimeout(r, 2000 * (deneme + 1)));
        continue;
      }
      const metin = await yanit.text();
      const veri = metin ? JSON.parse(metin) : {};
      if (!yanit.ok) {
        const ayrinti =
          veri.errors?.map((e) => [e.title, e.detail].filter(Boolean).join(" — ")).join(" / ") ||
          yanit.statusText;
        throw new AscHatasi(yanit.status, `${method} ${yol.split("?")[0]}`, ayrinti);
      }
      return veri;
    }
    throw new AscHatasi(503, `${method} ${yol.split("?")[0]}`, "Apple sunucusu yanıt vermedi");
  }

  /** Bir dosyayı Apple'ın verdiği yükleme talimatlarıyla parça parça gönderir. */
  async function parcaliYukle(islemler, veri) {
    for (const islem of islemler) {
      const parca = veri.subarray(islem.offset, islem.offset + islem.length);
      const basliklar = Object.fromEntries((islem.requestHeaders ?? []).map((h) => [h.name, h.value]));
      const yanit = await fetch(islem.url, { method: islem.method, headers: basliklar, body: parca });
      if (!yanit.ok) throw new AscHatasi(yanit.status, "yükleme", "dosya parçası gönderilemedi");
    }
    return createHash("md5").update(veri).digest("hex");
  }

  return { istek, parcaliYukle };
}

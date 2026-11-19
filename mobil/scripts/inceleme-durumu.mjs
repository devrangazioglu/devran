/**
 * App Store inceleme durumunu gösterir: sürümlerin durumu, gönderim tarihi
 * ve (varsa) Apple'ın inceleme mesajları. Yalnızca okur, hiçbir şeyi değiştirmez.
 *
 *   ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8, PAKET_KIMLIGI
 */

import { appendFileSync } from "node:fs";

import { istemci } from "./asc-istemci.mjs";

const ENV = process.env;
const { istek } = istemci({
  keyId: ENV.ASC_KEY_ID.trim(),
  issuerId: ENV.ASC_ISSUER_ID.trim(),
  p8: ENV.ASC_KEY_P8,
});

const ANLAM = {
  PREPARE_FOR_SUBMISSION: "hazırlanıyor (gönderilmedi)",
  READY_FOR_REVIEW: "gönderilmeye hazır",
  WAITING_FOR_REVIEW: "inceleme sırasında bekliyor",
  IN_REVIEW: "şu an inceleniyor",
  PENDING_DEVELOPER_RELEASE: "onaylandı, yayınlanmayı bekliyor",
  PROCESSING_FOR_DISTRIBUTION: "onaylandı, yayına hazırlanıyor",
  PENDING_APPLE_RELEASE: "onaylandı, Apple yayınlayacak",
  READY_FOR_DISTRIBUTION: "yayında",
  READY_FOR_SALE: "yayında",
  REJECTED: "REDDEDİLDİ",
  METADATA_REJECTED: "mağaza bilgileri REDDEDİLDİ",
  DEVELOPER_REJECTED: "geliştirici geri çekti",
  INVALID_BINARY: "derleme geçersiz",
  UNRESOLVED_ISSUES: "çözülmemiş sorun var (Apple mesaj gönderdi)",
  WAITING_FOR_EXPORT_COMPLIANCE: "şifreleme beyanı bekleniyor",
};
const anlam = (d) => (d ? `${d} — ${ANLAM[d] ?? "?"}` : "-");
const tarih = (s) => (s ? new Date(s).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "-");

const satirlar = ["## App Store inceleme durumu", ""];

const uygulamalar = await istek(`/apps?filter[bundleId]=${encodeURIComponent(ENV.PAKET_KIMLIGI)}`);
const uygulama = uygulamalar.data[0];
if (!uygulama) throw new Error("Uygulama kaydı bulunamadı.");

const surumler = await istek(`/apps/${uygulama.id}/appStoreVersions?limit=5`);
satirlar.push("| Sürüm | Durum | Oluşturulma |", "|---|---|---|");
for (const s of surumler.data) {
  const a = s.attributes;
  satirlar.push(`| ${a.versionString} | ${anlam(a.appVersionState ?? a.appStoreState)} | ${tarih(a.createdDate)} |`);
}

const gonderimler = await istek(`/reviewSubmissions?filter[app]=${uygulama.id}&limit=5`);
satirlar.push("", "| Gönderim | Durum | Gönderildi |", "|---|---|---|");
for (const g of gonderimler.data) {
  const a = g.attributes;
  satirlar.push(`| ${g.id.slice(0, 8)} | ${a.state} | ${tarih(a.submittedDate)} |`);
  if (a.submittedDate) {
    const saat = (Date.now() - new Date(a.submittedDate).getTime()) / 3_600_000;
    satirlar.push(`|  | gönderileli ${saat.toFixed(1)} saat |  |`);
  }
}

const metin = satirlar.join("\n");
console.log(metin);
if (ENV.GITHUB_STEP_SUMMARY) appendFileSync(ENV.GITHUB_STEP_SUMMARY, metin + "\n");

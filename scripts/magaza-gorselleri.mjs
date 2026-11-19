/**
 * App Store / Google Play ekran görüntüleri.
 *
 * Yayındaki siteyi 6.9" iPhone boyutunda (1320×2868) açar ve mağazanın
 * istediği ölçüde ekran görüntüsü alır. Üye sayfaları için bir deneme
 * hesabı gerekir (App Store incelemesi de aynı hesabı ister):
 *   MAGAZA_EPOSTA, MAGAZA_PAROLA  — GitHub → Settings → Secrets
 *
 * Çalıştırma: SITE=https://... node scripts/magaza-gorselleri.mjs cikti/
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const SITE = process.env.SITE ?? "https://analiz-brown.vercel.app";
const CIKTI = process.argv[2] ?? "magaza-gorselleri";
const EPOSTA = process.env.MAGAZA_EPOSTA;
const PAROLA = process.env.MAGAZA_PAROLA;

// iPhone 6.9" (16 Pro Max): 440×956 nokta, 3x → 1320×2868 piksel.
const IPHONE = {
  viewport: { width: 440, height: 956 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Fibonex360App",
};

const herkeseAcik = [
  ["01-ana-sayfa", "/"],
  ["02-abd-borsasi", "/piyasa/abd-borsasi"],
  ["03-kripto", "/piyasa/kripto"],
  ["04-planlar", "/planlar"],
];
const uyeSayfalari = [
  ["05-panel", "/panel"],
  ["06-analiz-aapl", "/varlik/abd/AAPL?interval=1d"],
  ["07-analiz-btc", "/varlik/kripto/BTCUSDT?interval=4h"],
  ["08-tarayici", "/tarayici"],
  ["09-dogruluk", "/dogruluk"],
];

async function cek(sayfa, ad, yol) {
  await sayfa.goto(SITE + yol, { waitUntil: "networkidle", timeout: 60_000 }).catch(() => {});
  // Animasyonlar ve canlı veri yerleşsin; görünür alandaki kartlar açılsın.
  await sayfa.waitForTimeout(4000);
  await sayfa.evaluate(() => window.scrollTo(0, 0));
  await sayfa.waitForTimeout(600);
  await sayfa.screenshot({ path: `${CIKTI}/${ad}.png` });
  console.log("✓", ad, yol);
}

await mkdir(CIKTI, { recursive: true });
const tarayici = await chromium.launch();
const baglam = await tarayici.newContext({ ...IPHONE, locale: "tr-TR" });
const sayfa = await baglam.newPage();

for (const [ad, yol] of herkeseAcik) await cek(sayfa, ad, yol);

if (EPOSTA && PAROLA) {
  await sayfa.goto(`${SITE}/giris`, { waitUntil: "networkidle" });
  await sayfa.fill('input[type="email"]', EPOSTA);
  await sayfa.fill('input[type="password"]', PAROLA);
  await sayfa.click('button[type="submit"]');
  await sayfa.waitForURL(/\/panel/, { timeout: 30_000 }).catch(() => {});
  for (const [ad, yol] of uyeSayfalari) await cek(sayfa, ad, yol);
} else {
  console.log("Üye sayfaları atlandı: MAGAZA_EPOSTA / MAGAZA_PAROLA tanımlı değil.");
}

await tarayici.close();

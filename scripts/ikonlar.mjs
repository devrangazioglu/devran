/**
 * Bütün ikon ve açılış görsellerini tek çizimden üretir.
 *
 * Çizim components/Logo.tsx ve app/icon.svg ile aynıdır: koyu zemin üzerinde
 * yükselen (yeşil) ve düşen (kırmızı) iki mum. Logo değişirse üçünü birlikte
 * güncelleyip bu betiği çalıştırın, ardından mobilde `npm run ikonlar`.
 *
 *   node scripts/ikonlar.mjs
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";

const { chromium } = createRequire(import.meta.url)("playwright");

const YESIL = "#74C98A";
const KIRMIZI = "#C62742";

/** Mumlar 64×64 tuvalin ortasında; ölçek, kenarlara kalan boşluğu belirler. */
function mumlar(olcek) {
  return `<g transform="translate(32 32) scale(${olcek}) translate(-32 -32.5)">
    <g fill="${YESIL}"><rect x="22.5" y="16" width="2.4" height="40" rx="0.6"/><rect x="17.4" y="22" width="12.6" height="28" rx="0.8"/></g>
    <g fill="${KIRMIZI}"><rect x="39.1" y="9" width="2.4" height="40" rx="0.6"/><rect x="34" y="15" width="12.6" height="28" rx="0.8"/></g>
  </g>`;
}

function ikon({ olcek = 0.9, koseli = true } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%">
    <defs><radialGradient id="z" cx="38%" cy="32%" r="80%"><stop offset="0" stop-color="#141e2c"/><stop offset="1" stop-color="#0a0f18"/></radialGradient></defs>
    <rect width="64" height="64" rx="${koseli ? 0 : 14}" fill="url(#z)"/>
    ${mumlar(olcek)}
  </svg>`;
}

const GOREVLER = [
  // Tam dolu kare: iOS ve tarayıcı köşeleri kendisi yuvarlar.
  ...[
    ["public/ikon/ikon-1024.png", 1024],
    ["public/ikon/ikon-512.png", 512],
    ["public/ikon/ikon-192.png", 192],
    ["public/ikon/apple-icon.png", 180],
    ["app/apple-icon.png", 180],
    ["mobil/assets/icon.png", 1024],
    ["mobil/assets/icon-only.png", 1024],
  ].map(([yol, boyut]) => ({ yol, boyut, html: ikon() })),
  // Maskelenebilir (Android/PWA): içerik ortadaki güvenli dairede kalsın.
  { yol: "public/ikon/maskable-512.png", boyut: 512, html: ikon({ olcek: 0.7 }) },
  { yol: "public/ikon/maskable-192.png", boyut: 192, html: ikon({ olcek: 0.7 }) },
  { yol: "mobil/assets/icon-foreground.png", boyut: 512, html: ikon({ olcek: 0.62 }) },
  // Açılış ekranı: koyu zeminde ortada yuvarlak köşeli ikon kartı.
  ...["public/ikon/acilis-2732.png", "mobil/assets/splash.png", "mobil/assets/splash-dark.png"].map((yol) => ({
    yol,
    boyut: 2732,
    html: `<div style="width:100%;height:100%;background:#05070c;display:grid;place-items:center">
      <div style="width:520px;height:520px">${ikon({ koseli: false })}</div></div>`,
  })),
];

const tarayici = await chromium.launch();
for (const { yol, boyut, html } of GOREVLER) {
  const sayfa = await tarayici.newPage({ viewport: { width: boyut, height: boyut } });
  await sayfa.setContent(`<!doctype html><html><body style="margin:0;width:${boyut}px;height:${boyut}px;overflow:hidden">${html}</body></html>`);
  writeFileSync(yol, await sayfa.screenshot({ omitBackground: false }));
  await sayfa.close();
  console.log("✓", yol, `${boyut}px`);
}
await tarayici.close();

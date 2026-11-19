/*
 * Fibonex360 servis çalışanı.
 *
 * Bilerek küçük: fiyatlar ve sinyaller her an değiştiği için sayfaları
 * önbellekten göstermek kullanıcıya eski veri göstermek olurdu. Tek iş,
 * bağlantı yokken tarayıcının boş hata ekranı yerine anlaşılır bir
 * "çevrimdışısınız" sayfası göstermek. Statik ikonlar da saklanır.
 */
const SURUM = "fibonex360-v1";
const SAKLANAN = ["/cevrimdisi.html", "/ikon/ikon-192.png", "/icon.svg"];

self.addEventListener("install", (olay) => {
  olay.waitUntil(caches.open(SURUM).then((c) => c.addAll(SAKLANAN)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (olay) => {
  olay.waitUntil(
    caches
      .keys()
      .then((adlar) => Promise.all(adlar.filter((a) => a !== SURUM).map((a) => caches.delete(a))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (olay) => {
  const istek = olay.request;
  if (istek.method !== "GET") return;
  // Yalnızca sayfa gezintileri: API ve veri istekleri her zaman ağdan.
  if (istek.mode === "navigate") {
    olay.respondWith(fetch(istek).catch(() => caches.match("/cevrimdisi.html")));
    return;
  }
  const url = new URL(istek.url);
  if (url.origin === self.location.origin && SAKLANAN.includes(url.pathname)) {
    olay.respondWith(caches.match(istek).then((k) => k || fetch(istek)));
  }
});

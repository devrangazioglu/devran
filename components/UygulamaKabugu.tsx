"use client";

import { useEffect } from "react";

/**
 * Tarayıcı ve mobil uygulama kabuğu için küçük başlangıç işleri.
 *
 *   • Servis çalışanını kaydeder (bağlantı yokken çevrimdışı ekranı).
 *   • Mobil uygulamanın içinde açıldıysa `<html>`'e `uygulama` ve platform
 *     sınıfı ekler; CSS bu sınıfla çentik/ana çubuk boşluklarını ayarlar.
 *     Uygulama kabuğu, kullanıcı aracına "Fibonex360App" ekler
 *     (bkz. mobil/capacitor.config.ts).
 */
export default function UygulamaKabugu() {
  useEffect(() => {
    const kok = document.documentElement;
    const ua = navigator.userAgent;
    // Capacitor köprüsü, uzak adresten açılan sayfaya da enjekte edilir.
    const cap = (window as unknown as {
      Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
    }).Capacitor;
    const yerel = cap?.isNativePlatform?.() === true || ua.includes("Fibonex360App");
    if (yerel) {
      const platform = cap?.getPlatform?.() ?? (/iPhone|iPad|iPod/.test(ua) ? "ios" : "android");
      kok.classList.add("uygulama", platform === "ios" ? "platform-ios" : "platform-android");
    }

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Kayıt başarısızsa site yine çalışır; yalnızca çevrimdışı ekranı olmaz.
      });
    }
  }, []);
  return null;
}

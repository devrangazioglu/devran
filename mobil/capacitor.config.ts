import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Fibonex360 mobil uygulama ayarları.
 *
 * Uygulama, yayındaki siteyi yerel bir kabukta açar (server.url). Böylece
 * site her güncellendiğinde uygulama da güncellenir; mağaza incelemesi
 * yalnızca kabuk değiştiğinde gerekir.
 *
 * Alan adı alındığında FIBONEX_URL'yi (ya da aşağıdaki varsayılanı) yeni
 * adresle değiştirin ve `npm run esitle` çalıştırın.
 */
const SITE = process.env.FIBONEX_URL ?? "https://analiz-brown.vercel.app";

const config: CapacitorConfig = {
  appId: "com.fibonex360.app",
  appName: "Fibonex360",
  // Yerel klasör yalnızca bağlantı hatası ekranını taşır.
  webDir: "www",
  server: {
    url: `${SITE}/panel`,
    // Kabuk yalnızca kendi sitesinde gezinir; diğer bağlantılar sistem
    // tarayıcısında açılır. Google ve Apple ile giriş sayfaları kabukta
    // açılmalı ki oturum çerezi uygulamaya dönsün.
    allowNavigation: [new URL(SITE).host, "accounts.google.com", "appleid.apple.com"],
    // Sunucuya ulaşılamazsa (internet yok) gösterilecek yerel sayfa.
    errorPath: "hata.html",
    cleartext: false,
  },
  // Site, uygulamanın içinde açıldığını bu ekten anlar (UygulamaKabugu).
  appendUserAgent: "Fibonex360App",
  backgroundColor: "#05070c",
  ios: {
    contentInset: "never",
    scheme: "Fibonex360",
  },
  android: {
    allowMixedContent: false,
    // Android'in geri tuşu, kabukta sayfa geçmişinde geri gider.
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#05070c",
      showSpinner: false,
      androidScaleType: "CENTER_INSIDE",
      splashFullScreen: false,
      splashImmersive: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#05070c",
      overlaysWebView: false,
    },
  },
};

export default config;

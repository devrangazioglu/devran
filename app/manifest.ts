import type { MetadataRoute } from "next";

import { SITE_NAME } from "@/lib/seo";

/**
 * Web uygulaması bildirimi.
 *
 * Android ana ekrana eklemede ve Play Store'un TWA/WebView kabuğunda PNG
 * ikon ister (SVG yetmez); "maskable" ikon uyarlanabilir simge çerçevesinde
 * kesilmesin diye içeriği güvenli alanın içinde çizilmiştir.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: `${SITE_NAME} — teknik analiz ve al/sat sinyalleri`,
    short_name: SITE_NAME,
    description:
      "Kripto, Amerikan borsası, Borsa İstanbul, dünya borsaları, döviz ve emtia için 20'den fazla teknik göstergeye dayalı AL / SAT / BEKLE sinyalleri.",
    lang: "tr",
    start_url: "/panel",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#05070c",
    theme_color: "#05070c",
    categories: ["finance", "business"],
    icons: [
      { src: "/ikon/ikon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/ikon/ikon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/ikon/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/ikon/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "Sinyal tarayıcı", url: "/tarayici", icons: [{ src: "/ikon/ikon-192.png", sizes: "192x192" }] },
      { name: "Takip listem", url: "/takip", icons: [{ src: "/ikon/ikon-192.png", sizes: "192x192" }] },
    ],
  };
}

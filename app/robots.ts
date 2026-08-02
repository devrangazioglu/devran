/**
 * Tarayıcı botlarına ne taranacağını söyler.
 *
 * Üye alanı ve API uçları dizine girmemeli: içerikleri kişiye özel ya da ham
 * JSON. Bunlar taranırsa hem boşuna tarama bütçesi harcanır hem de arama
 * sonuçlarında giriş ekranına düşen sayfalar çıkar.
 */
import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/panel", "/tarayici", "/takip", "/ayarlar", "/varlik/", "/tani", "/ara"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}

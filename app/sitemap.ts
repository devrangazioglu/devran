/**
 * Site haritası: herkese açık her sayfa, her dilde.
 *
 * Her kayda dil alternatifleri de eklenir; böylece arama motoru sekiz sürümün
 * birbirinin kopyası değil çevirisi olduğunu görür ve kullanıcıya kendi
 * dilindekini gösterir.
 */
import type { MetadataRoute } from "next";

import { LOCALES } from "@/lib/i18n";
import { localeHref } from "@/lib/i18n/routing";
import { MARKETS, MARKET_IDS } from "@/lib/markets/types";
import { dilAlternatifleri, mutlakUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const simdi = new Date();

  // Ana sayfa en önemli, piyasa sayfaları hemen ardından.
  const yollar: { path: string; priority: number; changeFrequency: "daily" | "hourly" }[] = [
    { path: "/", priority: 1, changeFrequency: "daily" },
    ...MARKET_IDS.map((id) => ({
      path: `/piyasa/${MARKETS[id].slug}`,
      priority: 0.9,
      changeFrequency: "hourly" as const,
    })),
  ];

  return yollar.flatMap(({ path, priority, changeFrequency }) =>
    LOCALES.map((meta) => ({
      url: mutlakUrl(localeHref(meta.code, path)),
      lastModified: simdi,
      changeFrequency,
      priority,
      alternates: { languages: dilAlternatifleri(path, meta.code).languages },
    })),
  );
}

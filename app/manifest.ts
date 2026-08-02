import type { MetadataRoute } from "next";

import { SITE_NAME } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — teknik analiz ve al/sat sinyalleri`,
    short_name: SITE_NAME,
    description:
      "Kripto, Amerikan borsası, Borsa İstanbul, döviz ve emtia için 16 teknik göstergeye dayalı AL / SAT / BEKLE sinyalleri.",
    start_url: "/",
    display: "standalone",
    background_color: "#05070c",
    theme_color: "#05070c",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}

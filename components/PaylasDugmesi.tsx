"use client";

import { useState } from "react";

import { useI18n } from "./I18nProvider";

/**
 * Paylaş düğmesi.
 *
 * Telefonda sistemin paylaşım sayfasını (WhatsApp, Telegram, X…) açar;
 * desteklemeyen tarayıcıda metni panoya kopyalar. Bağlantı kullanıcının
 * davet kodunu taşır: paylaşılan her analiz, yeni üyeyi getirirse iki
 * tarafa da ek kredi kazandırır.
 */
export default function PaylasDugmesi({
  metin,
  yol = "/",
  davetKodu,
  className = "btn btn-ghost btn-sm",
  etiket,
}: {
  metin: string;
  yol?: string;
  davetKodu?: string | null;
  className?: string;
  etiket?: string;
}) {
  const { t } = useI18n();
  const [kopyalandi, setKopyalandi] = useState(false);

  async function paylas() {
    const url = new URL(yol, window.location.origin);
    if (davetKodu) url.searchParams.set("davet", davetKodu);
    const adres = url.toString();

    if (navigator.share) {
      try {
        await navigator.share({ title: "Fibonex360", text: metin, url: adres });
        return;
      } catch (error) {
        // Kullanıcı paylaşım sayfasını kapattıysa sessizce çık.
        if ((error as DOMException)?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${metin}\n${adres}`);
      setKopyalandi(true);
      setTimeout(() => setKopyalandi(false), 2200);
    } catch {
      window.prompt(t("share.copyPrompt"), adres);
    }
  }

  return (
    <button className={className} type="button" onClick={paylas}>
      <span aria-hidden>{kopyalandi ? "✓" : "↗"}</span> {kopyalandi ? t("share.copied") : (etiket ?? t("share.button"))}
    </button>
  );
}

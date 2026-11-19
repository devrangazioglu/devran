"use client";

/**
 * Teknik analiz bilmeyenler için: "Kısaca" kartı ve terim açıklaması.
 */

import { useId, useState } from "react";

import { useI18n } from "@/components/I18nProvider";
import type { SadeOzet } from "@/lib/sade-ozet";

export function SadeOzetKarti({ ozet }: { ozet: SadeOzet }) {
  const { t } = useI18n();
  return (
    <div className={`card sade-kart sade-${ozet.ton}`}>
      <div className="card-title">
        <span>{t("plain.title")}</span>
        <span className="dim" style={{ fontSize: 12 }}>
          {t("plain.sub")}
        </span>
      </div>
      <p className="sade-baslik">{ozet.baslik}</p>
      <ul className="sade-liste">
        {ozet.maddeler.map((madde, index) => (
          <li key={index} className={`sade-${madde.ton}`}>
            {madde.metin}
          </li>
        ))}
      </ul>
      <p className="dim" style={{ fontSize: 12, marginTop: 14 }}>
        {ozet.uyari}
      </p>
    </div>
  );
}

/**
 * Bir terimin yanına konan küçük "?" düğmesi; dokununca açıklamayı açar.
 * Fareyle üzerine gelme ipucu (title) telefonda çalışmadığı için düğme.
 */
export function Aciklama({ metin, etiket }: { metin: string; etiket: string }) {
  const [acik, setAcik] = useState(false);
  const id = useId();
  // Çevirisi olmayan anahtar kendisini döndürür; o durumda düğme gösterilmez.
  if (!metin || metin.endsWith(".what")) return null;
  return (
    <>
      <button
        type="button"
        className={`aciklama-dugme${acik ? " acik" : ""}`}
        aria-expanded={acik}
        aria-controls={id}
        aria-label={etiket}
        title={etiket}
        onClick={() => setAcik((a) => !a)}
      >
        ?
      </button>
      {acik && (
        <span id={id} className="aciklama-metin">
          {metin}
        </span>
      )}
    </>
  );
}

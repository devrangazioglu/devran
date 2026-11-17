"use client";

import { useEffect, useState } from "react";

import { useI18n } from "./I18nProvider";
import PaylasDugmesi from "./PaylasDugmesi";
import Ikon from "./Ikon";

/**
 * "Davet et, kredi kazan" kartı.
 *
 * Bağlantıyla kaydolan her yeni üye davet edene ek kredi, kendisine de
 * hoş geldin kredisi kazandırır (tutarlar lib/credits.ts'te).
 */
export default function DavetKarti({
  kod,
  sayi,
  sinir,
  odul,
}: {
  kod: string;
  sayi: number;
  sinir: number;
  odul: number;
}) {
  const { t } = useI18n();
  const [adres, setAdres] = useState(`/?davet=${kod}`);
  useEffect(() => setAdres(`${window.location.origin}/?davet=${kod}`), [kod]);

  return (
    <div className="card davet-karti">
      <div className="card-title ikonlu-baslik">
        <Ikon ad="hediye" boyut={18} /> {t("invite.title")}
      </div>
      <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
        {t("invite.text", { odul })}
      </p>
      <div className="davet-adres mono" aria-label={t("invite.link")}>
        {adres}
      </div>
      <div className="hesap-islemleri" style={{ marginTop: 12 }}>
        <PaylasDugmesi
          metin={t("invite.shareText")}
          davetKodu={kod}
          className="btn btn-primary btn-sm"
          etiket={t("invite.share")}
        />
      </div>
      <p className="dim" style={{ fontSize: 12, marginTop: 12 }}>
        {t("invite.count", { sayi, sinir })}
      </p>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useI18n } from "./I18nProvider";
import Ikon from "./Ikon";

/** 7 gün ücretsiz Premium denemesini başlatan düğme. */
export default function DenemeDugmesi({ className = "btn btn-primary" }: { className?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [bekliyor, setBekliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  async function baslat() {
    setBekliyor(true);
    setHata(null);
    const yanit = await fetch("/api/deneme", { method: "POST" }).catch(() => null);
    if (!yanit?.ok) {
      const govde = (await yanit?.json().catch(() => null)) as { error?: string } | null;
      setHata(govde?.error ?? t("common.error"));
      setBekliyor(false);
      return;
    }
    router.refresh();
  }

  return (
    <>
      <button className={className} type="button" onClick={baslat} disabled={bekliyor}>
        {bekliyor ? <span className="spinner" /> : <Ikon ad="parilti" boyut={15} />} {t("trial.start")}
      </button>
      {hata && <div className="notice notice-error" style={{ marginTop: 10 }}>{hata}</div>}
    </>
  );
}

"use client";

import { useI18n } from "./I18nProvider";
import Secim from "./Secim";
import {
  ANA_MARKET_IDS,
  AKTIF_MARKET_IDS,
  DUNYA_MARKET_IDS,
  dunyaPiyasasi,
  MARKETS,
  type MarketId,
} from "@/lib/markets/types";

/**
 * Piyasa seçici: ana dört piyasa düğme, dünya borsaları açılır liste.
 *
 * On beş düğmelik bir sekme satırı telefonda üç satıra taşıyordu. Ana
 * piyasalar tek dokunuşla kalır; ülkeler bayraklı bir listede toplanır ve
 * seçili ülke listenin kendisinde görünür (ayrı bir "aktif" düğmesi yok).
 */
export default function PiyasaSecici({
  value,
  onChange,
}: {
  value: MarketId;
  onChange: (market: MarketId) => void;
}) {
  const { t } = useI18n();
  const ana = ANA_MARKET_IDS.filter((id) => AKTIF_MARKET_IDS.includes(id));
  const dunya = DUNYA_MARKET_IDS.filter((id) => AKTIF_MARKET_IDS.includes(id));
  const dunyada = dunyaPiyasasi(value);

  return (
    <>
      <div className="segmented">
        {ana.map((id) => (
          <button key={id} className={id === value ? "active" : ""} onClick={() => onChange(id)}>
            {t(`market.${id}` as "market.kripto")}
          </button>
        ))}
      </div>
      {dunya.length > 0 && (
        <span className={`dunya-secim ${dunyada ? "aktif" : ""}`}>
          <Secim<string>
            value={dunyada ? value : ""}
            ariaLabel={t("market.dunya.sec")}
            options={[
              { value: "", label: t("market.dunya.secBos") },
              ...dunya.map((id) => ({
                value: id,
                label: t(`market.${id}` as "market.kripto"),
              })),
            ]}
            onChange={(secilen) => {
              if (secilen) onChange(secilen as MarketId);
            }}
          />
        </span>
      )}
    </>
  );
}

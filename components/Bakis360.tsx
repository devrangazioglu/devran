"use client";

/**
 * 360° Bakış kartı: varlığa sekiz açıdan bakan halka (bkz. `lib/bakis360.ts`).
 *
 * Her dilim bir açı. Dilimin boyu açının ne kadar güçlü olduğunu, rengi yönünü
 * söyler: yeşil alıcı, kırmızı satıcı, gri nötr. Verisi olmayan açı kesik
 * çizgiyle boş bırakılır. Ortada genel skor durur. Sağdaki liste aynı bilgiyi
 * sözle verir; renk ayırt edemeyen biri de okuyabilsin.
 */

import type { Analysis } from "@/lib/analysis";
import { bakis360, NOTR_ESIK, type AciAnahtari } from "@/lib/bakis360";
import type { Fundamentals } from "@/lib/fundamentals";

import { useI18n } from "./I18nProvider";

const BOYUT = 340; // etiketler halkanın dışına taşmasın diye geniş tutuldu
const IC = 40; // ortadaki skor dairesi
const DIS = 104; // en uzun dilim
const BOSLUK = 3.5; // dilimler arası açı (derece)

function nokta(r: number, derece: number): [number, number] {
  const a = ((derece - 90) * Math.PI) / 180;
  return [r * Math.cos(a), r * Math.sin(a)];
}

function dilim(r1: number, r2: number, a1: number, a2: number): string {
  const [x1, y1] = nokta(r2, a1);
  const [x2, y2] = nokta(r2, a2);
  const [x3, y3] = nokta(r1, a2);
  const [x4, y4] = nokta(r1, a1);
  return `M${x1},${y1} A${r2},${r2} 0 0 1 ${x2},${y2} L${x3},${y3} A${r1},${r1} 0 0 0 ${x4},${y4} Z`;
}

function ton(deger: number | null): "up" | "down" | "flat" | "yok" {
  if (deger === null) return "yok";
  if (deger >= NOTR_ESIK) return "up";
  if (deger <= -NOTR_ESIK) return "down";
  return "flat";
}

function sozel(deger: number | null): string {
  if (deger === null) return "b360.none";
  if (deger >= 55) return "b360.strongBuy";
  if (deger >= NOTR_ESIK) return "b360.buy";
  if (deger <= -55) return "b360.strongSell";
  if (deger <= -NOTR_ESIK) return "b360.sell";
  return "b360.neutral";
}

export default function Bakis360Karti({
  analysis,
  timeframes,
  fundamentals,
}: {
  analysis: Analysis;
  timeframes: { score: number }[];
  fundamentals: Fundamentals | null;
}) {
  const { t } = useI18n();
  const b = bakis360(analysis, { timeframes, fundamentals });
  const ad = (k: AciAnahtari) => t(`b360.${k}` as "b360.trend");
  const adim = 360 / b.acilar.length;
  const skor = Math.round(analysis.score);

  return (
    <div className="card b360-kart">
      <div className="card-title">
        <span>
          <span className="b360-derece">360°</span> {t("b360.title")}
        </span>
        {b.uyum !== null && (
          <span className="pill" title={t("b360.uyumHint")}>
            {t("b360.uyum", { oran: Math.round(b.uyum * 100) })}
          </span>
        )}
      </div>

      <div className="b360-govde">
        <svg
          className="b360-halka"
          viewBox={`${-BOYUT / 2} ${-BOYUT / 2} ${BOYUT} ${BOYUT}`}
          role="img"
          aria-label={t("b360.title")}
        >
          {/* Kılavuz halkalar: yarım ve tam güç. */}
          <circle r={(IC + DIS) / 2} className="b360-kilavuz" />
          <circle r={DIS} className="b360-kilavuz" />
          {b.acilar.map((aci, i) => {
            const a1 = i * adim + BOSLUK / 2;
            const a2 = (i + 1) * adim - BOSLUK / 2;
            const uzunluk =
              aci.deger === null ? DIS : IC + 8 + (Math.abs(aci.deger) / 100) * (DIS - IC - 8);
            const orta = (a1 + a2) / 2;
            const [lx, ly] = nokta(DIS + 14, orta);
            // Sağdaki etiket sola, soldaki sağa yaslanır; tepe ve dipte ortalanır.
            const yasla = Math.abs(lx) < 12 ? "middle" : lx > 0 ? "start" : "end";
            const opaklik = aci.deger === null ? 1 : 0.35 + (Math.abs(aci.deger) / 100) * 0.65;
            return (
              <g key={aci.anahtar}>
                <path
                  d={dilim(IC + 4, uzunluk, a1, a2)}
                  className={`b360-dilim b360-${ton(aci.deger)}`}
                  style={{ opacity: opaklik }}
                >
                  <title>
                    {ad(aci.anahtar)}: {t(sozel(aci.deger) as "b360.none")}
                    {aci.deger !== null ? ` (${aci.deger > 0 ? "+" : ""}${Math.round(aci.deger)})` : ""}
                  </title>
                </path>
                <text x={lx} y={ly} className="b360-etiket" textAnchor={yasla} dominantBaseline="middle">
                  {ad(aci.anahtar)}
                </text>
              </g>
            );
          })}
          <circle r={IC} className="b360-merkez" />
          <text y={-4} textAnchor="middle" className={`b360-skor b360-${ton(analysis.score)}`}>
            {skor > 0 ? `+${skor}` : skor}
          </text>
          <text y={15} textAnchor="middle" className="b360-alt">
            {t("b360.score")}
          </text>
        </svg>

        <ul className="b360-liste">
          {b.acilar.map((aci) => (
            <li key={aci.anahtar} className={`b360-satir b360-${ton(aci.deger)}`}>
              <span className="b360-nokta" aria-hidden />
              <span className="b360-ad">{ad(aci.anahtar)}</span>
              <span className="b360-soz">{t(sozel(aci.deger) as "b360.none")}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="b360-ozet">
        {t("b360.summary", { alici: b.alici, satici: b.satici, notr: b.notr })}
        {b.enGuclu && b.enGuclu.deger !== null && b.enGuclu.deger >= NOTR_ESIK
          ? ` ${t("b360.strongest", { ad: ad(b.enGuclu.anahtar) })}`
          : ""}
        {b.enZayif && b.enZayif.deger !== null && b.enZayif.deger <= -NOTR_ESIK
          ? ` ${t("b360.weakest", { ad: ad(b.enZayif.anahtar) })}`
          : ""}
      </p>
      <p className="dim" style={{ fontSize: 12, marginTop: 6 }}>
        {t("b360.note")}
      </p>
    </div>
  );
}

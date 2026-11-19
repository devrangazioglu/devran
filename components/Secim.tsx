"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Sitenin temasına uyan açılır seçim kutusu.
 *
 * Yerel `<select>` neden kullanılmıyor: açılan liste tarayıcı ve işletim
 * sistemine ait bir pencere; koyu temada beyaz zeminli, mavi vurgulu bir kutu
 * çıkıyor ve CSS ile biçimlendirilemiyor. Burada liste bizim öğemiz olduğu
 * için kart zemini, yeşil vurgu ve yuvarlak köşe sitenin geri kalanıyla aynı.
 *
 * Yerel kutunun bedavaya verdiği davranışlar elle korunuyor, yoksa görünüş
 * için kullanılabilirlikten ödün verilmiş olurdu:
 *   • klavye: ↑/↓ gezinir, Enter/Boşluk seçer, Esc kapatır, Home/End uçlara
 *     gider, harfe basınca o harfle başlayan seçeneğe atlar
 *   • ekran okuyucu: `combobox` + `listbox` rolleri, etkin seçenek
 *     `aria-activedescendant` ile duyurulur
 *   • form etiketi: `id` düğmeye verilir, `<label htmlFor>` çalışmaya devam eder
 */

export type SecimSecenegi<T extends string | number> = {
  value: T;
  label: string;
};

export default function Secim<T extends string | number>({
  value,
  options,
  onChange,
  id,
  ariaLabel,
  hizalama = "bas",
  genis = false,
}: {
  value: T;
  options: SecimSecenegi<T>[];
  onChange: (value: T) => void;
  id?: string;
  ariaLabel?: string;
  /** Liste düğmenin başına mı sonuna mı hizalansın (dar ekranda taşmasın diye). */
  hizalama?: "bas" | "son";
  /** Form alanlarında kutu satırı doldursun. */
  genis?: boolean;
}) {
  const [acik, setAcik] = useState(false);
  const [etkin, setEtkin] = useState(0);
  const sarmal = useRef<HTMLDivElement>(null);
  const dugme = useRef<HTMLButtonElement>(null);
  const liste = useRef<HTMLDivElement>(null);
  const yazilan = useRef<{ metin: string; zaman: number }>({ metin: "", zaman: 0 });
  const kimlik = useId();

  const seciliIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const secili = options[seciliIndex];

  // Dışarı tıklanınca kapan.
  useEffect(() => {
    if (!acik) return;
    const disari = (event: MouseEvent | TouchEvent) => {
      if (!sarmal.current?.contains(event.target as Node)) setAcik(false);
    };
    document.addEventListener("mousedown", disari);
    document.addEventListener("touchstart", disari);
    return () => {
      document.removeEventListener("mousedown", disari);
      document.removeEventListener("touchstart", disari);
    };
  }, [acik]);

  // Etkin seçenek görünür kalsın (uzun listelerde klavyeyle gezinirken).
  useEffect(() => {
    if (!acik) return;
    const oge = liste.current?.children[etkin] as HTMLElement | undefined;
    oge?.scrollIntoView({ block: "nearest" });
  }, [acik, etkin]);

  function ac() {
    setEtkin(seciliIndex);
    setAcik(true);
  }

  function sec(index: number) {
    const secenek = options[index];
    if (!secenek) return;
    if (secenek.value !== value) onChange(secenek.value);
    setAcik(false);
    dugme.current?.focus();
  }

  /** Basılan harflerle başlayan ilk seçeneği bulur (yerel kutudaki gibi). */
  function harfleAra(harf: string): number {
    const simdi = Date.now();
    const onceki = simdi - yazilan.current.zaman < 600 ? yazilan.current.metin : "";
    const metin = (onceki + harf).toLocaleLowerCase();
    yazilan.current = { metin, zaman: simdi };
    return options.findIndex((o) => o.label.toLocaleLowerCase().startsWith(metin));
  }

  function tus(event: React.KeyboardEvent) {
    if (!acik) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        ac();
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setEtkin((i) => Math.min(i + 1, options.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setEtkin((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setEtkin(0);
        break;
      case "End":
        event.preventDefault();
        setEtkin(options.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        sec(etkin);
        break;
      case "Escape":
        event.preventDefault();
        setAcik(false);
        break;
      case "Tab":
        // Odak ilerlesin; liste açık kalmasın.
        setAcik(false);
        break;
      default:
        if (event.key.length === 1) {
          const bulunan = harfleAra(event.key);
          if (bulunan >= 0) setEtkin(bulunan);
        }
    }
  }

  return (
    <div className={`secim${genis ? " secim-genis" : ""}`} ref={sarmal}>
      <button
        ref={dugme}
        id={id}
        type="button"
        className={`secim-dugme${acik ? " acik" : ""}`}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={acik}
        aria-controls={`${kimlik}-liste`}
        aria-activedescendant={acik ? `${kimlik}-${etkin}` : undefined}
        aria-label={ariaLabel}
        onClick={() => (acik ? setAcik(false) : ac())}
        onKeyDown={tus}
      >
        <span className="secim-deger">{secili?.label ?? ""}</span>
        <svg className="secim-ok" width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <path
            d="M2.5 4.5 6 8l3.5-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {acik && (
        <div
          ref={liste}
          id={`${kimlik}-liste`}
          className={`secim-liste${hizalama === "son" ? " son" : ""}`}
          role="listbox"
        >
          {options.map((secenek, index) => (
            <div
              key={String(secenek.value)}
              id={`${kimlik}-${index}`}
              role="option"
              aria-selected={index === seciliIndex}
              className={`secim-secenek${index === etkin ? " etkin" : ""}${
                index === seciliIndex ? " secili" : ""
              }`}
              // mousedown: düğmedeki odak kaybolmadan seçim yapılsın.
              onMouseDown={(event) => {
                event.preventDefault();
                sec(index);
              }}
              onMouseEnter={() => setEtkin(index)}
            >
              <span>{secenek.label}</span>
              {index === seciliIndex && (
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                  <path
                    d="M3 7.5 5.8 10 11 4.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

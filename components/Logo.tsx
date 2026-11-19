/**
 * Marka işareti.
 *
 * Aynı çizim site ikonunda (`app/icon.svg`), burada ve uygulama ikonlarını
 * üreten `scripts/ikonlar.mjs`'te kullanılıyor; tek
 * kaynaktan çizilmesi, ileride logo değişince her yerin birlikte değişmesini
 * sağlar. Satır içi SVG tercih edildi: ayrı bir dosya isteği açmaz ve renkleri
 * temayla birlikte değiştirilebilir.
 */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden
      focusable="false"
      style={{ display: "block", flexShrink: 0 }}
    >
      <rect width="64" height="64" rx="14" fill="#0A0F18" />
      <g transform="translate(32 32) scale(0.9) translate(-32 -32.5)">
        <g fill="#74C98A">
          <rect x="22.5" y="16" width="2.4" height="40" rx="0.6" />
          <rect x="17.4" y="22" width="12.6" height="28" rx="0.8" />
        </g>
        <g fill="#C62742">
          <rect x="39.1" y="9" width="2.4" height="40" rx="0.6" />
          <rect x="34" y="15" width="12.6" height="28" rx="0.8" />
        </g>
      </g>
    </svg>
  );
}

/** Yazı kısmı: "Fibo" + yeşil "nex" + küçük "360" rozeti. */
export function LogoAd() {
  return (
    <span>
      Fibo<em>nex</em>
      <span className="logo-360">360</span>
    </span>
  );
}

/** İşaret + yazı. Başlıkta ve altbilgide aynı görünüm kullanılır. */
export function LogoWord() {
  return (
    <>
      <LogoMark />
      <LogoAd />
    </>
  );
}

/**
 * Marka işareti.
 *
 * Aynı çizim hem site ikonunda (`app/icon.svg`) hem burada kullanılıyor; tek
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
      <g fill="#74C98A">
        <rect x="22.5" y="16" width="2.4" height="40" rx="0.6" />
        <rect x="17.4" y="22" width="12.6" height="28" rx="0.8" />
      </g>
      <g fill="#C62742">
        <rect x="39.1" y="9" width="2.4" height="40" rx="0.6" />
        <rect x="34" y="15" width="12.6" height="28" rx="0.8" />
      </g>
    </svg>
  );
}

/** İşaret + yazı. Başlıkta ve altbilgide aynı görünüm kullanılır. */
export function LogoWord() {
  return (
    <>
      <LogoMark />
      <span>
        Fibo<em>nex</em>
      </span>
    </>
  );
}

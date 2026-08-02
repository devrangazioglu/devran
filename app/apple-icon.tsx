/**
 * iOS ana ekran ikonu.
 *
 * Apple SVG kabul etmediği için aynı işaret PNG olarak üretilir; ImageResponse
 * SVG çizemediğinden mumlar kutularla kuruluyor.
 */
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIkonu() {
  const mum = (renk: string, ustFitil: number, altFitil: number) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: 7, height: ustFitil, background: renk }} />
      <div style={{ width: 36, height: 80, background: renk }} />
      <div style={{ width: 7, height: altFitil, background: renk }} />
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          background: "#0A0F18",
        }}
      >
        {mum("#74C98A", 17, 26)}
        {mum("#C62742", 26, 17)}
      </div>
    ),
    size,
  );
}

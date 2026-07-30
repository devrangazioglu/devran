/**
 * Paylaşım görseli.
 *
 * Bağlantı sosyal ağda ya da mesajlaşmada paylaşıldığında görünen kart.
 * Görsel çalışma anında üretilir; depoda ikili dosya tutmaya gerek kalmaz ve
 * metin değişince görsel de kendiliğinden güncellenir.
 */
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Kriptosinyal — teknik analiz ve al/sat sinyalleri";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgGorseli() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #05070c 0%, #0d131e 60%, #10261a 100%)",
          color: "#e9edf5",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34 }}>
          <span style={{ color: "#8ff0a4" }}>◉</span>
          <span style={{ letterSpacing: -0.5 }}>Kriptosinyal</span>
        </div>

        <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1, marginTop: 34 }}>
          Teknik analiz ve
          <br />
          al / sat sinyalleri
        </div>

        <div style={{ fontSize: 30, color: "#8b95a9", marginTop: 30, lineHeight: 1.4 }}>
          Kripto · Amerikan borsası · Borsa İstanbul · Döviz ve emtia
        </div>

        <div style={{ display: "flex", gap: 14, marginTop: 44 }}>
          {["16 gösterge", "8 periyot", "8 dil"].map((etiket) => (
            <div
              key={etiket}
              style={{
                display: "flex",
                fontSize: 26,
                color: "#8ff0a4",
                border: "2px solid rgba(143,240,164,0.35)",
                borderRadius: 999,
                padding: "10px 26px",
              }}
            >
              {etiket}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}

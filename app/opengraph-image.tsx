/**
 * Paylaşım görseli.
 *
 * Bağlantı sosyal ağda ya da mesajlaşmada paylaşıldığında görünen kart.
 * Görsel çalışma anında üretilir; depoda ikili dosya tutmaya gerek kalmaz ve
 * metin değişince görsel de kendiliğinden güncellenir.
 */
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Fibonex360 — piyasalara 360° bakış: teknik analiz ve al/sat sinyalleri";
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
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 36 }}>
          {/* Marka işareti: yükselen ve düşen mum. ImageResponse SVG yerine
              basit kutularla çizildiği için burada dikdörtgenlerle kuruluyor. */}
          <div style={{ display: "flex", alignItems: "center", gap: 7, height: 62 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 3, height: 7, background: "#74C98A" }} />
              <div style={{ width: 17, height: 40, background: "#74C98A" }} />
              <div style={{ width: 3, height: 12, background: "#74C98A" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 3, height: 12, background: "#C62742" }} />
              <div style={{ width: 17, height: 40, background: "#C62742" }} />
              <div style={{ width: 3, height: 7, background: "#C62742" }} />
            </div>
          </div>
          <span style={{ letterSpacing: -0.5 }}>Fibonex</span>
          <span style={{ fontSize: 26, fontWeight: 700, color: "#8ff0a4", marginLeft: -12, marginTop: -14 }}>
            360
          </span>
        </div>

        {/* Görselleştirici, birden çok çocuğu olan her kutuda açık bir düzen
            (display) ister; satır kırmak için <br /> yerine ayrı kutular
            kullanılıyor. Aksi hâlde görsel hiç üretilmiyor. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 68,
            fontWeight: 700,
            lineHeight: 1.1,
            marginTop: 34,
          }}
        >
          <div>Piyasalara 360° bakış:</div>
          <div>al / sat sinyalleri</div>
        </div>

        <div style={{ fontSize: 30, color: "#8b95a9", marginTop: 30, lineHeight: 1.4 }}>
          Kripto · ABD · Borsa İstanbul · 11 dünya borsası · Döviz ve emtia
        </div>

        <div style={{ display: "flex", gap: 14, marginTop: 44 }}>
          {["20+ gösterge", "15 piyasa", "360° bakış"].map((etiket) => (
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

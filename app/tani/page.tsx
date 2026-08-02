/**
 * Veri kaynağı tanı sayfası.
 *
 * `/api/tani` aynı bilgiyi JSON olarak veriyor, ama sorunu bildiren kişiden
 * JSON yapıştırmasını beklemek işe yaramadı; ekran görüntüsü almak çok daha
 * kolay. Bu sayfa aynı denemeleri okunabilir bir tabloya döker.
 */

import { headers } from "next/headers";

export const dynamic = "force-dynamic";
/**
 * Bu sayfa arama motoru için değersiz: içeriği kişiye özel ya da ham teşhis
 * verisi. `follow` açık bırakılır, böylece içindeki bağlantılar taranmaya
 * devam eder ama sayfanın kendisi sonuçlarda çıkmaz.
 */
export const metadata = {
  title: "Veri kaynağı tanısı",
  robots: { index: false, follow: true },
};

type Sonuc = {
  ad: string;
  url: string;
  durum: number | string;
  ms: number;
  boyut: number;
  bas: string;
};

export default async function TaniPage() {
  const host = (await headers()).get("host") ?? "localhost:3000";
  const protokol = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";

  let veri: { commit?: string; bolge?: string; sonuclar?: Sonuc[] } = {};
  let hata: string | null = null;

  try {
    const response = await fetch(`${protokol}://${host}/api/tani?gercek=1`, { cache: "no-store" });
    veri = (await response.json()) as typeof veri;
  } catch (error) {
    hata = error instanceof Error ? error.message : "bilinmeyen hata";
  }

  const sonuclar = veri.sonuclar ?? [];
  const calisan = sonuclar.filter((s) => s.durum === 200);

  return (
    <main className="app-main">
      <div className="container container-wide">
        <div className="page-head">
          <div>
            <h1>Veri kaynağı tanısı</h1>
            <p className="sub">
              Her kaynağa bu sunucudan bir istek atılır; sonuç aşağıda ham hâliyle görünür.
              Sayfanın ekran görüntüsü sorunu tespit etmeye yeter.
            </p>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 18 }}>
          <div className="kv">
            <span className="dim">Yayındaki sürüm</span>
            <strong className="mono">{veri.commit ?? "—"}</strong>
          </div>
          <div className="kv">
            <span className="dim">Sunucu bölgesi</span>
            <strong className="mono">{veri.bolge ?? "—"}</strong>
          </div>
          <div className="kv">
            <span className="dim">Çalışan kaynak</span>
            <strong className={calisan.length > 0 ? "up" : "down"}>
              {calisan.length} / {sonuclar.length}
            </strong>
          </div>
        </div>

        {hata && <div className="notice notice-error">Tanı çalıştırılamadı: {hata}</div>}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Kaynak</th>
                <th className="num">Durum</th>
                <th className="num">Süre</th>
                <th className="num">Boyut</th>
                <th>Yanıtın başı</th>
              </tr>
            </thead>
            <tbody>
              {sonuclar.map((s) => (
                <tr key={s.ad}>
                  <td>
                    <strong style={{ fontWeight: 500 }}>{s.ad}</strong>
                  </td>
                  <td className="num">
                    <span className={s.durum === 200 ? "up" : "down"}>{s.durum}</span>
                  </td>
                  <td className="num mono">{s.ms} ms</td>
                  <td className="num mono">{s.boyut}</td>
                  <td style={{ fontSize: 12, maxWidth: 460 }} className="dim">
                    {s.bas.slice(0, 120)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="dim" style={{ fontSize: 12, marginTop: 16, lineHeight: 1.7 }}>
          <strong>Nasıl okunur:</strong> <span className="up">200</span> = kaynak çalışıyor.
          <span className="down"> 429</span> = sağlayıcı bu sunucuyu hız sınırına takmış.
          <span className="down"> 403 / 401</span> = sağlayıcı bu sunucuyu reddediyor.
          Kripto satırı (<span className="mono">binance-BTC</span>) 200 dönüp diğerleri
          dönmüyorsa sunucunun interneti çalışıyor, sorun o sağlayıcıdadır.
        </p>
      </div>
    </main>
  );
}

"use client";

import { useMemo, useState } from "react";

import { PLAN_IDS, PLANS, type PlanId } from "@/lib/plans";
import type { UyeSatiri, YonetimOzeti } from "@/lib/yonetim";

type Veri = { ozet: YonetimOzeti; uyeler: UyeSatiri[] };

const tarih = (ms: number) =>
  new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(ms));

export default function YonetimClient({ ilk, kendiEpostam }: { ilk: Veri; kendiEpostam: string }) {
  const [veri, setVeri] = useState<Veri>(ilk);
  const [ara, setAra] = useState("");
  const [filtre, setFiltre] = useState<"hepsi" | PlanId | "deneme">("hepsi");
  const [secili, setSecili] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<{ ok: boolean; metin: string } | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  const liste = useMemo(() => {
    const q = ara.trim().toLowerCase();
    return veri.uyeler.filter(
      (u) =>
        (!q || u.email.includes(q) || u.ad.toLowerCase().includes(q)) &&
        (filtre === "hepsi" || (filtre === "deneme" ? u.denemeBitis !== null : u.plan === filtre)),
    );
  }, [veri, ara, filtre]);

  async function islem(govde: Record<string, unknown>, basari: string) {
    setBekliyor(true);
    setMesaj(null);
    const yanit = await fetch("/api/yonetim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(govde),
    }).catch(() => null);
    const json = (await yanit?.json().catch(() => null)) as (Veri & { error?: string }) | null;
    setBekliyor(false);
    if (!yanit?.ok || !json || json.error) {
      setMesaj({ ok: false, metin: json?.error ?? "İşlem başarısız." });
      return;
    }
    setVeri({ ozet: json.ozet, uyeler: json.uyeler });
    setMesaj({ ok: true, metin: basari });
  }

  const o = veri.ozet;
  const uye = secili ? veri.uyeler.find((u) => u.email === secili) ?? null : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Yönetim</h1>
          <p className="sub">Üyeler, planlar ve krediler. Bu sayfayı yalnızca yöneticiler görür.</p>
        </div>
      </div>

      <div className="yonetim-ozet">
        <Kutu etiket="Toplam üye" deger={o.toplam} />
        <Kutu etiket="Son 7 gün" deger={o.son7Gun} />
        <Kutu etiket="Son 30 gün" deger={o.son30Gun} />
        <Kutu etiket="Süren deneme" deger={o.aktifDeneme} />
        <Kutu etiket="Davetle gelen" deger={o.davetleGelen} />
        {PLAN_IDS.map((id) => (
          <Kutu key={id} etiket={PLANS[id].ad} deger={o.planlar[id]} />
        ))}
      </div>

      {mesaj && <div className={`notice ${mesaj.ok ? "" : "notice-error"}`}>{mesaj.metin}</div>}

      {uye && (
        <div className="card yonetim-detay">
          <div className="card-title">
            <span>{uye.email}</span>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setSecili(null)}>
              Kapat
            </button>
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
            {uye.ad} · kayıt {tarih(uye.kayit)} · {uye.giris} · takip {uye.takip} · davet kodu {uye.kod}
            {uye.yonetici && " · yönetici"}
          </p>

          <div className="yonetim-satir">
            <span>Plan</span>
            <div className="hesap-islemleri">
              {PLAN_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`btn btn-sm ${uye.plan === id ? "btn-primary" : "btn-ghost"}`}
                  disabled={bekliyor || uye.plan === id}
                  onClick={() => islem({ islem: "plan", email: uye.email, plan: id }, `Plan ${PLANS[id].ad} yapıldı.`)}
                >
                  {PLANS[id].ad}
                </button>
              ))}
            </div>
          </div>

          <div className="yonetim-satir">
            <span>Ek kredi ({uye.bonus})</span>
            <div className="hesap-islemleri">
              {[25, 100, 500].map((m) => (
                <button
                  key={m}
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={bekliyor}
                  onClick={() => islem({ islem: "bonus", email: uye.email, miktar: m }, `${m} ek kredi verildi.`)}
                >
                  +{m}
                </button>
              ))}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={bekliyor || uye.bonus === 0}
                onClick={() =>
                  islem({ islem: "bonus", email: uye.email, miktar: -uye.bonus }, "Ek krediler sıfırlandı.")
                }
              >
                Sıfırla
              </button>
            </div>
          </div>

          <div className="yonetim-satir">
            <span>
              Deneme{" "}
              {uye.denemeBitis ? `(bitiş ${tarih(uye.denemeBitis)})` : uye.denemeKullanildi ? "(kullanıldı)" : "(kullanılmadı)"}
            </span>
            <div className="hesap-islemleri">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={bekliyor || uye.denemeKullanildi || uye.plan !== "ucretsiz"}
                onClick={() => islem({ islem: "deneme", email: uye.email }, "7 gün Premium denemesi başlatıldı.")}
              >
                Denemeyi başlat
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={bekliyor || !uye.denemeKullanildi}
                onClick={() => islem({ islem: "deneme-sifirla", email: uye.email }, "Deneme hakkı geri verildi.")}
              >
                Hakkı geri ver
              </button>
            </div>
          </div>
          <p className="dim" style={{ fontSize: 12, marginBottom: 0 }}>
            Plan değişikliği ödeme almadan yapılır (hediye, test, destek için).
          </p>
        </div>
      )}

      <div className="card">
        <div className="yonetim-arac">
          <input
            className="input"
            placeholder="E-posta ya da ad ara"
            value={ara}
            onChange={(e) => setAra(e.target.value)}
          />
          <select className="input" value={filtre} onChange={(e) => setFiltre(e.target.value as typeof filtre)}>
            <option value="hepsi">Tüm planlar</option>
            {PLAN_IDS.map((id) => (
              <option key={id} value={id}>
                {PLANS[id].ad}
              </option>
            ))}
            <option value="deneme">Denemedekiler</option>
          </select>
        </div>
        <p className="dim" style={{ fontSize: 12 }}>
          {liste.length} üye gösteriliyor
          {o.toplam >= o.listeSiniri && ` (en yeni ${o.listeSiniri} kayıt)`}
        </p>

        <div className="yonetim-tablo-sarici">
          <table className="yonetim-tablo">
            <thead>
              <tr>
                <th>E-posta</th>
                <th>Kayıt</th>
                <th>Plan</th>
                <th>Kalan</th>
                <th>Ek</th>
                <th>Davet</th>
              </tr>
            </thead>
            <tbody>
              {liste.map((u) => (
                <tr
                  key={u.email}
                  className={u.email === secili ? "secili" : undefined}
                  onClick={() => setSecili(u.email)}
                >
                  <td>
                    <strong>{u.email}</strong>
                    {u.email === kendiEpostam.toLowerCase() && <span className="pill" style={{ marginLeft: 6 }}>siz</span>}
                    {u.yonetici && <span className="pill" style={{ marginLeft: 6 }}>yönetici</span>}
                  </td>
                  <td>{tarih(u.kayit)}</td>
                  <td>
                    {PLANS[u.plan].ad}
                    {u.denemeBitis && <span className="dim"> · deneme</span>}
                  </td>
                  <td className="mono">{u.yonetici ? "∞" : u.kalan}</td>
                  <td className="mono">{u.bonus || "—"}</td>
                  <td className="mono">{u.davetSayisi || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Kutu({ etiket, deger }: { etiket: string; deger: number }) {
  return (
    <div className="card yonetim-kutu">
      <span className="card-label">{etiket}</span>
      <strong>{deger}</strong>
    </div>
  );
}

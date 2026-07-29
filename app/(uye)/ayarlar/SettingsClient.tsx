"use client";

import { useState } from "react";

import { INTERVALS } from "@/lib/binance";
import type { UserSettings } from "@/lib/users";

export default function SettingsClient({
  email,
  name,
  createdAt,
  watchlistCount,
  settings,
  hasPassword,
}: {
  email: string;
  name: string;
  createdAt: number | null;
  watchlistCount: number;
  settings: UserSettings;
  hasPassword: boolean;
}) {
  const [form, setForm] = useState<UserSettings>(settings);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setMessage(null);

    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus("error");
      setMessage(body?.error ?? "Ayarlar kaydedilemedi.");
      return;
    }
    setStatus("saved");
    setMessage("Ayarlar kaydedildi.");
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ayarlar</h1>
          <p className="sub">Analiz tercihlerinizi ve hesap bilgilerinizi yönetin.</p>
        </div>
      </div>

      {message && (
        <div className={`notice ${status === "error" ? "notice-error" : ""}`}>{message}</div>
      )}

      <div className="grid-2">
        <div className="card">
          <div className="card-title">Analiz tercihleri</div>
          <form onSubmit={save}>
            <div className="field">
              <label htmlFor="interval">Varsayılan zaman dilimi</label>
              <select
                id="interval"
                className="select"
                value={form.defaultInterval}
                onChange={(e) => setForm({ ...form, defaultInterval: e.target.value })}
              >
                {INTERVALS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label} ({item.value})
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="scanLimit">Tarayıcıda taranacak coin sayısı</label>
              <select
                id="scanLimit"
                className="select"
                value={form.scanLimit}
                onChange={(e) => setForm({ ...form, scanLimit: Number(e.target.value) })}
              >
                {[10, 20, 30, 40, 60].map((value) => (
                  <option key={value} value={value}>
                    {value} coin
                  </option>
                ))}
              </select>
              <span className="dim" style={{ fontSize: 12 }}>
                Daha yüksek sayı daha uzun sürer; Binance istek limitine dikkat edin.
              </span>
            </div>

            <div className="field">
              <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  checked={form.onlyStrongSignals}
                  onChange={(e) => setForm({ ...form, onlyStrongSignals: e.target.checked })}
                />
                Tarayıcıda varsayılan olarak yalnızca güçlü sinyalleri göster
              </label>
            </div>

            <button className="btn btn-primary" type="submit" disabled={status === "saving"}>
              {status === "saving" ? <span className="spinner" /> : null} Kaydet
            </button>
          </form>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-title">Hesap</div>
            <div className="kv">
              <span>E-posta</span>
              <strong>{email}</strong>
            </div>
            <div className="kv">
              <span>Ad</span>
              <strong>{name || "—"}</strong>
            </div>
            <div className="kv">
              <span>Kayıt tarihi</span>
              <strong>
                {createdAt ? new Date(createdAt).toLocaleDateString("tr-TR") : "—"}
              </strong>
            </div>
            <div className="kv">
              <span>Giriş yöntemi</span>
              <strong>{hasPassword ? "E-posta + parola" : "Google"}</strong>
            </div>
            <div className="kv">
              <span>Takip listesi</span>
              <strong>{watchlistCount} parite</strong>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Veri ve gizlilik</div>
            <ul className="bullet-list">
              <li>
                Binance&apos;e yalnızca herkese açık piyasa uç noktalarından istek atılır; API
                anahtarı kullanılmaz, hesabınıza erişilmez.
              </li>
              <li>
                Parolanız scrypt ile, kullanıcıya özel tuzla saklanır; düz metin olarak hiçbir
                yere yazılmaz.
              </li>
              <li>
                Takip listeniz ve tercihleriniz sunucudaki kullanıcı deposunda tutulur.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

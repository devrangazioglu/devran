"use client";

import { useState } from "react";

import { useI18n } from "@/components/I18nProvider";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { formatDate } from "@/lib/format";
import { INTERVALS, MARKETS, AKTIF_MARKET_IDS } from "@/lib/markets/types";
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
  const { t, intl } = useI18n();
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
      setMessage(body?.error ?? t("settings.saveFailed"));
      return;
    }
    setStatus("saved");
    setMessage(t("settings.saved"));
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t("settings.title")}</h1>
          <p className="sub">{t("settings.sub")}</p>
        </div>
        <LanguageSwitcher />
      </div>

      {message && (
        <div className={`notice ${status === "error" ? "notice-error" : ""}`}>{message}</div>
      )}

      <div className="grid-2">
        <div className="card">
          <div className="card-title">{t("settings.prefs")}</div>
          <form onSubmit={save}>
            {/* Tek piyasa açıkken seçilecek bir şey yok. */}
            {AKTIF_MARKET_IDS.length > 1 && (
              <div className="field">
                <label htmlFor="market">{t("settings.defaultMarket")}</label>
                <select
                  id="market"
                  className="select"
                  value={form.defaultMarket}
                  onChange={(e) => setForm({ ...form, defaultMarket: e.target.value })}
                >
                  {AKTIF_MARKET_IDS.map((id) => (
                    <option key={id} value={id}>
                      {t(`market.${id}` as "market.kripto")}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="field">
              <label htmlFor="interval">{t("settings.defaultInterval")}</label>
              <select
                id="interval"
                className="select"
                value={form.defaultInterval}
                onChange={(e) => setForm({ ...form, defaultInterval: e.target.value })}
              >
                {INTERVALS.filter((item) =>
                  MARKETS[
                    (AKTIF_MARKET_IDS.includes(form.defaultMarket as never)
                      ? form.defaultMarket
                      : "kripto") as "kripto"
                  ].intervals.includes(item.value),
                ).map((item) => (
                  <option key={item.value} value={item.value}>
                    {t(`interval.${item.value}` as "interval.4h")} ({item.value})
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="scanLimit">{t("settings.scanLimit")}</label>
              <select
                id="scanLimit"
                className="select"
                value={form.scanLimit}
                onChange={(e) => setForm({ ...form, scanLimit: Number(e.target.value) })}
              >
                {[10, 20, 30, 40, 60].map((value) => (
                  <option key={value} value={value}>
                    {t("scan.assetCount", { count: value })}
                  </option>
                ))}
              </select>
              <span className="dim" style={{ fontSize: 12 }}>
                {t("settings.scanLimitHint")}
              </span>
            </div>

            <div className="field">
              <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  checked={form.onlyStrongSignals}
                  onChange={(e) => setForm({ ...form, onlyStrongSignals: e.target.checked })}
                />
                {t("settings.onlyStrong")}
              </label>
            </div>

            <button className="btn btn-primary" type="submit" disabled={status === "saving"}>
              {status === "saving" ? <span className="spinner" /> : null} {t("settings.save")}
            </button>
          </form>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-title">{t("settings.account")}</div>
            <div className="kv">
              <span>{t("auth.email")}</span>
              <strong>{email}</strong>
            </div>
            <div className="kv">
              <span>{t("auth.name")}</span>
              <strong>{name || "—"}</strong>
            </div>
            <div className="kv">
              <span>{t("settings.registeredAt")}</span>
              <strong>{createdAt ? formatDate(createdAt, intl) : "—"}</strong>
            </div>
            <div className="kv">
              <span>{t("settings.loginMethod")}</span>
              <strong>
                {hasPassword ? t("settings.loginPassword") : t("settings.loginGoogle")}
              </strong>
            </div>
            <div className="kv">
              <span>{t("nav.watchlist")}</span>
              <strong>{t("settings.watchlistCount", { count: watchlistCount })}</strong>
            </div>
          </div>

          <div className="card">
            <div className="card-title">{t("settings.privacy")}</div>
            <ul className="bullet-list">
              <li>{t("settings.privacy.1")}</li>
              <li>{t("settings.privacy.2")}</li>
              <li>{t("settings.privacy.3")}</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

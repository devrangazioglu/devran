"use client";

/**
 * Dört piyasada birden varlık arama.
 * Yazarken gecikmeli (debounce) olarak `/api/search` sorgulanır.
 */

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useI18n } from "./I18nProvider";
import { MarketBadge } from "./ui";
import { getJson, type SearchResponse } from "@/lib/api-types";
import type { Instrument } from "@/lib/markets/types";

export default function AssetSearch({
  size = "normal",
  onPick,
  autoFocus = false,
  placeholderKey = "common.searchPlaceholder",
}: {
  size?: "normal" | "large";
  /** Verilirse seçim bu fonksiyona gider; verilmezse varlık sayfasına gidilir. */
  onPick?: (instrument: Instrument) => void;
  autoFocus?: boolean;
  placeholderKey?: "common.searchPlaceholder" | "watch.addPlaceholder";
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapper = useRef<HTMLDivElement>(null);

  // Dışarı tıklanınca listeyi kapat.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 1) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const body = await getJson<SearchResponse>(
          `/api/search?q=${encodeURIComponent(term)}`,
          controller.signal,
        );
        setResults(body.results);
        setHighlight(0);
        setOpen(true);
      } catch {
        // İptal edilen ya da başarısız aramada mevcut liste korunur.
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  function pick(instrument: Instrument) {
    setOpen(false);
    setQuery("");
    if (onPick) onPick(instrument);
    else router.push(`/varlik/${instrument.market}/${encodeURIComponent(instrument.symbol)}`);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((h) => (h + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => (h - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      pick(results[highlight]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className={`search ${size === "large" ? "search-large" : ""}`} ref={wrapper}>
      <div className="search-field">
        <span className="search-icon" aria-hidden>
          ⌕
        </span>
        <input
          className="input search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={t(placeholderKey)}
          autoFocus={autoFocus}
          aria-label={t("common.search")}
          autoComplete="off"
        />
        {loading && <span className="spinner" />}
      </div>

      {open && (
        <div className="search-results">
          {results.length === 0 ? (
            <div className="search-empty">
              {query.trim().length < 2 ? t("common.searchHint") : t("common.noResults")}
            </div>
          ) : (
            results.map((instrument, index) => (
              <button
                key={instrument.id}
                className={`search-item ${index === highlight ? "active" : ""}`}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => pick(instrument)}
              >
                <span className="search-ticker">{instrument.ticker}</span>
                <span className="search-name">{instrument.name}</span>
                <MarketBadge market={instrument.market} />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

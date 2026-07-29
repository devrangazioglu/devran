"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { detectUiLang, getDict, saveUiLang, type UiLang } from "@/lib/i18n";
import {
  addEntry,
  clearEntries,
  deleteEntry,
  listEntries,
  type HistoryEntry,
} from "@/lib/history";
import { renderTranslatedPage, canvasToBase64Png, type PageItem } from "@/lib/render";
import { canvasesToPdf, imageFileToCanvas, pdfToCanvases } from "@/lib/pdf";

const LANGUAGES = [
  "English",
  "Turkish",
  "Romanian",
  "German",
  "French",
  "Spanish",
  "Italian",
  "Portuguese",
  "Dutch",
  "Polish",
  "Russian",
  "Ukrainian",
  "Arabic",
  "Japanese",
  "Korean",
  "Chinese (Simplified)",
];

const MAX_FILE_MB = 20;

const ACCEPTED = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

type Progress = {
  phase: "preparing" | "translating" | "assembling";
  page: number;
  total: number;
};

type FileResult = {
  url: string;
  name: string;
  mime: string;
  size: number;
};

const LANG_CODES: Record<string, string> = {
  English: "en",
  Turkish: "tr",
  Romanian: "ro",
  German: "de",
  French: "fr",
  Spanish: "es",
  Italian: "it",
  Portuguese: "pt",
  Dutch: "nl",
  Polish: "pl",
  Russian: "ru",
  Ukrainian: "uk",
  Arabic: "ar",
  Japanese: "ja",
  Korean: "ko",
  "Chinese (Simplified)": "zh",
};

function errorMessage(reason: string, t: ReturnType<typeof getDict>): string {
  if (reason === "busy") return t.errBusy;
  if (reason === "quota") return t.errQuota;
  if (reason === "auth") return t.errAuth;
  return t.errGeneric;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function fileToBase64(f: File): Promise<string> {
  const buf = await f.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export default function Home() {
  const [uiLang, setUiLang] = useState<UiLang>("en");
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<"main" | "settings">("main");
  const [googleAuth, setGoogleAuth] = useState(false);
  const [guest, setGuest] = useState(true);
  const { data: session, status: sessionStatus } = useSession();

  const [sourceLang, setSourceLang] = useState("Auto Detect");
  const [targetLang, setTargetLang] = useState("Turkish");
  const [mode, setMode] = useState<"file" | "text">("file");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [output, setOutput] = useState("");
  const [result, setResult] = useState<FileResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryEntry[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const t = getDict(uiLang);

  useEffect(() => {
    setUiLang(detectUiLang());
    setGuest(window.localStorage.getItem("transivo.guest") === "1");
    setHydrated(true);
    fetch("/api/config")
      .then((r) => r.json())
      .then((c) => setGoogleAuth(Boolean(c.googleAuth)))
      .catch(() => setGoogleAuth(false));
  }, []);

  useEffect(() => {
    if (view === "settings") {
      listEntries().then(setHistoryItems).catch(() => setHistoryItems([]));
    }
  }, [view]);

  const changeUiLang = (lang: UiLang) => {
    setUiLang(lang);
    saveUiLang(lang);
  };

  const pickFile = useCallback(
    (f: File) => {
      setError(null);
      if (!ACCEPTED.includes(f.type)) {
        setError(t.errFileType);
        return;
      }
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        setError(t.errFileSize(MAX_FILE_MB));
        return;
      }
      setFile(f);
      setOutput("");
      setResult(null);
    },
    [t],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) pickFile(f);
    },
    [pickFile],
  );

  const removeFile = () => {
    if (translating) abortRef.current?.abort();
    setFile(null);
    setOutput("");
    setResult(null);
    setError(null);
    setProgress(null);
  };

  const saveToHistory = async (blob: Blob, name: string, mime: string) => {
    try {
      await addEntry({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        from: sourceLang,
        to: targetLang,
        date: Date.now(),
        mime,
        blob,
      });
    } catch {
      /* history is best-effort */
    }
  };

  /* ── File mode: translate the document itself ── */
  const translateFile = async () => {
    if (!file) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress({ phase: "preparing", page: 0, total: 0 });

    const isPdf = file.type === "application/pdf";
    const canvases = isPdf
      ? await pdfToCanvases(await file.arrayBuffer())
      : [await imageFileToCanvas(file)];

    const translated: HTMLCanvasElement[] = [];
    for (let i = 0; i < canvases.length; i++) {
      setProgress({ phase: "translating", page: i + 1, total: canvases.length });
      const res = await fetch("/api/translate-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          imageBase64: canvasToBase64Png(canvases[i]),
          mimeType: "image/png",
          sourceLang,
          targetLang,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(errorMessage(data?.reason ?? "unknown", t));
      translated.push(
        renderTranslatedPage(canvases[i], (data.items ?? []) as PageItem[]),
      );
    }

    setProgress({
      phase: "assembling",
      page: canvases.length,
      total: canvases.length,
    });

    const base = file.name.replace(/\.[^.]+$/, "");
    let blob: Blob;
    let name: string;
    let mime: string;

    if (isPdf) {
      blob = await canvasesToPdf(translated);
      name = `${base}.${(LANG_CODES[targetLang] ?? "xx")}.pdf`;
      mime = "application/pdf";
    } else {
      blob = await new Promise<Blob>((resolve, reject) =>
        translated[0].toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
          "image/png",
        ),
      );
      name = `${base}.${(LANG_CODES[targetLang] ?? "xx")}.png`;
      mime = "image/png";
    }

    await saveToHistory(blob, name, mime);
    setResult({ url: URL.createObjectURL(blob), name, mime, size: blob.size });
    setProgress(null);
  };

  /* ── Text mode: stream translated text ── */
  const translateText = async () => {
    if (!file) return;
    const controller = new AbortController();
    abortRef.current = controller;

    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        fileBase64: await fileToBase64(file),
        mediaType: file.type,
        sourceLang,
        targetLang,
      }),
    });

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      const reason = detail.startsWith("__TRANSIVO_ERROR__:")
        ? detail.slice("__TRANSIVO_ERROR__:".length).trim()
        : "unknown";
      throw new Error(errorMessage(reason, t));
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let acc = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      acc += decoder.decode(value, { stream: true });
      const [text, note] = acc.split("__TRANSIVO_NOTE__:");
      setOutput(text);
      if (note) {
        setError(note.trim() === "truncated" ? t.noteTruncated : t.noteRefused);
      }
    }
  };

  const translate = async () => {
    if (!file || translating) return;
    setTranslating(true);
    setOutput("");
    setResult(null);
    setError(null);
    try {
      if (mode === "file") await translateFile();
      else await translateText();
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message || t.errGeneric);
      }
      setProgress(null);
    } finally {
      setTranslating(false);
      abortRef.current = null;
    }
  };

  const downloadEntry = (entry: HistoryEntry) => {
    const url = URL.createObjectURL(entry.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = entry.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  if (!hydrated) return <main className="phone" />;

  /* ── Login gate ── */
  const needsLogin =
    googleAuth && sessionStatus !== "loading" && !session && !guest;

  if (needsLogin) {
    return (
      <main className="phone login-screen">
        <h1 className="title" style={{ fontStyle: "italic", fontSize: 34 }}>
          Transivo
        </h1>
        <div className="card login-card">
          <h2>{t.welcomeTitle}</h2>
          <p>{t.welcomeSub}</p>
          <button className="pillbtn" onClick={() => signIn("google")}>
            <GoogleIcon /> {t.signInGoogle}
          </button>
          <button
            className="ghostbtn"
            onClick={() => {
              window.localStorage.setItem("transivo.guest", "1");
              setGuest(true);
            }}
          >
            {t.continueGuest}
          </button>
          <p className="fineprint">{t.authNote}</p>
        </div>
      </main>
    );
  }

  /* ── Settings view ── */
  if (view === "settings") {
    return (
      <main className="phone">
        <header className="topbar">
          <button
            className="iconbtn"
            aria-label={t.back}
            onClick={() => setView("main")}
          >
            <BackIcon />
          </button>
          <h1 className="title">{t.settings}</h1>
          <span style={{ width: 40 }} />
        </header>

        <div className="section-label">{t.account}</div>
        <section className="card">
          {session?.user ? (
            <div className="account-row">
              {session.user.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="avatar-img" src={session.user.image} alt="" />
              )}
              <div className="account-meta">
                <div className="account-name">{session.user.name}</div>
                <div className="account-mail">{session.user.email}</div>
              </div>
              <button className="smallbtn" onClick={() => signOut()}>
                {t.signOut}
              </button>
            </div>
          ) : (
            <div className="account-row">
              <span className="badge">
                <UserIcon />
              </span>
              <div className="account-meta">
                <div className="account-name">{t.guest}</div>
              </div>
              {googleAuth && (
                <button className="smallbtn" onClick={() => signIn("google")}>
                  {t.signInGoogle}
                </button>
              )}
            </div>
          )}
          {!session && <p className="fineprint">{t.authNote}</p>}
        </section>

        <div className="section-label">{t.appLanguage}</div>
        <section className="card">
          <div className="lang-row">
            <label className="lang-field" style={{ flex: 1 }}>
              <span className="tag">{t.appLanguage}</span>
              <select
                value={uiLang}
                onChange={(e) => changeUiLang(e.target.value as UiLang)}
              >
                <option value="en">English</option>
                <option value="tr">Türkçe</option>
              </select>
            </label>
          </div>
        </section>

        <div className="section-label">{t.history}</div>
        {historyItems.length === 0 ? (
          <p className="hint">{t.historyEmpty}</p>
        ) : (
          <>
            {historyItems.map((entry) => (
              <div className="history-card" key={entry.id}>
                <span className="doc-icon dark">
                  {entry.mime === "application/pdf" ? <FileIcon /> : <ImageIcon />}
                </span>
                <div className="doc-meta">
                  <div className="history-name">{entry.name}</div>
                  <div className="history-sub">
                    {entry.from} → {entry.to} ·{" "}
                    {new Date(entry.date).toLocaleDateString(
                      uiLang === "tr" ? "tr-TR" : "en-US",
                    )}
                  </div>
                </div>
                <button
                  className="iconbtn"
                  aria-label={t.download}
                  onClick={() => downloadEntry(entry)}
                >
                  <DownloadIcon />
                </button>
                <button
                  className="iconbtn"
                  aria-label={t.delete}
                  onClick={() =>
                    deleteEntry(entry.id).then(() =>
                      listEntries().then(setHistoryItems),
                    )
                  }
                >
                  <XIcon />
                </button>
              </div>
            ))}
            <button
              className="ghostbtn"
              onClick={() => clearEntries().then(() => setHistoryItems([]))}
            >
              {t.clearHistory}
            </button>
          </>
        )}
      </main>
    );
  }

  /* ── Main view ── */
  return (
    <main className="phone">
      <header className="topbar">
        <button className="iconbtn" aria-label="New translation" onClick={removeFile}>
          <PencilIcon />
        </button>
        <h1 className="title">Transivo</h1>
        <button
          className="iconbtn"
          aria-label={t.settings}
          onClick={() => setView("settings")}
        >
          <GearIcon />
        </button>
      </header>

      <section className="card">
        <div className="card-head">
          <span className="badge">
            <GlobeIcon />
          </span>
          <span className="label">{t.languages}</span>
        </div>
        <div className="lang-row">
          <label className="lang-field">
            <span className="tag">{t.from}</span>
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
            >
              <option value="Auto Detect">{t.autoDetect}</option>
              {LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <span className="lang-arrow">
            <ArrowIcon />
          </span>
          <label className="lang-field">
            <span className="tag">{t.to}</span>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="segmented">
          <button
            className={mode === "file" ? "seg active" : "seg"}
            onClick={() => setMode("file")}
          >
            {t.modeFile}
          </button>
          <button
            className={mode === "text" ? "seg active" : "seg"}
            onClick={() => setMode("text")}
          >
            {t.modeText}
          </button>
        </div>
      </section>

      <button
        className="pillbtn"
        onClick={translate}
        disabled={!file || translating}
      >
        {translating ? (
          <>
            <span className="spinner" aria-hidden />
            {t.translating}
          </>
        ) : (
          t.translate
        )}
      </button>

      <div className="section-label">{t.document}</div>

      {file ? (
        <div className="doc-card">
          <span className="doc-icon">
            {file.type === "application/pdf" ? <FileIcon /> : <ImageIcon />}
          </span>
          <div className="doc-meta">
            <div className="doc-name">{file.name}</div>
            <div className="doc-sub">
              {file.type === "application/pdf" ? t.pdf : t.image} ·{" "}
              {formatSize(file.size)}
            </div>
          </div>
          <button className="doc-x" aria-label="Remove file" onClick={removeFile}>
            <XIcon />
          </button>
        </div>
      ) : (
        <div
          className={`dropzone${dragOver ? " dragover" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
        >
          <UploadIcon />
          <div className="dz-title">{t.dropTitle}</div>
          <div className="dz-sub">{t.dropSub}</div>
        </div>
      )}

      {progress && (
        <div className="progress-wrap">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width:
                  progress.phase === "preparing"
                    ? "6%"
                    : progress.phase === "assembling"
                      ? "97%"
                      : `${Math.round((progress.page / Math.max(1, progress.total)) * 90) + 6}%`,
              }}
            />
          </div>
          <div className="progress-text">
            {progress.phase === "preparing"
              ? t.preparing
              : progress.phase === "assembling"
                ? t.assembling
                : t.pageProgress(progress.page, progress.total)}
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pickFile(f);
          e.target.value = "";
        }}
      />

      <div className="section-label">{t.activity}</div>

      {!output && !result && !error && !progress && (
        <p className="hint">{file ? t.hintReady : t.hintUpload}</p>
      )}

      {error && (
        <div className="error-card">
          <span>{error}</span>
          {file && !translating && (
            <button className="retrybtn" onClick={translate}>
              <RetryIcon /> {t.retry}
            </button>
          )}
        </div>
      )}

      {result && (
        <div className="doc-card">
          <span className="doc-icon">
            {result.mime === "application/pdf" ? <FileIcon /> : <ImageIcon />}
          </span>
          <div className="doc-meta">
            <div className="doc-name">{result.name}</div>
            <div className="doc-sub">
              {t.translatedFile} · {formatSize(result.size)}
            </div>
          </div>
          <a className="downloadbtn" href={result.url} download={result.name}>
            <DownloadIcon /> {t.download}
          </a>
        </div>
      )}

      {result && result.mime.startsWith("image/") && (
        <div className="result-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="preview-img" src={result.url} alt={result.name} />
        </div>
      )}

      {output && (
        <div className="result-card">
          <div className="who">
            <span className="avatar">
              <SparkIcon />
            </span>
            <span>
              {t.translationLabel} · {targetLang}
            </span>
          </div>
          <div className={`text${translating ? " streaming" : ""}`}>{output}</div>
        </div>
      )}

      <button
        className="fab"
        aria-label="Upload a file"
        onClick={() => inputRef.current?.click()}
      >
        <PlusIcon />
      </button>
    </main>
  );
}

/* ── Inline icons ─────────────────────────── */

function PencilIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-4.5-4.5L5 22" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m17 8-5-5-5 5" />
      <path d="M12 3v12" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.35 11.1H12v2.9h5.35c-.5 2.5-2.6 4.3-5.35 4.3a5.8 5.8 0 1 1 0-11.6c1.5 0 2.8.55 3.8 1.45l2.15-2.15A8.9 8.9 0 0 0 12 3.1a8.9 8.9 0 1 0 0 17.8c5.15 0 8.85-3.6 8.85-8.75 0-.35-.05-.7-.1-1.05Z" />
    </svg>
  );
}

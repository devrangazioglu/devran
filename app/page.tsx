"use client";

import { useCallback, useRef, useState } from "react";

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

type PickedFile = {
  name: string;
  mediaType: string;
  sizeLabel: string;
  base64: string;
};

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Home() {
  const [sourceLang, setSourceLang] = useState("Auto Detect");
  const [targetLang, setTargetLang] = useState("Turkish");
  const [file, setFile] = useState<PickedFile | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const pickFile = useCallback(async (f: File) => {
    setError(null);
    if (!ACCEPTED.includes(f.type)) {
      setError("Only PDF, PNG, JPEG, WebP and GIF files are supported.");
      return;
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`File is too large. Maximum size is ${MAX_FILE_MB} MB.`);
      return;
    }
    const buf = await f.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    setFile({
      name: f.name,
      mediaType: f.type,
      sizeLabel: formatSize(f.size),
      base64: btoa(binary),
    });
    setOutput("");
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) void pickFile(f);
    },
    [pickFile],
  );

  const removeFile = () => {
    if (translating) abortRef.current?.abort();
    setFile(null);
    setOutput("");
    setError(null);
  };

  const translate = async () => {
    if (!file || translating) return;
    setTranslating(true);
    setOutput("");
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          fileBase64: file.base64,
          mediaType: file.mediaType,
          sourceLang,
          targetLang,
        }),
      });

      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "");
        throw new Error(detail || `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setOutput((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message || "Translation failed. Please try again.");
      }
    } finally {
      setTranslating(false);
      abortRef.current = null;
    }
  };

  return (
    <main className="phone">
      <header className="topbar">
        <button className="iconbtn" aria-label="New translation" onClick={removeFile}>
          <PencilIcon />
        </button>
        <h1 className="title">Transivo</h1>
        <button className="iconbtn" aria-label="Settings">
          <GearIcon />
        </button>
      </header>

      <section className="card">
        <div className="card-head">
          <span className="badge">
            <GlobeIcon />
          </span>
          <span className="label">Languages</span>
        </div>
        <div className="lang-row">
          <label className="lang-field">
            <span className="tag">From</span>
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
            >
              <option>Auto Detect</option>
              {LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <span className="lang-arrow">
            <ArrowIcon />
          </span>
          <label className="lang-field">
            <span className="tag">To</span>
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
      </section>

      <button
        className="pillbtn"
        onClick={translate}
        disabled={!file || translating}
      >
        {translating ? (
          <>
            <span className="spinner" aria-hidden />
            Translating…
          </>
        ) : (
          "Translate"
        )}
      </button>

      <div className="section-label">Document</div>

      {file ? (
        <div className="doc-card">
          <span className="doc-icon">
            {file.mediaType === "application/pdf" ? <FileIcon /> : <ImageIcon />}
          </span>
          <div className="doc-meta">
            <div className="doc-name">{file.name}</div>
            <div className="doc-sub">
              {file.mediaType === "application/pdf" ? "PDF" : "Image"} ·{" "}
              {file.sizeLabel}
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
          <div className="dz-title">Drop a PDF or image here</div>
          <div className="dz-sub">or tap to browse · max {MAX_FILE_MB} MB</div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void pickFile(f);
          e.target.value = "";
        }}
      />

      <div className="section-label">Activity</div>

      {!output && !error && (
        <p className="hint">
          {file
            ? "Tap Translate to start"
            : "Upload a document to translate its text"}
        </p>
      )}

      {error && <div className="error-card">{error}</div>}

      {output && (
        <div className="result-card">
          <div className="who">
            <span className="avatar">
              <SparkIcon />
            </span>
            <span>
              Translation · {targetLang}
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

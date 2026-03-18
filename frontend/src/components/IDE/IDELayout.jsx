import { useState, lazy, Suspense } from "react";
import FileExplorer   from "./FileExplorer.jsx";
import OutputPanel    from "./OutputPanel.jsx";
import AiAssistantPanel from "./AiAssistantPanel.jsx";
import SessionsPanel    from "./SessionsPanel.jsx";
import { useAnalyzeError } from "../../hooks/useAnalyzeError.js";
import { useSessions }     from "../../hooks/useSessions.js";

const CodeEditorPanel = lazy(() => import("./CodeEditorPanel.jsx"));

/* ─── Demo project file tree ─────────────────────────────────── */

const DEMO_TREE = [
  {
    type: "folder", name: "src", open: true,
    children: [
      {
        type: "file", name: "App.jsx", lang: "javascript", path: "src/App.jsx",
        content: `import { useState } from "react";

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="app">
      <h1>Count: {count}</h1>
      <button onClick={() => setCount(c => c + 1)}>+</button>
      <button onClick={() => setCount(c => c - 1)}>-</button>
    </div>
  );
}`,
      },
      {
        type: "file", name: "utils.js", lang: "javascript", path: "src/utils.js",
        content: `export function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}`,
      },
      {
        type: "file", name: "index.css", lang: "css", path: "src/index.css",
        content: `* { box-sizing: border-box; margin: 0; }

body {
  font-family: system-ui, sans-serif;
  background: #111;
  color: #eee;
  min-height: 100vh;
}

.app {
  max-width: 800px;
  margin: 2rem auto;
  padding: 0 1rem;
}`,
      },
    ],
  },
  {
    type: "file", name: "package.json", lang: "json", path: "package.json",
    content: `{
  "name": "demo-project",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  }
}`,
  },
  {
    type: "file", name: "README.md", lang: "markdown", path: "README.md",
    content: `# Demo Project

A demo project in the DevFix IDE.

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Usage

Paste your code in any file and click **Analyze** to debug it with AI.`,
  },
];

const DEFAULT_FILE = DEMO_TREE[0].children[0];

/* ─── Main IDE layout ────────────────────────────────────────── */

export default function IDELayout({ onExit }) {
  const [openFiles,   setOpenFiles]   = useState([DEFAULT_FILE]);
  const [activeFile,  setActiveFile]  = useState(DEFAULT_FILE.path);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [bottomOpen,  setBottomOpen]  = useState(true);
  const [errorInput,  setErrorInput]  = useState("");

  const { result, loading, error: analyzeError, status, analyze, reset, restore } = useAnalyzeError();
  const { save: saveSession, saving: savingSession } = useSessions();

  const [showSessions, setShowSessions] = useState(false);
  const [saveStatus,   setSaveStatus]   = useState("idle"); // "idle"|"saving"|"saved"|"error"

  // Count of lines flagged across all fixes — drives the Output tab badge
  const markerCount = (result?.fixes ?? []).reduce(
    (acc, f) => acc + (f.affectedLines?.length ?? 0), 0
  );

  async function handleSaveSession() {
    if (!currentFile) return;
    setSaveStatus("saving");
    try {
      await saveSession({
        fileName:       currentFile.name,
        language:       currentFile.lang,
        codeSnapshot:   currentFile.content,
        errorMessage:   errorInput || undefined,
        analysisResult: result ?? undefined,
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 2500);
    }
  }

  function handleRestoreSession(session) {
    // Open the saved file in the editor
    const path    = session.fileName ?? "restored.js";
    const lang    = session.language ?? "javascript";
    const content = session.codeSnapshot ?? "";
    const existing = openFiles.find((f) => f.name === session.fileName);

    if (existing) {
      updateContent(existing.path, content);
      setActiveFile(existing.path);
    } else {
      const node = { name: path, lang, content, path };
      setOpenFiles((prev) => [...prev, node]);
      setActiveFile(path);
    }

    // Restore the analysis result so markers + AI panel rehydrate
    if (session.analysisResult?.rootCause) {
      restore(session.analysisResult);
      setBottomOpen(true);
    }

    if (session.errorMessage) setErrorInput(session.errorMessage);
  }

  function setFileLanguage(lang) {
    if (!activeFile) return;
    setOpenFiles((prev) =>
      prev.map((f) => (f.path === activeFile ? { ...f, lang } : f))
    );
  }

  const currentFile = openFiles.find((f) => f.path === activeFile) ?? null;

  function openFile(node) {
    if (!openFiles.find((f) => f.path === node.path)) {
      setOpenFiles((prev) => [...prev, node]);
    }
    setActiveFile(node.path);
  }

  function closeFile(path, e) {
    e?.stopPropagation();
    const remaining = openFiles.filter((f) => f.path !== path);
    setOpenFiles(remaining);
    if (activeFile === path) {
      setActiveFile(remaining.length > 0 ? remaining[remaining.length - 1].path : null);
    }
  }

  function updateContent(path, val) {
    setOpenFiles((prev) =>
      prev.map((f) => (f.path === path ? { ...f, content: val } : f))
    );
  }

  function handleInsertCode(code) {
    if (!activeFile) return;
    updateContent(activeFile, code);
  }

  function handleAnalyze() {
    if (!currentFile?.content?.trim()) return;
    analyze({ errorMessage: errorInput, codeSnippet: currentFile.content });
    setBottomOpen(true);
  }

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100 overflow-hidden">
      {/* ── Title bar ─────────────────────────────────────────── */}
      <div className="h-10 shrink-0 flex items-center gap-3 px-4 bg-gray-900 border-b border-gray-800">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center text-[10px] font-bold select-none">
            D
          </div>
          <span className="text-xs font-semibold text-gray-300">DevFix IDE</span>
        </div>

        <div className="w-px h-4 bg-gray-700 shrink-0" />

        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          title="Toggle sidebar (Explorer)"
          className={`p-1 rounded transition-colors ${
            sidebarOpen
              ? "text-gray-300 hover:bg-gray-800"
              : "text-gray-600 hover:text-gray-400 hover:bg-gray-800"
          }`}
        >
          <SidebarIcon />
        </button>

        {/* Error / problem description input */}
        <div className="flex-1 flex items-center gap-2 max-w-lg">
          <input
            value={errorInput}
            onChange={(e) => setErrorInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
            placeholder="Describe the problem (optional) — or just click Analyze"
            className="flex-1 text-xs bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 transition-colors"
          />
          <button
            onClick={handleAnalyze}
            disabled={loading || !currentFile?.content?.trim()}
            className="shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed"
          >
            {loading ? <SpinnerIcon /> : <BugIcon />}
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>

        <div className="flex-1" />

        {/* Save session button */}
        <button
          onClick={handleSaveSession}
          disabled={savingSession || saveStatus === "saving" || !currentFile}
          title="Save session snapshot"
          className={`shrink-0 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
            saveStatus === "saved"
              ? "bg-emerald-900/40 border-emerald-700/60 text-emerald-300"
              : saveStatus === "error"
              ? "bg-red-900/40 border-red-700/60 text-red-300"
              : "border-gray-700 text-gray-500 hover:text-gray-200 hover:border-gray-600 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
          }`}
        >
          {saveStatus === "saving" ? <SpinnerIcon /> : <SaveIcon />}
          {saveStatus === "saved" ? "Saved!" : saveStatus === "error" ? "Failed" : "Save"}
        </button>

        {/* Sessions browser button */}
        <button
          onClick={() => setShowSessions((v) => !v)}
          title="Browse saved sessions"
          className={`shrink-0 p-1.5 rounded-lg border transition-all ${
            showSessions
              ? "bg-indigo-900/40 border-indigo-700/60 text-indigo-300"
              : "border-gray-700 text-gray-500 hover:text-gray-200 hover:border-gray-600 hover:bg-gray-800"
          }`}
        >
          <BookmarkIcon />
        </button>

        {/* Status dot */}
        <span
          className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
            loading ? "bg-indigo-400 animate-pulse" : "bg-emerald-500"
          }`}
        />

        {/* Exit */}
        <button
          onClick={onExit}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors px-2 py-1 rounded hover:bg-gray-800 shrink-0"
        >
          Exit IDE
        </button>
      </div>

      {/* ── Main area ─────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* Sessions drawer — absolute overlay anchored to this container */}
        {showSessions && (
          <SessionsPanel
            onClose={() => setShowSessions(false)}
            onRestore={handleRestoreSession}
          />
        )}
        {/* Left sidebar — file explorer */}
        {sidebarOpen && (
          <FileExplorer
            tree={DEMO_TREE}
            activeFile={activeFile}
            onOpenFile={openFile}
          />
        )}

        {/* Center column: tabs + editor + bottom panel */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* File tabs + language selector */}
          <div className="flex items-stretch border-b border-gray-800 bg-gray-900 shrink-0">
            <div className="flex-1 overflow-x-auto">
              <FileTabs
                files={openFiles}
                activeFile={activeFile}
                onSelect={setActiveFile}
                onClose={closeFile}
              />
            </div>
            {currentFile && (
              <LanguageSelector
                value={currentFile.lang}
                onChange={setFileLanguage}
              />
            )}
          </div>

          {/* Monaco editor */}
          <div className="flex-1 overflow-hidden">
            {currentFile ? (
              <Suspense fallback={<EditorLoader />}>
                <CodeEditorPanel
                  key={currentFile.path}
                  language={currentFile.lang}
                  value={currentFile.content}
                  onChange={(val) => updateContent(currentFile.path, val)}
                  fixes={result?.fixes ?? []}
                />
              </Suspense>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-700">
                <svg className="h-10 w-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                </svg>
                <p className="text-sm">Open a file from the explorer</p>
              </div>
            )}
          </div>

          {/* Output / Problems panel */}
          {bottomOpen && (
            <OutputPanel
              result={result}
              loading={loading}
              error={analyzeError}
              status={status}
              markerCount={markerCount}
              onClose={() => setBottomOpen(false)}
              onClear={reset}
            />
          )}
        </div>

        {/* Right panel — AI Assistant */}
        <div className="w-72 xl:w-80 shrink-0 border-l border-gray-800 flex flex-col overflow-hidden">
          <AiAssistantPanel
            currentFile={currentFile}
            analysisResult={result}
            onInsertCode={handleInsertCode}
          />
        </div>
      </div>

      {/* ── Status bar ────────────────────────────────────────── */}
      <div className="h-6 shrink-0 flex items-center gap-3 px-4 bg-indigo-950/50 border-t border-indigo-900/60 text-[10px] text-indigo-300/70">
        <span className="text-indigo-400">DevFix</span>
        <span className="text-indigo-900">|</span>
        <span>{currentFile ? currentFile.path : "No file open"}</span>
        {currentFile?.lang && (
          <>
            <span className="text-indigo-900">|</span>
            <span>{currentFile.lang}</span>
          </>
        )}
        <div className="flex-1" />
        {loading && <span className="text-indigo-400 animate-pulse">⟳ Analyzing…</span>}
        {!loading && status === "success" && <span className="text-emerald-400/70">✓ Analysis ready</span>}
        <button
          onClick={() => setBottomOpen((v) => !v)}
          className="hover:text-indigo-200 transition-colors ml-2"
          title="Toggle output panel"
        >
          {bottomOpen ? "▾ Output" : "▴ Output"}
        </button>
      </div>
    </div>
  );
}

/* ─── Editor loading fallback ───────────────────────────────── */

function EditorLoader() {
  return (
    <div className="h-full flex items-center justify-center text-gray-700 text-xs gap-2">
      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      Loading editor…
    </div>
  );
}

/* ─── File tabs ──────────────────────────────────────────────── */

function FileTabs({ files, activeFile, onSelect, onClose }) {
  if (files.length === 0) {
    return (
      <div className="h-9 flex items-center px-4 text-xs text-gray-700">
        No files open
      </div>
    );
  }

  return (
    <div className="h-9 flex items-stretch bg-transparent overflow-x-auto">
      {files.map((file) => {
        const isActive = file.path === activeFile;
        return (
          <button
            key={file.path}
            onClick={() => onSelect(file.path)}
            className={`
              relative flex items-center gap-2 px-4 text-xs border-r border-gray-800 shrink-0 group transition-colors
              ${
                isActive
                  ? "bg-gray-950 text-gray-200"
                  : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/60"
              }
            `}
          >
            {/* Active indicator line */}
            {isActive && (
              <span className="absolute top-0 left-0 right-0 h-[2px] bg-indigo-500" />
            )}
            <FileTypeLabel name={file.name} />
            <span>{file.name}</span>
            <span
              onClick={(e) => onClose(file.path, e)}
              className="ml-0.5 w-3.5 h-3.5 flex items-center justify-center rounded text-gray-600 hover:text-gray-300 hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
            >
              ×
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ─── File type label ────────────────────────────────────────── */

function FileTypeLabel({ name }) {
  const ext  = name.split(".").pop()?.toLowerCase();
  const map  = {
    js:   ["JS",   "text-yellow-400"],
    jsx:  ["JSX",  "text-cyan-400"],
    ts:   ["TS",   "text-blue-400"],
    tsx:  ["TSX",  "text-blue-300"],
    css:  ["CSS",  "text-blue-500"],
    json: ["{}",   "text-yellow-300"],
    md:   ["MD",   "text-gray-400"],
    html: ["HTML", "text-orange-400"],
    py:   ["PY",   "text-green-400"],
  };
  const [label, color] = map[ext] ?? ["•", "text-gray-600"];
  return (
    <span className={`text-[9px] font-bold ${color}`}>{label}</span>
  );
}

/* ─── Language selector ─────────────────────────────────────────────────────── */

const LANGUAGES = [
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "python",     label: "Python" },
  { id: "css",        label: "CSS" },
  { id: "html",       label: "HTML" },
  { id: "json",       label: "JSON" },
  { id: "markdown",   label: "Markdown" },
  { id: "rust",       label: "Rust" },
  { id: "go",         label: "Go" },
  { id: "java",       label: "Java" },
  { id: "cpp",        label: "C++" },
  { id: "shell",      label: "Shell" },
  { id: "yaml",       label: "YAML" },
];

function LanguageSelector({ value, onChange }) {
  return (
    <div className="shrink-0 flex items-center border-l border-gray-800 px-2">
      <select
        value={value ?? "javascript"}
        onChange={(e) => onChange(e.target.value)}
        className="
          text-xs bg-transparent text-gray-400 hover:text-gray-200 border-none
          focus:outline-none cursor-pointer py-1 px-1 rounded transition-colors
          hover:bg-gray-800
        "
        title="Change language"
      >
        {LANGUAGES.map((l) => (
          <option key={l.id} value={l.id} className="bg-gray-900 text-gray-200">
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ─── Icons ──────────────────────────────────────────────────── */

function SidebarIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" strokeLinecap="round" />
    </svg>
  );
}

function BugIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 12c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm0 0v8
           m-4-4H4m16 0h-4M5.5 7.5L3 5m15.5 2.5L21 5M5.5 16.5L3 19m15.5-2.5L21 19" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
    </svg>
  );
}

import { useState, lazy, Suspense, useRef, useEffect } from "react";
import FileExplorer      from "./FileExplorer.jsx";
import OutputPanel       from "./OutputPanel.jsx";
import AiAssistantPanel  from "./AiAssistantPanel.jsx";
import SessionsPanel     from "./SessionsPanel.jsx";
import InterviewPanel    from "./InterviewPanel.jsx";
import MenuBar           from "./MenuBar.jsx";
import { useAnalyzeError } from "../../hooks/useAnalyzeError.js";
import { useSessions }     from "../../hooks/useSessions.js";
import { useInterview }    from "../../hooks/useInterview.js";

const CodeEditorPanel = lazy(() => import("./CodeEditorPanel.jsx"));

/* ─── Extension → Monaco language map ───────────────────────── */

const EXT_LANG = {
  js:"javascript", jsx:"javascript", mjs:"javascript", cjs:"javascript",
  ts:"typescript", tsx:"typescript",
  css:"css", scss:"css", sass:"css",
  html:"html", htm:"html",
  json:"json",
  md:"markdown", mdx:"markdown",
  py:"python", rs:"rust", go:"go", java:"java",
  cpp:"cpp", cc:"cpp", cxx:"cpp", c:"c", h:"c",
  sh:"shell", bash:"shell", zsh:"shell",
  yaml:"yaml", yml:"yaml", toml:"ini", txt:"markdown",
};

function langFromExt(ext) {
  return EXT_LANG[ext?.toLowerCase()] ?? "javascript";
}

/* ─── Demo project file tree ─────────────────────────────────── */

const DEMO_TREE = [
  {
    type: "folder", name: "src", open: true, path: "src",
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

/* ─── Flatten file tree to a flat list of file nodes ─────────── */

function flattenFiles(nodes) {
  const files = [];
  for (const node of nodes) {
    if (node.type === "file") files.push(node);
    else if (node.children) files.push(...flattenFiles(node.children));
  }
  return files;
}

/* ─── Main IDE layout ────────────────────────────────────────── */

export default function IDELayout({ onExit }) {
  // ── File / project state ──────────────────────────────────────
  const [fileTree,    setFileTree]    = useState(DEMO_TREE);
  const [openFiles,   setOpenFiles]   = useState([DEFAULT_FILE]);
  const [activeFile,  setActiveFile]  = useState(DEFAULT_FILE.path);
  const [projectRoot, setProjectRoot] = useState("");

  // ── Panel visibility ──────────────────────────────────────────
  const [sidebarOpen,    setSidebarOpen]    = useState(true);
  const [bottomOpen,     setBottomOpen]     = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  // ── Editor options ────────────────────────────────────────────
  const [wordWrap, setWordWrap] = useState(false);
  const [minimap,  setMinimap]  = useState(true);

  // ── Misc UI ───────────────────────────────────────────────────
  const [errorInput, setErrorInput] = useState("");
  const [saveStatus, setSaveStatus] = useState("idle"); // "idle"|"saving"|"saved"|"error"

  // ── Dialogs ───────────────────────────────────────────────────
  const [showGoToFile,  setShowGoToFile]  = useState(false);
  const [goToFileQuery, setGoToFileQuery] = useState("");
  const [showNewFile,   setShowNewFile]   = useState(false);
  const [newFileName,   setNewFileName]   = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // ── Panels ────────────────────────────────────────────────────
  const [showSessions,  setShowSessions]  = useState(false);
  const [showInterview, setShowInterview] = useState(false);

  // ── Hooks ─────────────────────────────────────────────────────
  const { result, loading, error: analyzeError, status, analyze, reset, restore } = useAnalyzeError();
  const { save: saveSession, saving: savingSession } = useSessions();
  const interview = useInterview();

  // ── Refs ──────────────────────────────────────────────────────
  const editorRef      = useRef(null);   // Monaco editor instance
  const menuActionRef  = useRef(null);   // always-current handleMenuAction

  // ── Derived ───────────────────────────────────────────────────
  const currentFile = openFiles.find((f) => f.path === activeFile) ?? null;
  const allFiles    = flattenFiles(fileTree);
  const markerCount = (result?.fixes ?? []).reduce((acc, f) => acc + (f.affectedLines?.length ?? 0), 0);
  const viewState   = { sidebarOpen, bottomOpen, showAiPanel: rightPanelOpen, wordWrap, minimap };

  // ── Core file operations ──────────────────────────────────────

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
    setOpenFiles((prev) => prev.map((f) => (f.path === path ? { ...f, content: val } : f)));
  }

  function setFileLanguage(lang) {
    if (!activeFile) return;
    setOpenFiles((prev) => prev.map((f) => (f.path === activeFile ? { ...f, lang } : f)));
  }

  // ── File System Access API operations ─────────────────────────

  async function handleOpenFile() {
    if ("showOpenFilePicker" in window) {
      try {
        const [fileHandle] = await window.showOpenFilePicker({ multiple: false });
        const file    = await fileHandle.getFile();
        const content = await file.text();
        const ext     = file.name.split(".").pop();
        const node    = { type: "file", name: file.name, path: file.name, lang: langFromExt(ext), content, fileHandle };
        setFileTree((prev) => prev.find((n) => n.path === node.path) ? prev : [...prev, node]);
        openFile(node);
      } catch (e) {
        if (e.name !== "AbortError") console.error("Open file error:", e);
      }
    } else {
      // Fallback: hidden <input type="file">
      const input = Object.assign(document.createElement("input"), { type: "file" });
      input.onchange = async (e) => {
        const file    = e.target.files[0];
        if (!file) return;
        const content = await file.text();
        const ext     = file.name.split(".").pop();
        const node    = { type: "file", name: file.name, path: file.name, lang: langFromExt(ext), content };
        setFileTree((prev) => prev.find((n) => n.path === node.path) ? prev : [...prev, node]);
        openFile(node);
      };
      input.click();
    }
  }

  async function _buildDirTree(dirHandle, parentPath) {
    const children = [];
    try {
      for await (const [name, handle] of dirHandle.entries()) {
        if (name.startsWith(".")) continue; // skip hidden
        const path = `${parentPath}/${name}`;
        if (handle.kind === "file") {
          const file    = await handle.getFile();
          const content = await file.text().catch(() => "");
          children.push({ type: "file", name, path, lang: langFromExt(name.split(".").pop()), content, fileHandle: handle });
        } else {
          const sub = await _buildDirTree(handle, path);
          children.push({ type: "folder", name, path, open: false, dirHandle: handle, children: sub });
        }
      }
    } catch (e) { console.error("Dir read error:", e); }
    return children.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  async function handleOpenFolder() {
    if (!("showDirectoryPicker" in window)) {
      alert("Open Folder requires a Chromium-based browser (Chrome / Edge) with File System Access API.");
      return;
    }
    try {
      const dirHandle = await window.showDirectoryPicker();
      const children  = await _buildDirTree(dirHandle, dirHandle.name);
      setFileTree([{ type: "folder", name: dirHandle.name, path: dirHandle.name, open: true, dirHandle, children }]);
      setProjectRoot(dirHandle.name);
      setOpenFiles([]);
      setActiveFile(null);
    } catch (e) {
      if (e.name !== "AbortError") console.error("Open folder error:", e);
    }
  }

  async function handleSaveFile() {
    if (!currentFile) return;
    setSaveStatus("saving");
    try {
      if (currentFile.fileHandle) {
        const writable = await currentFile.fileHandle.createWritable();
        await writable.write(currentFile.content ?? "");
        await writable.close();
      } else {
        // Virtual file — offer download
        const blob = new Blob([currentFile.content ?? ""], { type: "text/plain" });
        const url  = URL.createObjectURL(blob);
        const a    = Object.assign(document.createElement("a"), { href: url, download: currentFile.name });
        a.click();
        URL.revokeObjectURL(url);
      }
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
    setTimeout(() => setSaveStatus("idle"), 2000);
  }

  async function handleSaveAll() {
    setSaveStatus("saving");
    for (const file of openFiles) {
      if (!file.fileHandle) continue;
      try {
        const w = await file.fileHandle.createWritable();
        await w.write(file.content ?? "");
        await w.close();
      } catch (e) { console.error("Save error:", file.name, e); }
    }
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
  }

  // ── New file / folder ─────────────────────────────────────────

  function confirmNewFile() {
    const name = newFileName.trim();
    if (!name) return;
    const ext    = name.split(".").pop();
    const prefix = projectRoot ? projectRoot + "/" : "";
    const node   = { type: "file", name, path: prefix + name, lang: langFromExt(ext), content: "" };
    setFileTree((prev) => [...prev, node]);
    openFile(node);
    setShowNewFile(false);
  }

  function confirmNewFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    const prefix = projectRoot ? projectRoot + "/" : "";
    const node   = { type: "folder", name, path: prefix + name, open: true, children: [] };
    setFileTree((prev) => [...prev, node]);
    setShowNewFolder(false);
  }

  // ── Session operations ────────────────────────────────────────

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
    } catch {
      setSaveStatus("error");
    }
    setTimeout(() => setSaveStatus("idle"), 2500);
  }

  function handleRestoreSession(session) {
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
    if (session.analysisResult?.rootCause) {
      restore(session.analysisResult);
      setBottomOpen(true);
    }
    if (session.errorMessage) setErrorInput(session.errorMessage);
  }

  // ── Editor helpers ────────────────────────────────────────────

  function handleInsertCode(code) {
    if (!activeFile) return;
    updateContent(activeFile, code);
  }

  function handleAnalyze() {
    if (!currentFile?.content?.trim()) return;
    analyze({ errorMessage: errorInput, codeSnippet: currentFile.content });
    setBottomOpen(true);
  }

  // ── Menu action dispatcher ────────────────────────────────────

  async function handleMenuAction(id) {
    const editor  = editorRef.current;
    const trigger = (cmd) => editor?.trigger("menu", cmd, null);

    switch (id) {
      // File
      case "file.new":        setNewFileName("");   setShowNewFile(true);   break;
      case "file.newFolder":  setNewFolderName(""); setShowNewFolder(true); break;
      case "file.open":       await handleOpenFile();   break;
      case "file.openFolder": await handleOpenFolder(); break;
      case "file.save":       await handleSaveFile();   break;
      case "file.saveAll":    await handleSaveAll();    break;
      case "file.close":      if (activeFile) closeFile(activeFile); break;

      // Edit
      case "edit.undo":       trigger("undo"); break;
      case "edit.redo":       trigger("redo"); break;
      case "edit.cut":        trigger("editor.action.clipboardCutAction");    break;
      case "edit.copy":       trigger("editor.action.clipboardCopyAction");   break;
      case "edit.paste":      trigger("editor.action.clipboardPasteAction");  break;
      case "edit.selectAll":  trigger("editor.action.selectAll");             break;
      case "edit.find":       trigger("actions.find");                        break;
      case "edit.replace":    trigger("editor.action.startFindReplaceAction"); break;

      // Selection
      case "sel.selectAll":       trigger("editor.action.selectAll");          break;
      case "sel.selectLine":      trigger("expandLineSelection");              break;
      case "sel.addCursorAbove":  trigger("editor.action.insertCursorAbove"); break;
      case "sel.addCursorBelow":  trigger("editor.action.insertCursorBelow"); break;

      // View
      case "view.explorer": setSidebarOpen((v) => !v);    break;
      case "view.output":   setBottomOpen((v) => !v);     break;
      case "view.ai":       setRightPanelOpen((v) => !v); break;
      case "view.wordWrap": setWordWrap((v) => !v);        break;
      case "view.minimap":  setMinimap((v) => !v);         break;

      // Go
      case "go.file":        setGoToFileQuery(""); setShowGoToFile(true); break;
      case "go.line":        trigger("editor.action.gotoLine");           break;
      case "go.nextProblem": trigger("editor.action.marker.next");        break;
      case "go.prevProblem": trigger("editor.action.marker.prev");        break;

      // Run
      case "run.analyze":    handleAnalyze();      break;
      case "run.showOutput": setBottomOpen(true);  break;
      case "run.clear":      reset();              break;
    }
  }

  // Keep menuActionRef always pointing at the latest version (avoids stale closures in keyboard handler)
  menuActionRef.current = handleMenuAction;

  // ── Global keyboard shortcuts ─────────────────────────────────

  useEffect(() => {
    function onKeyDown(e) {
      if (!e.ctrlKey && !e.metaKey) return;
      const dispatch = (id) => { e.preventDefault(); menuActionRef.current(id); };
      if (e.key === "s" && !e.shiftKey)  dispatch("file.save");
      else if (e.key === "s" && e.shiftKey) dispatch("file.saveAll");
      else if (e.key === "o" && !e.shiftKey) dispatch("file.open");
      else if (e.key === "O" && e.shiftKey)  dispatch("file.openFolder");
      else if (e.key === "n" && !e.shiftKey) dispatch("file.new");
      else if (e.key === "w")  dispatch("file.close");
      else if (e.key === "p")  dispatch("go.file");
      else if (e.key === "b")  dispatch("view.explorer");
      else if (e.key === "j")  dispatch("view.output");
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []); // runs once; always uses latest handler via ref

  // ── Render ────────────────────────────────────────────────────

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
          title="Save session snapshot to cloud"
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

        {/* Sessions browser */}
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
        <span className={`w-2 h-2 rounded-full shrink-0 transition-colors ${loading ? "bg-indigo-400 animate-pulse" : "bg-emerald-500"}`} />

        {/* Exit */}
        <button
          onClick={onExit}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors px-2 py-1 rounded hover:bg-gray-800 shrink-0"
        >
          Exit IDE
        </button>
      </div>

      {/* ── VS Code–style menu bar ─────────────────────────────── */}
      <MenuBar onAction={handleMenuAction} viewState={viewState} />

      {/* ── Main area ─────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* Sessions drawer */}
        {showSessions && (
          <SessionsPanel
            onClose={() => setShowSessions(false)}
            onRestore={handleRestoreSession}
          />
        )}

        {/* Left sidebar — file explorer */}
        {sidebarOpen && (
          <FileExplorer
            tree={fileTree}
            activeFile={activeFile}
            onOpenFile={openFile}
            projectName={projectRoot || "Explorer"}
          />
        )}

        {/* Center column: tabs + editor + bottom panel */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 relative">

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
              <LanguageSelector value={currentFile.lang} onChange={setFileLanguage} />
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
                  wordWrap={wordWrap}
                  minimap={minimap}
                  onEditorMount={(editor) => { editorRef.current = editor; }}
                />
              </Suspense>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-700">
                <svg className="h-10 w-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                </svg>
                <p className="text-sm">Open a file to start editing</p>
                <p className="text-xs text-gray-600">
                  File → Open File… <span className="font-mono">(Ctrl+O)</span>
                  {" · "}File → Open Folder… <span className="font-mono">(Ctrl+Shift+O)</span>
                </p>
              </div>
            )}
          </div>

          {/* Floating robot button */}
          {!showInterview && (
            <button
              onClick={() => {
                setShowInterview(true);
                if (interview.state === "IDLE") {
                  const snapshot = openFiles.map((f) => ({ path: f.path, lang: f.lang ?? "text", content: f.content ?? "" }));
                  interview.startInterview(snapshot);
                }
              }}
              title="Start Interview Agent"
              className="
                absolute bottom-4 right-4 z-20
                w-11 h-11 rounded-full flex items-center justify-center
                bg-violet-700 hover:bg-violet-500 text-white
                shadow-[0_0_20px_rgba(139,92,246,0.5)]
                hover:shadow-[0_0_28px_rgba(139,92,246,0.8)]
                hover:scale-110 active:scale-95
                transition-all duration-200
              "
            >
              <RobotFloatIcon />
            </button>
          )}

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

        {/* Right panel — AI Assistant OR Interview Agent */}
        {rightPanelOpen && (
          <div className="w-72 xl:w-80 shrink-0 border-l border-gray-800 flex flex-col overflow-hidden">
            {showInterview ? (
              <InterviewPanel interview={interview} onClose={() => setShowInterview(false)} />
            ) : (
              <AiAssistantPanel
                currentFile={currentFile}
                analysisResult={result}
                onInsertCode={handleInsertCode}
              />
            )}
          </div>
        )}
      </div>

      {/* ── Status bar ────────────────────────────────────────── */}
      <div className="h-6 shrink-0 flex items-center gap-3 px-4 bg-indigo-950/50 border-t border-indigo-900/60 text-[10px] text-indigo-300/70">
        <span className="text-indigo-400">DevFix</span>
        <span className="text-indigo-900">|</span>
        {projectRoot && (
          <>
            <span className="text-indigo-300/50 truncate max-w-[120px]" title={projectRoot}>{projectRoot}</span>
            <span className="text-indigo-900">|</span>
          </>
        )}
        <span className="truncate max-w-[200px]">{currentFile ? currentFile.path : "No file open"}</span>
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

      {/* ── Overlays ──────────────────────────────────────────── */}

      {showGoToFile && (
        <GoToFileDialog
          query={goToFileQuery}
          onQueryChange={setGoToFileQuery}
          files={allFiles}
          onSelect={(node) => { openFile(node); setShowGoToFile(false); }}
          onClose={() => setShowGoToFile(false)}
        />
      )}

      {showNewFile && (
        <NameDialog
          title="New File"
          placeholder="filename.js"
          value={newFileName}
          onChange={setNewFileName}
          onConfirm={confirmNewFile}
          onCancel={() => setShowNewFile(false)}
        />
      )}

      {showNewFolder && (
        <NameDialog
          title="New Folder"
          placeholder="folder-name"
          value={newFolderName}
          onChange={setNewFolderName}
          onConfirm={confirmNewFolder}
          onCancel={() => setShowNewFolder(false)}
        />
      )}
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

/* ─── Go to File dialog ──────────────────────────────────────── */

function GoToFileDialog({ query, onQueryChange, files, onSelect, onClose }) {
  const inputRef = useRef(null);
  const filtered = query
    ? files.filter((f) =>
        f.name.toLowerCase().includes(query.toLowerCase()) ||
        f.path.toLowerCase().includes(query.toLowerCase())
      )
    : files;

  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg overflow-hidden shadow-2xl"
        style={{ background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.12)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && filtered[0]) onSelect(filtered[0]);
          }}
          placeholder="Type a file name to open…"
          className="w-full px-4 py-3 text-sm bg-transparent text-gray-200 placeholder-gray-600 border-b border-gray-700 focus:outline-none"
        />
        <div className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-xs text-gray-600">No matching files</div>
          ) : (
            filtered.map((f, i) => (
              <button
                key={i}
                onClick={() => onSelect(f)}
                className="w-full flex items-center gap-3 px-4 py-2 text-xs hover:bg-indigo-600/30 transition-colors text-left"
              >
                <FileTypeLabel name={f.name} />
                <span className="flex-1 truncate text-gray-300">{f.name}</span>
                <span className="text-gray-600 shrink-0 font-mono truncate max-w-[160px]">{f.path}</span>
              </button>
            ))
          )}
        </div>
        <div className="px-4 py-1.5 text-[10px] text-gray-700 border-t border-gray-800">
          ↑↓ to navigate · Enter to open · Esc to close
        </div>
      </div>
    </div>
  );
}

/* ─── Name dialog (New File / New Folder) ────────────────────── */

function NameDialog({ title, placeholder, value, onChange, onConfirm, onCancel }) {
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onCancel}
    >
      <div
        className="w-80 rounded-lg p-4 shadow-2xl"
        style={{ background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.12)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-medium text-gray-200 mb-3">{title}</p>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onConfirm();
            if (e.key === "Escape") onCancel();
          }}
          placeholder={placeholder}
          className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 mb-3"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!value.trim()}
            className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded transition-colors"
          >
            Create
          </button>
        </div>
      </div>
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
              ${isActive ? "bg-gray-950 text-gray-200" : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/60"}
            `}
          >
            {isActive && <span className="absolute top-0 left-0 right-0 h-[2px] bg-indigo-500" />}
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
  const ext  = name?.split(".").pop()?.toLowerCase();
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
    rs:   ["RS",   "text-orange-500"],
    go:   ["GO",   "text-cyan-500"],
  };
  const [label, color] = map[ext] ?? ["•", "text-gray-600"];
  return <span className={`text-[9px] font-bold ${color}`}>{label}</span>;
}

/* ─── Language selector ──────────────────────────────────────── */

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
        className="text-xs bg-transparent text-gray-400 hover:text-gray-200 border-none focus:outline-none cursor-pointer py-1 px-1 rounded transition-colors hover:bg-gray-800"
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

function RobotFloatIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <rect x="4" y="8" width="16" height="12" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h.01M15 12h.01M9 16h6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8V5m-2 0h4" />
      <circle cx="12" cy="4" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext.jsx";
import AuthPage        from "./components/AuthPage.jsx";
import AnalyticsPanel  from "./components/AnalyticsPanel.jsx";
import ErrorForm       from "./components/ErrorForm.jsx";
import ResultPanel     from "./components/ResultPanel.jsx";
import HistoryPanel    from "./components/HistoryPanel.jsx";
import RepoForm        from "./components/RepoForm.jsx";
import RepoResultPanel from "./components/RepoResultPanel.jsx";
import ChatPanel       from "./components/ChatPanel.jsx";
import IDELayout       from "./components/IDE/IDELayout.jsx";
import { useAnalyzeError } from "./hooks/useAnalyzeError.js";
import { useRepoAnalyze }  from "./hooks/useRepoAnalyze.js";
import { useHistory }      from "./hooks/useHistory.js";

const MODES = [
  { id: "debugger",   label: "Error Debugger",  icon: <BugIcon /> },
  { id: "repo",       label: "Repo Analyzer",   icon: <RepoIcon /> },
  { id: "chat",       label: "Code Chat",        icon: <ChatIcon /> },
  { id: "ide",        label: "IDE",              icon: <IDEIcon /> },
  { id: "analytics",  label: "Analytics",        icon: <AnalyticsIcon /> },
];

/* ── Root: handles auth gating ──────────────────────────────────── */
export default function Root() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

function AppShell() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return <App />;
}

/* ── Main app (authenticated) ───────────────────────────────────── */
function App() {
  const { user, logout } = useAuth();
  const [mode, setMode] = useState("debugger");

  // ── Error debugger state ────────────────────────────────────────────────
  const { result, loading, error, status, analyze, reset, restore } = useAnalyzeError();
  const { items, loading: histLoading, error: histError, loadHistory, save, getById } = useHistory();
  const [showHistory, setShowHistory] = useState(false);
  const hasDebugOutput = status !== "idle";

  useEffect(() => {
    if (status === "success" && result) save(result);
  }, [status, result, save]);

  useEffect(() => {
    if (showHistory) loadHistory();
  }, [showHistory, loadHistory]);

  async function handleSelectHistory(id) {
    setShowHistory(false);
    try {
      const full = await getById(id);
      restore(full);
    } catch {
      // non-critical
    }
  }

  // ── Repo analyzer state ─────────────────────────────────────────────────
  const { result: repoResult, loading: repoLoading, error: repoError,
          status: repoStatus, analyze: analyzeRepo, reset: resetRepo } = useRepoAnalyze();
  const hasRepoOutput = repoStatus !== "idle";

  // ── Mode switch ─────────────────────────────────────────────────────────
  function switchMode(next) {
    if (next === mode) return;
    if (next === "debugger") { resetRepo(); }
    if (next === "repo")     { reset(); setShowHistory(false); }
    if (next === "ide")      { reset(); resetRepo(); setShowHistory(false); }
    setMode(next);
  }

  const anyLoading = loading || repoLoading;

  // Full-screen IDE mode — bypasses normal layout
  if (mode === "ide") {
    return <IDELayout onExit={() => setMode("debugger")} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-950 text-gray-100">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/90 backdrop-blur px-6 py-3 flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold text-sm select-none">
          D
        </div>
        <span className="font-semibold tracking-tight">DevFix</span>
        <span className="hidden sm:inline text-xs text-gray-500">AI Debugging Assistant</span>

        <div className="ml-auto flex items-center gap-4">
          {/* New analysis / reset button */}
          {(hasDebugOutput || hasRepoOutput) && (
            <button
              onClick={() => mode === "debugger" ? reset() : resetRepo()}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              ← New analysis
            </button>
          )}

          {/* History — only shown in debugger mode */}
          {mode === "debugger" && (
            <button
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-gray-800"
            >
              <HistoryIcon />
              History
              {items.length > 0 && (
                <span className="ml-0.5 bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {items.length}
                </span>
              )}
            </button>
          )}

          {/* Status indicator */}
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full transition-colors ${anyLoading ? "bg-indigo-400 animate-pulse" : "bg-emerald-500"}`} />
            <span className="text-xs text-gray-500">
              {anyLoading ? "Analyzing…" : "Ready"}
            </span>
          </div>

          {/* User menu */}
          <UserMenu user={user} onLogout={logout} />
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-8 flex flex-col gap-6">

        {/* Mode toggle */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-900 border border-gray-800 self-start">
          {MODES.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => switchMode(id)}
              className={`
                flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${mode === id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                }
              `}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* ── Error Debugger ── */}
        {mode === "debugger" && (
          <>
            <ErrorForm onAnalyze={analyze} loading={loading} />
            {hasDebugOutput && (
              <ResultPanel result={result} loading={loading} error={error} />
            )}
          </>
        )}

        {/* ── Repo Analyzer ── */}
        {mode === "repo" && (
          <>
            <RepoForm onAnalyze={analyzeRepo} loading={repoLoading} />
            {hasRepoOutput && (
              <RepoResultPanel result={repoResult} loading={repoLoading} error={repoError} />
            )}
          </>
        )}

        {/* ── Code Chat ── */}
        {mode === "chat" && <ChatPanel />}

        {/* ── Analytics ── */}
        {mode === "analytics" && <AnalyticsPanel />}
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-800 py-4 text-center text-xs text-gray-600">
        DevFix · AI Debugging &amp; Repo Analysis · For educational use
      </footer>

      {/* ── History drawer (debugger only) ─────────────────────────────────── */}
      {showHistory && (
        <HistoryPanel
          items={items}
          loading={histLoading}
          error={histError}
          onSelect={handleSelectHistory}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}

/* ── User menu ──────────────────────────────────────────────────── */
function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);

  const initial = user?.name?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
      >
        <div className="w-7 h-7 rounded-full bg-indigo-700 flex items-center justify-center text-xs font-bold text-white select-none">
          {initial}
        </div>
        <span className="hidden sm:block text-xs text-gray-300 max-w-[120px] truncate">
          {user?.name}
        </span>
        <ChevronIcon />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1.5 z-20 w-52 bg-gray-900 border border-gray-700 rounded-xl shadow-xl py-1 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800">
              <div className="text-sm font-medium text-gray-100 truncate">{user?.name}</div>
              <div className="text-xs text-gray-500 truncate mt-0.5">{user?.email}</div>
            </div>
            <button
              onClick={() => { setOpen(false); onLogout(); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-red-400 transition-colors"
            >
              <LogoutIcon />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Icons ──────────────────────────────────────────────────── */

function HistoryIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function BugIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 12c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm0 0v8m-4-4H4m16 0h-4
           M5.5 7.5L3 5m15.5 2.5L21 5M5.5 16.5L3 19m15.5-2.5L21 19" />
    </svg>
  );
}

function RepoIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44
           l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0
           002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5
           1.5 0 01-1.06-.44z" />
    </svg>
  );
}

function IDEIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0
           11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0
           01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337
           A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0
           00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556
           4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
  );
}

function AnalyticsIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75
           C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625
           c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25
           c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625z
           M16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75
           c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg className="h-3 w-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0
           005.25 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
  );
}

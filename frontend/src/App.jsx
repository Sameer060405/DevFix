import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  { id: "debugger",  label: "Error Debugger" },
  { id: "repo",      label: "Repo Analyzer"  },
  { id: "chat",      label: "Code Chat"      },
  { id: "ide",       label: "IDE"            },
  { id: "analytics", label: "Analytics"      },
];

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  enter:   { opacity: 1, y: 0,  transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

export default function Root() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

function AppShell() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user)   return <AuthPage />;
  return <App />;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <Blobs />
      <div className="flex flex-col items-center gap-5 z-10">
        <motion.div
          animate={{ scale: [1, 1.06, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl text-white"
          style={{ background: "linear-gradient(135deg,#7c3aed,#6366f1)", boxShadow: "0 0 40px rgba(124,58,237,0.5)" }}
        >
          D
        </motion.div>
        <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
          <motion.div
            className="w-3.5 h-3.5 border-2 border-violet-500 border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
          />
          Loading DevFix…
        </div>
      </div>
    </div>
  );
}

function App() {
  const { user, logout } = useAuth();
  const [mode, setMode] = useState("debugger");

  const { result, loading, error, status, analyze, reset, restore } = useAnalyzeError();
  const { items, loading: histLoading, error: histError, loadHistory, save, getById } = useHistory();
  const [showHistory, setShowHistory] = useState(false);
  const hasDebugOutput = status !== "idle";

  useEffect(() => { if (status === "success" && result) save(result); }, [status, result, save]);
  useEffect(() => { if (showHistory) loadHistory(); }, [showHistory, loadHistory]);

  async function handleSelectHistory(id) {
    setShowHistory(false);
    try { restore(await getById(id)); } catch {}
  }

  const { result: repoResult, loading: repoLoading, error: repoError,
          status: repoStatus, analyze: analyzeRepo, reset: resetRepo } = useRepoAnalyze();
  const hasRepoOutput = repoStatus !== "idle";

  function switchMode(next) {
    if (next === mode) return;
    if (next === "debugger") resetRepo();
    if (next === "repo")     { reset(); setShowHistory(false); }
    if (next === "ide")      { reset(); resetRepo(); setShowHistory(false); }
    setMode(next);
  }

  const anyLoading = loading || repoLoading;

  if (mode === "ide") return <IDELayout onExit={() => switchMode("debugger")} />;

  return (
    <div className="min-h-screen flex flex-col text-gray-100 relative overflow-x-hidden">
      {/* ── Animated gradient blobs ──────────────────────────── */}
      <Blobs />

      {/* ── Navbar ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 flex items-center gap-4 px-6 h-14 glass-dark">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2.5 shrink-0 select-none">
          <div
            className="relative w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm text-white"
            style={{ background: "linear-gradient(135deg,#7c3aed,#6366f1)", boxShadow: "0 0 16px rgba(124,58,237,0.5)" }}
          >
            D
            <span
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
              style={{
                background: anyLoading ? "#fbbf24" : "#22c55e",
                border: "2px solid #020617",
                boxShadow: `0 0 6px ${anyLoading ? "rgba(251,191,36,0.7)" : "rgba(34,197,94,0.7)"}`,
                animation: anyLoading ? "pulse-dot 1s ease-in-out infinite" : undefined,
              }}
            />
          </div>
          <span className="font-bold tracking-tight text-white">DevFix</span>
          <span className="hidden md:inline text-[10px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded-full text-gray-500 border border-gray-800">
            beta
          </span>
        </a>

        {/* Nav tabs — layoutId animated indicator */}
        <nav className="hidden md:flex items-center gap-0.5 mx-auto">
          {MODES.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => switchMode(id)}
              className="relative px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors z-0"
              style={{ color: mode === id ? "#fff" : "#64748b" }}
              onMouseEnter={(e) => { if (mode !== id) e.currentTarget.style.color = "#cbd5e1"; }}
              onMouseLeave={(e) => { if (mode !== id) e.currentTarget.style.color = "#64748b"; }}
            >
              {mode === id && (
                <motion.span
                  layoutId="nav-indicator"
                  className="absolute inset-0 rounded-lg -z-10"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                />
              )}
              {label}
            </button>
          ))}
        </nav>

        {/* Right actions */}
        <div className="ml-auto md:ml-0 flex items-center gap-2">
          {(hasDebugOutput || hasRepoOutput) && (
            <button
              onClick={() => mode === "debugger" ? reset() : resetRepo()}
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-gray-400 border border-gray-800 hover:border-gray-700 hover:text-gray-200 transition-all"
            >
              <PlusIcon />
              New
            </button>
          )}
          {mode === "debugger" && (
            <button
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-gray-400 border border-gray-800 hover:border-violet-700/50 hover:text-violet-300 transition-all"
            >
              <ClockIcon />
              <span className="hidden sm:inline">History</span>
              {items.length > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/30">
                  {items.length}
                </span>
              )}
            </button>
          )}
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1.5 text-xs text-gray-600 font-medium">
            <span
              className="relative flex w-2 h-2"
              style={{ animation: anyLoading ? "pulse-dot 1.5s ease-in-out infinite" : undefined }}
            >
              <span
                className="absolute inline-flex w-full h-full rounded-full opacity-60"
                style={{ background: anyLoading ? "#fbbf24" : "#22c55e",
                         animation: anyLoading ? "ping 1s cubic-bezier(0,0,0.2,1) infinite" : undefined }}
              />
              <span className="relative inline-flex w-2 h-2 rounded-full"
                style={{ background: anyLoading ? "#fbbf24" : "#22c55e" }} />
            </span>
            {anyLoading ? "Analyzing…" : "Ready"}
          </div>
          <UserMenu user={user} onLogout={logout} />
        </div>
      </header>

      {/* Mobile tab bar */}
      <div className="md:hidden flex gap-1 px-3 py-2 glass-dark overflow-x-auto">
        {MODES.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => switchMode(id)}
            className={`relative flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all
              ${mode === id ? "text-white bg-white/[0.08] border border-white/[0.1]" : "text-gray-500"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Page content with AnimatePresence ────────────────── */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8 relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            variants={pageVariants}
            initial="initial"
            animate="enter"
            exit="exit"
            className="flex flex-col gap-5"
          >
            {mode === "debugger" && (
              <>
                {!hasDebugOutput && <WelcomeBanner mode="debugger" />}
                <ErrorForm onAnalyze={analyze} loading={loading} />
                {hasDebugOutput && <ResultPanel result={result} loading={loading} error={error} />}
              </>
            )}
            {mode === "repo" && (
              <>
                {!hasRepoOutput && <WelcomeBanner mode="repo" />}
                <RepoForm onAnalyze={analyzeRepo} loading={repoLoading} />
                {hasRepoOutput && <RepoResultPanel result={repoResult} loading={repoLoading} error={repoError} />}
              </>
            )}
            {mode === "chat" && <ChatPanel />}
            {mode === "analytics" && <AnalyticsPanel />}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="relative z-10 flex items-center justify-between px-6 py-4 text-xs text-gray-700 font-medium border-t border-white/[0.04]">
        <span>DevFix · AI Debugging &amp; Code Analysis</span>
        <span>Educational use only</span>
      </footer>

      {showHistory && (
        <HistoryPanel items={items} loading={histLoading} error={histError}
          onSelect={handleSelectHistory} onClose={() => setShowHistory(false)} />
      )}
    </div>
  );
}

/* ── Animated gradient blobs ──────────────────────────────── */
function Blobs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-gray-950 to-black" />
      {/* Blobs */}
      <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full bg-violet-900/20 blur-[120px] animate-blob" />
      <div className="absolute top-[20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-900/15 blur-[100px] animate-blob delay-2000" />
      <div className="absolute bottom-[-15%] left-[30%] w-[500px] h-[500px] rounded-full bg-purple-900/15 blur-[100px] animate-blob delay-4000" />
      {/* Subtle noise overlay */}
      <div className="absolute inset-0 opacity-[0.015]"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
    </div>
  );
}

/* ── Welcome banner ───────────────────────────────────────── */
const BANNER_META = {
  debugger: {
    icon: "🪲", title: "Error Debugger",
    desc: "Paste an error + your code. DevFix identifies the root cause and gives you ranked, actionable fixes.",
    accent: "violet",
    tips: ["Full stack traces work best", "Paste surrounding context", "Supports any language"],
  },
  repo: {
    icon: "📁", title: "Repo Analyzer",
    desc: "Enter a public GitHub URL. DevFix scans your entire repo for bugs, smells, and improvements.",
    accent: "indigo",
    tips: ["Public repos only", "Full file-level scan", "Security recommendations"],
  },
};

function WelcomeBanner({ mode }) {
  const m = BANNER_META[mode];
  if (!m) return null;
  const isViolet = m.accent === "violet";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="glass rounded-2xl p-5 flex items-start gap-4"
      style={{ boxShadow: "0 4px 32px rgba(0,0,0,0.4)" }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0 mt-0.5"
        style={{
          background: isViolet ? "rgba(124,58,237,0.15)" : "rgba(99,102,241,0.15)",
          border: `1px solid ${isViolet ? "rgba(124,58,237,0.25)" : "rgba(99,102,241,0.25)"}`,
        }}
      >
        {m.icon}
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="font-bold text-base text-white mb-1">{m.title}</h2>
        <p className="text-sm text-gray-400 leading-relaxed">{m.desc}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {m.tips.map((t) => (
            <span key={t} className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full text-gray-500 bg-white/[0.04] border border-white/[0.06]">
              <span className="text-green-500 text-[10px]">✓</span>
              {t}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ── User menu ────────────────────────────────────────────── */
function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const initial = user?.name?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-xl border border-transparent hover:border-white/[0.08] hover:bg-white/[0.04] transition-all"
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white select-none"
          style={{ background: "linear-gradient(135deg,#7c3aed,#6366f1)" }}
        >
          {initial}
        </div>
        <span className="hidden sm:block text-sm font-medium text-gray-400 max-w-[90px] truncate">{user?.name}</span>
        <ChevronIcon />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute right-0 top-full mt-2 z-20 w-56 rounded-2xl overflow-hidden"
              style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 24px 64px rgba(0,0,0,0.8)" }}
            >
              <div className="px-4 py-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white shrink-0"
                    style={{ background: "linear-gradient(135deg,#7c3aed,#6366f1)" }}>
                    {initial}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{user?.name}</div>
                    <div className="text-xs text-gray-500 truncate mt-0.5">{user?.email}</div>
                  </div>
                </div>
              </div>
              <div className="p-1.5">
                <button
                  onClick={() => { setOpen(false); onLogout(); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
                >
                  <LogoutIcon />
                  Sign out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Icons ────────────────────────────────────────────────── */
const ic = (path, fill = false) => ({ path, fill });
function SvgIcon({ d, size = "h-3.5 w-3.5", strokeWidth = 2, fill = false }) {
  return (
    <svg className={size} fill={fill ? "currentColor" : "none"} viewBox="0 0 24 24" stroke={fill ? "none" : "currentColor"} strokeWidth={strokeWidth}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}
function ClockIcon() { return <SvgIcon d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />; }
function PlusIcon() { return <SvgIcon d="M12 4.5v15m7.5-7.5h-15" />; }
function ChevronIcon() { return <SvgIcon d="M19.5 8.25l-7.5 7.5-7.5-7.5" size="h-3 w-3 text-gray-600" strokeWidth={2.5} />; }
function LogoutIcon() { return <SvgIcon d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 005.25 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />; }

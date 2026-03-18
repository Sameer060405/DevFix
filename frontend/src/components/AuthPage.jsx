import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../contexts/AuthContext.jsx";

/* ── Terminal demo lines ──────────────────────────────────── */
const TERMINAL = [
  { delay: 0,    color: "#64748b", text: "$ devfix analyze --file app.jsx" },
  { delay: 800,  color: "#22c55e", text: "✓  TypeError at line 12 identified" },
  { delay: 1600, color: "#fbbf24", text: "→  Root cause: undefined.map()" },
  { delay: 2400, color: "#818cf8", text: "✦  Fix: add null-check before .map()" },
  { delay: 3200, color: "#22c55e", text: "✓  3 optimizations found" },
];

function TerminalLine({ delay, color, text }) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), delay); return () => clearTimeout(t); }, [delay]);
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={show ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="font-mono text-xs leading-relaxed"
      style={{ color: show ? color : "transparent" }}
    >
      {text}
    </motion.div>
  );
}

/* ── Feature cards ────────────────────────────────────────── */
const FEATURES = [
  { emoji: "🪲", title: "Error Diagnosis",  desc: "Root cause + ranked fixes in &lt;3s", accent: "rgba(239,68,68,0.15)",    border: "rgba(239,68,68,0.2)"    },
  { emoji: "📁", title: "Repo Scanner",     desc: "Scan any GitHub repo instantly",     accent: "rgba(99,102,241,0.15)",  border: "rgba(99,102,241,0.2)"   },
  { emoji: "💬", title: "AI Code Chat",     desc: "Ask anything about your code",       accent: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.18)"   },
  { emoji: "⌨️",  title: "In-browser IDE",  desc: "Monaco + AI assistant built-in",     accent: "rgba(139,92,246,0.15)",  border: "rgba(139,92,246,0.2)"   },
];

/* ══════════════════════════════════════════════════════════ */
export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode,     setMode]     = useState("login");
  const [form,     setForm]     = useState({ name: "", email: "", password: "" });
  const [error,    setError]    = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  function setField(f, v) { setForm((p) => ({ ...p, [f]: v })); setError(null); }
  function switchMode(m)  { setMode(m); setError(null); setForm({ name: "", email: "", password: "" }); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await login({ email: form.email, password: form.password });
      } else {
        if (!form.name.trim()) { setError("Name is required."); setLoading(false); return; }
        await register({ name: form.name, email: form.email, password: form.password });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex relative overflow-hidden" style={{ background: "#020617" }}>

      {/* ── Animated blobs ──────────────────────────────────── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-gray-950 to-black" />
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full bg-violet-900/20 blur-[120px] animate-blob" />
        <div className="absolute top-1/2 -right-32 w-[500px] h-[500px] rounded-full bg-indigo-900/15 blur-[100px] animate-blob delay-2000" />
        <div className="absolute -bottom-32 left-1/3 w-[400px] h-[400px] rounded-full bg-purple-900/15 blur-[80px] animate-blob delay-4000" />
        {/* Grid */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "linear-gradient(rgba(139,92,246,1) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,1) 1px,transparent 1px)", backgroundSize: "40px 40px" }} />
      </div>

      {/* ══ LEFT PANEL ══════════════════════════════════════ */}
      <div className="hidden lg:flex lg:w-[55%] flex-col relative z-10 px-12 py-12"
        style={{ borderRight: "1px solid rgba(255,255,255,0.04)" }}>

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3"
        >
          <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl text-white"
            style={{ background: "linear-gradient(135deg,#7c3aed,#6366f1)", boxShadow: "0 0 32px rgba(124,58,237,0.5)" }}>
            D
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-green-500"
              style={{ border: "2px solid #020617", boxShadow: "0 0 8px rgba(34,197,94,0.8)" }} />
          </div>
          <div>
            <div className="font-black text-2xl text-white tracking-tight">DevFix</div>
            <div className="text-xs font-semibold tracking-widest uppercase text-gray-600">AI Debug Platform</div>
          </div>
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-14"
        >
          <h1 className="text-[3.2rem] font-black leading-[1.08] tracking-tight text-white">
            Debug smarter.<br />
            <span style={{ background: "linear-gradient(135deg,#a78bfa 0%,#818cf8 40%,#c084fc 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Ship with confidence.
            </span>
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-gray-500 max-w-md">
            AI-powered error analysis that understands your code, finds root causes, and gives you ranked fixes — in under 3 seconds.
          </p>
        </motion.div>

        {/* Feature cards */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 grid grid-cols-2 gap-3"
        >
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.35 + i * 0.07 }}
              whileHover={{ y: -2, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}
              className="rounded-xl p-4 cursor-default"
              style={{ background: f.accent, border: `1px solid ${f.border}`, backdropFilter: "blur(8px)" }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-lg">{f.emoji}</span>
                <span className="text-sm font-bold text-white">{f.title}</span>
              </div>
              <p className="text-xs leading-relaxed text-gray-500" dangerouslySetInnerHTML={{ __html: f.desc }} />
            </motion.div>
          ))}
        </motion.div>

        {/* Terminal */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-8 rounded-xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-1.5 px-4 py-2.5" style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <span className="w-3 h-3 rounded-full bg-red-500/60" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <span className="w-3 h-3 rounded-full bg-green-500/60" />
            <span className="ml-4 text-xs font-mono text-gray-600">devfix — zsh</span>
            <span className="ml-auto w-2 h-2 rounded-full bg-green-500" style={{ boxShadow: "0 0 6px rgba(34,197,94,0.8)" }} />
          </div>
          <div className="px-5 py-4 flex flex-col gap-2 min-h-[105px]" style={{ background: "rgba(2,6,23,0.8)" }}>
            {TERMINAL.map((l) => <TerminalLine key={l.text} {...l} />)}
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mt-6 flex gap-8"
        >
          {[["< 3s", "Analysis time"], ["95%", "Fix accuracy"], ["10+", "Languages"]].map(([val, lab]) => (
            <div key={lab}>
              <div className="text-2xl font-black" style={{ background: "linear-gradient(135deg,#a78bfa,#818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{val}</div>
              <div className="text-xs text-gray-600 font-medium mt-0.5">{lab}</div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* ══ RIGHT PANEL (form) ══════════════════════════════ */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative z-10">

        {/* Mobile logo */}
        <motion.div
          initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          className="lg:hidden flex items-center gap-3 mb-10"
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg text-white"
            style={{ background: "linear-gradient(135deg,#7c3aed,#6366f1)", boxShadow: "0 0 20px rgba(124,58,237,0.4)" }}>D</div>
          <div>
            <div className="font-black text-lg text-white">DevFix</div>
            <div className="text-xs text-gray-600">AI Debugging Platform</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.34, 1.56, 0.64, 1] }}
          className="w-full max-w-sm"
        >
          {/* Tab switcher */}
          <div className="flex p-1 rounded-xl mb-5" style={{ background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {["login", "register"].map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className="relative flex-1 py-2.5 text-sm font-bold rounded-lg transition-colors z-0"
                style={{ color: mode === m ? "#fff" : "#475569" }}
              >
                {mode === m && (
                  <motion.span
                    layoutId="auth-tab"
                    className="absolute inset-0 rounded-lg -z-10"
                    style={{ background: "linear-gradient(135deg,#7c3aed,#6366f1)", boxShadow: "0 0 16px rgba(124,58,237,0.4)" }}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
                {m === "login" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          {/* Card */}
          <div
            className="rounded-2xl p-7"
            style={{
              background: "rgba(15,23,42,0.8)",
              border: "1px solid rgba(255,255,255,0.07)",
              backdropFilter: "blur(20px)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(139,92,246,0.06)",
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <h2 className="text-xl font-black text-white mb-1">
                  {mode === "login" ? "Welcome back" : "Get started free"}
                </h2>
                <p className="text-sm text-gray-500 mb-6">
                  {mode === "login" ? "Sign in to your DevFix account." : "Start debugging smarter today."}
                </p>
              </motion.div>
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <AnimatePresence>
                {mode === "register" && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
                    style={{ overflow: "hidden" }}
                  >
                    <AuthInput label="Full name" type="text" placeholder="Your name" value={form.name}
                      onChange={(e) => setField("name", e.target.value)} icon="👤" required />
                  </motion.div>
                )}
              </AnimatePresence>

              <AuthInput label="Email" type="email" placeholder="you@example.com" value={form.email}
                onChange={(e) => setField("email", e.target.value)} icon="✉" required />

              <div className="relative">
                <AuthInput
                  label="Password"
                  type={showPass ? "text" : "password"}
                  placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
                  value={form.password}
                  onChange={(e) => setField("password", e.target.value)}
                  icon="🔒"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 text-gray-600 hover:text-gray-400 transition-colors text-xs font-medium"
                  style={{ top: "calc(50% + 9px)", transform: "translateY(-50%)" }}
                >
                  {showPass ? "Hide" : "Show"}
                </button>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-xs font-medium overflow-hidden"
                    style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5" }}
                  >
                    <span className="shrink-0 mt-0.5">⚠</span>
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={!loading ? { scale: 1.01, y: -1 } : undefined}
                whileTap={!loading ? { scale: 0.98 } : undefined}
                className="relative w-full py-3.5 rounded-xl font-black text-sm text-white overflow-hidden flex items-center justify-center gap-2 mt-1"
                style={{
                  background: loading ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg,#7c3aed 0%,#6366f1 50%,#8b5cf6 100%)",
                  boxShadow: loading ? "none" : "0 0 24px rgba(124,58,237,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
                  border: "1px solid rgba(139,92,246,0.3)",
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {!loading && <span className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(180deg,rgba(255,255,255,0.1) 0%,transparent 60%)" }} />}
                {loading ? (
                  <>
                    <motion.div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                      animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />
                    {mode === "login" ? "Signing in…" : "Creating account…"}
                  </>
                ) : (
                  <>{mode === "login" ? "Sign in →" : "Create account →"}</>
                )}
              </motion.button>
            </form>

            <p className="mt-5 text-center text-sm text-gray-600">
              {mode === "login" ? "No account?" : "Already have one?"}{" "}
              <button
                onClick={() => switchMode(mode === "login" ? "register" : "login")}
                className="font-bold text-violet-400 hover:text-violet-300 transition-colors"
              >
                {mode === "login" ? "Sign up free" : "Sign in"}
              </button>
            </p>
          </div>

          <p className="mt-4 text-center text-xs text-gray-700">
            No payment required · Educational use only
          </p>
        </motion.div>
      </div>
    </div>
  );
}

/* ── Reusable input field ─────────────────────────────────── */
function AuthInput({ label, type, placeholder, value, onChange, icon, required }) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold text-gray-500">{label}</label>
      <div className="relative flex items-center transition-all duration-200"
        style={{ borderRadius: "0.75rem", boxShadow: focused ? "0 0 0 2px rgba(139,92,246,0.5), 0 0 20px rgba(139,92,246,0.1)" : "none" }}>
        {icon && <span className="absolute left-3.5 text-sm pointer-events-none" style={{ filter: "grayscale(0.3)" }}>{icon}</span>}
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          required={required}
          className="w-full text-sm rounded-xl outline-none transition-all"
          style={{
            background: "rgba(2,6,23,0.8)",
            border: `1px solid ${focused ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.07)"}`,
            color: "#f1f5f9",
            padding: `0.65rem 0.875rem 0.65rem ${icon ? "2.5rem" : "0.875rem"}`,
            fontFamily: "Inter, sans-serif",
            fontSize: "0.875rem",
          }}
        />
      </div>
    </div>
  );
}

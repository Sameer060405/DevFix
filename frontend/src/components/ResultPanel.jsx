import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

/* ── Typing animation hook ────────────────────────────────── */
function useTypewriter(text, speed = 12) {
  const [displayed, setDisplayed] = useState("");
  const prevRef = useRef(null);

  useEffect(() => {
    if (!text || text === prevRef.current) return;
    prevRef.current = text;
    let i = 0;
    setDisplayed("");
    const id = setInterval(() => {
      setDisplayed(text.slice(0, ++i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  return displayed;
}

/* ── Variants ─────────────────────────────────────────────── */
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};
const cardVariants = {
  hidden:  { opacity: 0, y: 20, scale: 0.98 },
  visible: { opacity: 1, y: 0,  scale: 1, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } },
};

/* ── Category meta ────────────────────────────────────────── */
const CATEGORY = {
  syntax:     { label: "Syntax Error",     bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)",   text: "#fca5a5", dot: "#ef4444" },
  runtime:    { label: "Runtime Error",    bg: "rgba(249,115,22,0.1)",  border: "rgba(249,115,22,0.25)",  text: "#fdba74", dot: "#f97316" },
  logic:      { label: "Logic Error",      bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.3)",   text: "#c4b5fd", dot: "#8b5cf6" },
  dependency: { label: "Dependency Error", bg: "rgba(14,165,233,0.1)",  border: "rgba(14,165,233,0.25)",  text: "#7dd3fc", dot: "#0ea5e9" },
};

/* ══════════════════════════════════════════════════════════ */
export default function ResultPanel({ result, loading, error }) {
  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} />;
  if (!result) return null;

  const cat = CATEGORY[result.errorCategory] ?? CATEGORY.runtime;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-4"
    >
      {/* ── Status header ───────────────────────────────────── */}
      <motion.div variants={cardVariants} className="flex items-center gap-3 flex-wrap px-1">
        <span className="relative flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-40" style={{ background: "#22c55e" }} />
          <span className="relative inline-flex rounded-full h-4 w-4 items-center justify-center" style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          </span>
        </span>
        <span className="font-bold text-sm text-white">Analysis Complete</span>

        {/* Category badge */}
        {result.errorCategory && (
          <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: cat.bg, border: `1px solid ${cat.border}`, color: cat.text }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: cat.dot }} />
            {cat.label}
          </span>
        )}

        {/* Similarity badge */}
        {result.similarCount > 0 && (
          <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)", color: "#c4b5fd" }}>
            ✦ Informed by {result.similarCount} past {result.similarCount === 1 ? "fix" : "fixes"}
          </span>
        )}

        <span className="ml-auto text-xs text-gray-600">Click any card to collapse</span>
      </motion.div>

      {/* ── Root Cause ──────────────────────────────────────── */}
      <motion.div variants={cardVariants}>
        <GlassCard
          accentColor="#fbbf24"
          icon={<WarningIcon />}
          title="Root Cause"
          defaultOpen
        >
          <RootCauseText text={result.rootCause} />
        </GlassCard>
      </motion.div>

      {/* ── Fix cards ───────────────────────────────────────── */}
      {result.fixes?.map((fix, idx) => (
        <motion.div key={idx} variants={cardVariants}>
          <FixCard fix={fix} index={idx} />
        </motion.div>
      ))}

      {/* ── Optimizations ───────────────────────────────────── */}
      {result.optimizations && (
        <motion.div variants={cardVariants}>
          <OptimizationsPanel opts={result.optimizations} />
        </motion.div>
      )}
    </motion.div>
  );
}

/* ── Root cause with typing effect ───────────────────────── */
function RootCauseText({ text }) {
  const displayed = useTypewriter(text, 10);
  const isDone = displayed.length >= (text?.length ?? 0);

  return (
    <p className="text-sm text-gray-300 leading-relaxed">
      {displayed}
      {!isDone && (
        <span className="inline-block w-0.5 h-4 bg-amber-400 ml-0.5 animate-cursor-blink" style={{ verticalAlign: "middle" }} />
      )}
    </p>
  );
}

/* ── Fix card ─────────────────────────────────────────────── */
const CONF_COLOR = (c) =>
  c >= 80 ? { bar: "#22c55e", text: "#86efac", bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.25)"  } :
  c >= 50 ? { bar: "#f59e0b", text: "#fcd34d", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.25)" } :
            { bar: "#ef4444", text: "#fca5a5", bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.25)"  };

function FixCard({ fix, index }) {
  const isTop = index === 0;
  const conf  = fix.confidence ?? 0;
  const cc    = CONF_COLOR(conf);

  return (
    <div className="flex flex-col gap-2">
      {/* Fix label row */}
      <div className="flex items-center gap-2 px-1 flex-wrap">
        <span
          className="text-[11px] font-black px-2.5 py-1 rounded-full"
          style={isTop
            ? { background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", color: "#86efac" }
            : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8" }}
        >
          {isTop ? "⭐ Best Fix" : `Alt Fix ${index + 1}`}
        </span>
        <span className="text-xs text-gray-400 truncate flex-1">{fix.title}</span>

        {/* Confidence */}
        <div className="flex items-center gap-2 ml-auto">
          <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: cc.bar }}
              initial={{ width: 0 }}
              animate={{ width: `${conf}%` }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 + index * 0.1 }}
            />
          </div>
          <span className="text-xs font-bold tabular-nums" style={{ color: cc.text }}>{conf}%</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: cc.bg, border: `1px solid ${cc.border}`, color: cc.text }}>
            {conf >= 80 ? "High" : conf >= 50 ? "Medium" : "Low"}
          </span>
        </div>
      </div>

      {/* Steps card */}
      <GlassCard icon={<ListIcon />} title="How to Fix" accentColor="#818cf8" defaultOpen={isTop}>
        <ol className="flex flex-col gap-3">
          {fix.steps.map((step, i) => (
            <li key={i} className="flex gap-3 items-start">
              <span
                className="flex-shrink-0 w-5 h-5 rounded-full text-[11px] font-black flex items-center justify-center mt-0.5"
                style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc" }}
              >
                {i + 1}
              </span>
              <p className="text-sm text-gray-300 leading-relaxed">{step}</p>
            </li>
          ))}
        </ol>
      </GlassCard>

      {/* Code card */}
      <GlassCard icon={<CodeIcon />} title="Corrected Code" accentColor="#34d399" defaultOpen={isTop} noPadding>
        <CodeBlock code={fix.improvedCode} />
      </GlassCard>
    </div>
  );
}

/* ── Optimizations panel ──────────────────────────────────── */
function OptimizationsPanel({ opts }) {
  const total = (opts.performance?.length ?? 0) + (opts.quality?.length ?? 0) + (opts.bestPractices?.length ?? 0);

  return (
    <GlassCard icon={<ZapIcon />} title={`Optimizations${total ? ` · ${total}` : ""}`} accentColor="#22d3ee" defaultOpen={false}>
      <div className="flex flex-col gap-6">
        {[
          { key: "performance",  label: "Performance",    icon: "⚡" },
          { key: "quality",      label: "Code Quality",   icon: "✦" },
          { key: "bestPractices",label: "Best Practices", icon: "🛡" },
        ].map(({ key, label, icon }) =>
          opts[key]?.length > 0 && (
            <section key={key}>
              <h4 className="text-xs font-black uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: "#67e8f9", letterSpacing: "0.09em" }}>
                <span>{icon}</span>{label}
              </h4>
              <ul className="flex flex-col gap-3">
                {opts[key].map((item, i) => {
                  const imp = { high: { bg: "rgba(34,197,94,0.1)", text: "#86efac", border: "rgba(34,197,94,0.2)" }, medium: { bg: "rgba(245,158,11,0.1)", text: "#fcd34d", border: "rgba(245,158,11,0.2)" }, low: { bg: "rgba(255,255,255,0.05)", text: "#94a3b8", border: "rgba(255,255,255,0.08)" } }[item.impact] ?? { bg: "rgba(255,255,255,0.05)", text: "#94a3b8", border: "rgba(255,255,255,0.08)" };
                  return (
                    <li key={i} className="flex gap-3 items-start">
                      <span className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 bg-cyan-500/50" />
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white">{item.title}</span>
                          {item.impact && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: imp.bg, color: imp.text, border: `1px solid ${imp.border}` }}>
                              {item.impact} impact
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed">{item.description}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )
        )}
        {opts.improvedCode && (
          <section>
            <h4 className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: "#67e8f9", letterSpacing: "0.09em" }}>
              Fully Optimized Code
            </h4>
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(34,211,238,0.2)" }}>
              <CodeBlock code={opts.improvedCode} accentColor="#22d3ee" />
            </div>
          </section>
        )}
      </div>
    </GlassCard>
  );
}

/* ── Glassmorphism collapsible card ───────────────────────── */
function GlassCard({ icon, title, accentColor, children, defaultOpen = true, noPadding = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
      }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 transition-all hover:brightness-110"
        style={{
          background: open
            ? `linear-gradient(90deg, ${accentColor}12 0%, transparent 60%)`
            : "rgba(255,255,255,0.01)",
          borderBottom: open ? `1px solid ${accentColor}20` : "1px solid transparent",
        }}
      >
        <div className="flex items-center gap-2.5 font-bold text-sm" style={{ color: accentColor }}>
          {icon}
          {title}
        </div>
        <motion.div animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.2 }}>
          <ChevronIcon style={{ color: accentColor }} />
        </motion.div>
      </button>

      {/* Body — animated height */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ overflow: "hidden" }}
          >
            <div className={noPadding ? "" : "px-5 py-4"}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Code block with copy button ──────────────────────────── */
function CodeBlock({ code, accentColor = "#34d399" }) {
  return (
    <div>
      {/* Chrome bar */}
      <div
        className="flex items-center gap-1.5 px-4 py-2.5"
        style={{ background: "rgba(255,255,255,0.03)", borderBottom: `1px solid ${accentColor}18` }}
      >
        <span className="w-3 h-3 rounded-full bg-red-500/50" />
        <span className="w-3 h-3 rounded-full bg-yellow-500/50" />
        <span className="w-3 h-3 rounded-full bg-green-500/50" />
        <span className="ml-3 text-xs font-mono text-gray-600">fixed.js</span>
        <div className="ml-auto">
          <CopyButton text={code} />
        </div>
      </div>
      <SyntaxHighlighter
        language="javascript"
        style={vscDarkPlus}
        showLineNumbers
        customStyle={{
          margin: 0, borderRadius: 0,
          background: "rgba(2,6,23,0.9)",
          fontSize: "0.8rem", lineHeight: "1.8", padding: "1.25rem",
        }}
        lineNumberStyle={{ color: "#1e293b", fontSize: "0.7rem", paddingRight: "1.25rem", userSelect: "none" }}
        wrapLongLines={false}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

/* ── Copy button ──────────────────────────────────────────── */
function CopyButton({ text }) {
  const [state, setState] = useState("idle");

  async function copy() {
    try { await navigator.clipboard.writeText(text); setState("copied"); }
    catch { setState("error"); }
    finally { setTimeout(() => setState("idle"), 2000); }
  }

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={copy}
      className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg transition-all"
      style={state === "copied"
        ? { background: "rgba(34,197,94,0.15)", color: "#86efac", border: "1px solid rgba(34,197,94,0.3)" }
        : state === "error"
          ? { background: "rgba(239,68,68,0.15)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.3)" }
          : { background: "rgba(255,255,255,0.05)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.08)" }
      }
    >
      <AnimatePresence mode="wait">
        <motion.span key={state} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.15 }}>
          {state === "copied" ? "✓ Copied!" : state === "error" ? "✗ Failed" : "Copy"}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

/* ── Shimmer loading state ────────────────────────────────── */
function LoadingState() {
  const skeletons = [
    { h: "h-24", lines: ["w-full", "w-4/5", "w-3/5"] },
    { h: "h-36", lines: ["w-full", "w-11/12", "w-4/5", "w-2/3"] },
    { h: "h-28", lines: ["w-full", "w-3/4", "w-1/2"] },
  ];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
      <div className="flex items-center gap-3 px-1">
        <motion.div
          className="w-4 h-4 rounded-full"
          style={{ background: "rgba(139,92,246,0.3)", border: "1px solid rgba(139,92,246,0.5)" }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <span className="text-sm font-semibold text-gray-500">Analyzing your code…</span>
        <span className="ml-auto text-xs text-gray-700">usually &lt; 3s</span>
      </div>
      {skeletons.map((sk, i) => (
        <div key={i} className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="h-11 px-5 flex items-center gap-2" style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="shimmer h-2.5 w-28 rounded-full" />
          </div>
          <div className={`p-5 flex flex-col gap-3 ${sk.h}`}>
            {sk.lines.map((w, j) => (
              <div key={j} className={`shimmer h-2 ${w} rounded-full`} style={{ animationDelay: `${j * 100}ms` }} />
            ))}
          </div>
        </div>
      ))}
      <p className="text-center text-xs text-gray-700">AI is reading your code…</p>
    </motion.div>
  );
}

/* ── Error state ──────────────────────────────────────────── */
function ErrorState({ message }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}
    >
      <div className="flex items-center gap-2.5 px-5 py-3.5" style={{ borderBottom: "1px solid rgba(239,68,68,0.15)", background: "rgba(239,68,68,0.08)" }}>
        <span className="text-red-400">⚠</span>
        <span className="text-red-400 font-bold text-sm">Request Failed</span>
      </div>
      <p className="px-5 py-4 text-sm text-red-300 leading-relaxed">{message}</p>
    </motion.div>
  );
}

/* ── Icons ────────────────────────────────────────────────── */
function WarningIcon() {
  return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>;
}
function ListIcon() {
  return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
  </svg>;
}
function CodeIcon() {
  return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
  </svg>;
}
function ZapIcon() {
  return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
  </svg>;
}
function ChevronIcon({ style }) {
  return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={style}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>;
}

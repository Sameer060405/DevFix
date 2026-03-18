import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const EXAMPLE = {
  errorMessage: `TypeError: Cannot read properties of undefined (reading 'map')
    at App (App.jsx:12:18)
    at renderWithHooks (react-dom.development.js:14985:18)`,
  codeSnippet: `function App() {
  const [data, setData] = useState();

  return (
    <ul>
      {data.map(item => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
}`,
};

function detectLang(code) {
  if (!code.trim()) return null;
  if (/import\s+React|useState|useEffect/.test(code)) return { label: "React/JSX",  ext: "jsx",  color: "#61dafb" };
  if (/def |print\(|import [a-z]/.test(code))         return { label: "Python",     ext: "py",   color: "#3b82f6" };
  if (/func |:=|package main/.test(code))              return { label: "Go",         ext: "go",   color: "#06b6d4" };
  if (/fn |let mut|println!/.test(code))               return { label: "Rust",       ext: "rs",   color: "#f97316" };
  if (/public class|System\.out/.test(code))           return { label: "Java",       ext: "java", color: "#f59e0b" };
  if (/console\.log|const |function /.test(code))      return { label: "JavaScript", ext: "js",   color: "#fbbf24" };
  return                                                       { label: "Code",       ext: "txt",  color: "#94a3b8" };
}

export default function ErrorForm({ onAnalyze, loading }) {
  const [errorMessage, setErrorMessage] = useState("");
  const [codeSnippet,  setCodeSnippet]  = useState("");
  const [draggingOn,   setDraggingOn]   = useState(null); // "error" | "code" | null
  const [focused,      setFocused]      = useState(null); // "error" | "code" | null
  const errorRef = useRef(null);

  const canSubmit = errorMessage.trim() && codeSnippet.trim() && !loading;
  const lang      = detectLang(codeSnippet);
  const errLines  = errorMessage ? errorMessage.split("\n").length : 0;
  const codeLines = codeSnippet  ? codeSnippet.split("\n").length  : 0;

  function handleSubmit(e) {
    e.preventDefault();
    if (canSubmit) onAnalyze({ errorMessage, codeSnippet });
  }

  function makeDrop(field) {
    return {
      onDragOver:  (e) => { e.preventDefault(); setDraggingOn(field); },
      onDragLeave: () => setDraggingOn(null),
      onDrop:      (e) => {
        e.preventDefault();
        setDraggingOn(null);
        const t = e.dataTransfer.getData("text/plain");
        if (t) (field === "error" ? setErrorMessage : setCodeSnippet)(t);
      },
    };
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="glass rounded-2xl overflow-hidden"
      style={{ boxShadow: "0 4px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset" }}
    >
      {/* ── Header bar ─────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-5 py-3.5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <span className="text-sm">🪲</span>
          </div>
          <span className="font-bold text-sm text-white">Debug a Problem</span>
        </div>
        <div className="flex items-center gap-2">
          <AnimatePresence>
            {(errorMessage || codeSnippet) && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => { setErrorMessage(""); setCodeSnippet(""); errorRef.current?.focus(); }}
                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
              >
                <TrashIcon />
                Clear
              </motion.button>
            )}
          </AnimatePresence>
          <button
            type="button"
            onClick={() => { setErrorMessage(EXAMPLE.errorMessage); setCodeSnippet(EXAMPLE.codeSnippet); }}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
            style={{ color: "#a78bfa", background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.2)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.2)"; e.currentTarget.style.borderColor = "rgba(139,92,246,0.4)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.12)"; e.currentTarget.style.borderColor = "rgba(139,92,246,0.2)"; }}
          >
            <SparkIcon />
            Load example
          </button>
        </div>
      </div>

      <div className="p-5 flex flex-col gap-5">

        {/* ── Error message field ─────────────────────────── */}
        <FieldWrapper
          label="Error Message"
          badge={{ text: "required", color: "rose" }}
          info={errLines > 0 ? `${errLines} lines` : "Full stack trace"}
          dragging={draggingOn === "error"}
          focused={focused === "error"}
          {...makeDrop("error")}
        >
          <textarea
            ref={errorRef}
            value={errorMessage}
            onChange={(e) => setErrorMessage(e.target.value)}
            onFocus={() => setFocused("error")}
            onBlur={() => setFocused(null)}
            rows={5}
            spellCheck={false}
            placeholder={"TypeError: Cannot read properties of undefined\n    at App (App.jsx:12)"}
            className="w-full font-mono text-sm resize-y leading-relaxed outline-none rounded-xl p-4 transition-all placeholder:text-gray-700"
            style={{
              background: "rgba(2,6,23,0.8)",
              border: focused === "error"
                ? "1px solid rgba(139,92,246,0.5)"
                : draggingOn === "error"
                  ? "1px dashed rgba(139,92,246,0.5)"
                  : "1px solid rgba(255,255,255,0.07)",
              color: "#fda4af",
              minHeight: 100,
              boxShadow: focused === "error"
                ? "0 0 0 3px rgba(139,92,246,0.15), 0 0 20px rgba(139,92,246,0.08)"
                : "none",
            }}
          />
        </FieldWrapper>

        {/* ── Code snippet field ──────────────────────────── */}
        <FieldWrapper
          label="Code Snippet"
          badge={{ text: "required", color: "emerald" }}
          info={codeLines > 0 ? `${codeLines} lines` : "Relevant code"}
          dragging={draggingOn === "code"}
          focused={focused === "code"}
          langBadge={lang}
          {...makeDrop("code")}
        >
          {/* Editor chrome */}
          <div
            className="rounded-t-xl px-4 py-2.5 flex items-center gap-1.5"
            style={{ background: "rgba(255,255,255,0.03)", borderTop: "1px solid rgba(255,255,255,0.07)", borderLeft: "1px solid rgba(255,255,255,0.07)", borderRight: "1px solid rgba(255,255,255,0.07)" }}
          >
            <span className="w-3 h-3 rounded-full bg-red-500/60" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <span className="w-3 h-3 rounded-full bg-green-500/60" />
            <span className="ml-3 text-xs font-mono" style={{ color: "#334155" }}>
              {lang ? `snippet.${lang.ext}` : "snippet"}
            </span>
            {codeLines > 0 && (
              <span className="ml-auto text-xs font-mono" style={{ color: "#1e293b" }}>{codeLines}L</span>
            )}
          </div>
          <textarea
            value={codeSnippet}
            onChange={(e) => setCodeSnippet(e.target.value)}
            onFocus={() => setFocused("code")}
            onBlur={() => setFocused(null)}
            rows={11}
            spellCheck={false}
            placeholder={"function myFunction() {\n  // paste your code here\n}"}
            className="w-full font-mono text-sm resize-y leading-relaxed outline-none rounded-b-xl p-4 transition-all placeholder:text-gray-700"
            style={{
              background: "rgba(2,6,23,0.8)",
              border: focused === "code"
                ? "1px solid rgba(139,92,246,0.5)"
                : draggingOn === "code"
                  ? "1px dashed rgba(139,92,246,0.5)"
                  : "1px solid rgba(255,255,255,0.07)",
              borderTop: "none",
              color: "#6ee7b7",
              minHeight: 160,
              boxShadow: focused === "code"
                ? "0 0 0 3px rgba(139,92,246,0.15), 0 0 20px rgba(139,92,246,0.08)"
                : "none",
            }}
          />
        </FieldWrapper>

        {/* Drag-drop hint */}
        {(draggingOn === "error" || draggingOn === "code") && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="absolute inset-0 pointer-events-none rounded-2xl"
            style={{ border: "2px dashed rgba(139,92,246,0.4)", background: "rgba(139,92,246,0.05)" }}
          />
        )}

        {/* ── Submit ─────────────────────────────────────────── */}
        <motion.button
          type="submit"
          disabled={!canSubmit}
          whileHover={canSubmit ? { scale: 1.01, y: -1 } : undefined}
          whileTap={canSubmit ? { scale: 0.98 } : undefined}
          className="relative w-full py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 overflow-hidden transition-all"
          style={canSubmit ? {
            background: "linear-gradient(135deg,#7c3aed 0%,#6366f1 50%,#8b5cf6 100%)",
            boxShadow: "0 0 24px rgba(124,58,237,0.4), 0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12)",
            color: "white",
            border: "1px solid rgba(139,92,246,0.4)",
          } : {
            background: "rgba(255,255,255,0.04)",
            color: "#334155",
            cursor: "not-allowed",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {/* Inner highlight */}
          {canSubmit && (
            <span className="absolute inset-0 pointer-events-none"
              style={{ background: "linear-gradient(180deg,rgba(255,255,255,0.1) 0%,transparent 60%)", borderRadius: "inherit" }} />
          )}
          {loading ? (
            <>
              <motion.div
                className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
              />
              <span>Analyzing with AI…</span>
              <span className="ml-auto text-xs font-normal opacity-50">usually &lt; 3s</span>
            </>
          ) : (
            <>
              <AnalyzeIcon />
              <span>Analyze &amp; Fix</span>
              {canSubmit && (
                <span className="ml-auto text-xs font-normal opacity-40 flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded text-[10px]" style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.15)" }}>⏎</kbd>
                  Submit
                </span>
              )}
            </>
          )}
        </motion.button>

        {/* Loading shimmer bar */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-0.5 rounded-full -mt-2 shimmer"
              style={{ transformOrigin: "left", background: "linear-gradient(90deg,#7c3aed,#6366f1,#7c3aed)" }}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.form>
  );
}

/* ── Field wrapper with drag-drop support ───────────────── */
function FieldWrapper({ label, badge, info, langBadge, dragging, focused, children, ...dropHandlers }) {
  const colors = { rose: { bg: "rgba(239,68,68,0.12)", text: "#fca5a5", border: "rgba(239,68,68,0.25)" },
                   emerald: { bg: "rgba(52,211,153,0.1)", text: "#6ee7b7", border: "rgba(52,211,153,0.2)" } };
  const c = colors[badge.color];
  return (
    <div className="flex flex-col gap-2" {...dropHandlers}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-black uppercase tracking-widest text-gray-300" style={{ letterSpacing: "0.09em" }}>
          {label}
        </span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
          {badge.text}
        </span>
        {langBadge && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1"
            style={{ background: "rgba(139,92,246,0.12)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.2)" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: langBadge.color }} />
            {langBadge.label}
          </span>
        )}
        {info && <span className="ml-auto text-[11px] text-gray-600 font-mono">{info}</span>}
      </div>
      <div className={`relative transition-all duration-200 ${dragging ? "scale-[1.01]" : ""}`}>
        {dragging && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl pointer-events-none"
            style={{ background: "rgba(139,92,246,0.12)", border: "2px dashed rgba(139,92,246,0.5)" }}>
            <div className="flex items-center gap-2 text-sm font-bold text-violet-400">
              <UploadIcon />
              Drop to paste
            </div>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/* ── Icons ───────────────────────────────────────────────── */
function SparkIcon() {
  return <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
  </svg>;
}
function TrashIcon() {
  return <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>;
}
function AnalyzeIcon() {
  return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
  </svg>;
}
function UploadIcon() {
  return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
  </svg>;
}

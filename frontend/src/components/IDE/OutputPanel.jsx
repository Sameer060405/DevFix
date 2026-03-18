import { useState } from "react";

const TABS = ["Output", "Problems", "Terminal"];

export default function OutputPanel({ result, loading, error, status, onClose, onClear, markerCount = 0 }) {
  const [tab, setTab] = useState("Output");

  const fixes     = result?.fixes ?? [];
  const category  = result?.errorCategory;
  const rootCause = result?.rootCause;

  return (
    <div className="h-48 shrink-0 border-t border-gray-800 bg-gray-950 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900 shrink-0">
        <div className="flex items-stretch">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`
                relative flex items-center gap-1.5 px-4 py-1.5 text-xs border-r border-gray-800 transition-colors
                ${
                  tab === t
                    ? "text-gray-200 bg-gray-950 after:absolute after:top-0 after:left-0 after:right-0 after:h-[2px] after:bg-indigo-500"
                    : "text-gray-600 hover:text-gray-400 hover:bg-gray-800/60"
                }
              `}
            >
              {t}
              {t === "Output" && markerCount > 0 && (
                <span className="text-[9px] bg-amber-600/80 text-white rounded-full px-1.5 py-0.5 font-medium">
                  {markerCount}
                </span>
              )}
              {t === "Problems" && fixes.length > 0 && (
                <span className="text-[9px] bg-red-600/80 text-white rounded-full px-1.5 py-0.5 font-medium">
                  {fixes.length}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 pr-2">
          {status === "success" && (
            <button
              onClick={onClear}
              className="text-[10px] text-gray-600 hover:text-gray-400 px-2 py-1 rounded transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-400 p-1.5 rounded transition-colors text-xs"
            title="Close panel"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 font-mono text-xs">
        {tab === "Output"   && <OutputTab loading={loading} error={error} status={status} rootCause={rootCause} category={category} />}
        {tab === "Problems" && <ProblemsTab loading={loading} fixes={fixes} />}
        {tab === "Terminal" && <TerminalTab />}
      </div>
    </div>
  );
}

/* ─── Output tab ─────────────────────────────────────────────── */

function OutputTab({ loading, error, status, rootCause, category }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <SpinnerIcon />
        <span>Analyzing code…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-400">
        <span className="text-red-600">[ERROR]</span> {error}
      </div>
    );
  }

  if (status === "idle" || !status) {
    return (
      <div className="flex flex-col gap-1 font-sans not-italic">
        <p className="text-gray-600 text-xs">Run analysis to see output here.</p>
        <p className="text-gray-700 text-xs">
          → Describe your error above and click{" "}
          <span className="text-indigo-400 font-medium">Analyze</span>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-emerald-400">
        <span className="text-emerald-600">[INFO]</span> Analysis complete
      </p>
      {category && (
        <p className="text-gray-400">
          <span className="text-gray-600">category:</span>{" "}
          <span className="text-yellow-300">{category}</span>
        </p>
      )}
      {rootCause && (
        <p className="text-gray-400 font-sans not-italic text-xs">
          <span className="font-mono text-gray-600">root-cause:</span>{" "}
          <span className="text-gray-200">{rootCause}</span>
        </p>
      )}
    </div>
  );
}

/* ─── Problems tab ───────────────────────────────────────────── */

function ProblemsTab({ loading, fixes }) {
  if (loading) {
    return <p className="text-gray-600 animate-pulse">Scanning…</p>;
  }

  if (!fixes || fixes.length === 0) {
    return (
      <p className="text-gray-700 font-sans not-italic text-xs">
        No problems detected. Run analysis first.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {fixes.map((fix, i) => (
        <div key={i} className="flex items-start gap-2">
          <span
            className={`shrink-0 mt-0.5 ${
              fix.confidence >= 80
                ? "text-green-400"
                : fix.confidence >= 50
                ? "text-yellow-400"
                : "text-red-400"
            }`}
          >
            {fix.confidence >= 80 ? "✓" : "⚠"}
          </span>
          <div className="min-w-0">
            <span className="text-gray-300 font-sans not-italic">{fix.title}</span>
            <span className="ml-2 text-gray-600">({fix.confidence}% confidence)</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Terminal tab ───────────────────────────────────────────── */

function TerminalTab() {
  return (
    <div className="flex flex-col gap-1 text-gray-600">
      <div>
        <span className="text-emerald-600">devfix@ide</span>
        <span className="text-gray-600">:</span>
        <span className="text-blue-400">~</span>
        <span className="text-gray-600">$ </span>
        <span className="text-gray-500">Terminal is not available in the browser IDE.</span>
      </div>
      <div className="text-gray-700 font-sans not-italic text-xs mt-1">
        Use the AI chat panel to ask questions about your code instead.
      </div>
    </div>
  );
}

/* ─── Icons ──────────────────────────────────────────────────── */

function SpinnerIcon() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

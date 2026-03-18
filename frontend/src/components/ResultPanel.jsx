import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

/* ─── Main panel ─────────────────────────────────────────────── */

const CATEGORY_META = {
  syntax:     { label: "Syntax Error",     bg: "bg-rose-950/40",   border: "border-rose-700/60",   text: "text-rose-400"   },
  runtime:    { label: "Runtime Error",    bg: "bg-orange-950/40", border: "border-orange-700/60", text: "text-orange-400" },
  logic:      { label: "Logic Error",      bg: "bg-violet-950/40", border: "border-violet-700/60", text: "text-violet-400" },
  dependency: { label: "Dependency Error", bg: "bg-sky-950/40",    border: "border-sky-700/60",    text: "text-sky-400"    },
};

export default function ResultPanel({ result, loading, error }) {
  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} />;
  if (!result) return null;

  const catMeta = CATEGORY_META[result.errorCategory] ?? CATEGORY_META.runtime;

  return (
    <div className="flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-center gap-2 px-1 flex-wrap">
        <div className="w-2 h-2 rounded-full bg-emerald-400" />
        <h2 className="font-semibold text-sm text-gray-200">Analysis Complete</h2>

        {/* Error category badge */}
        {result.errorCategory && (
          <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${catMeta.bg} ${catMeta.border} ${catMeta.text}`}>
            {catMeta.label}
          </span>
        )}

        {result.similarCount > 0 && (
          <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-700 text-indigo-400">
            <SparkleIcon />
            Informed by {result.similarCount} similar past {result.similarCount === 1 ? "fix" : "fixes"}
          </span>
        )}

        <span className="ml-auto text-xs text-gray-600">
          Click any header to collapse
        </span>
      </div>

      {/* Root Cause */}
      <Card
        icon={<TriangleIcon />}
        title="Root Cause"
        accent="amber"
        defaultOpen
      >
        <p className="text-sm text-gray-300 leading-relaxed">{result.rootCause}</p>
      </Card>

      {/* Multiple fixes */}
      {result.fixes?.map((fix, idx) => (
        <FixCard key={idx} fix={fix} index={idx} />
      ))}

      {/* Optimizations */}
      {result.optimizations && <OptimizationsPanel opts={result.optimizations} />}
    </div>
  );
}

/* ─── Fix card (steps + code, with confidence bar) ──────────── */

function FixCard({ fix, index }) {
  const isTop = index === 0;
  const conf  = fix.confidence ?? 0;

  // Colour the confidence bar
  const barColor =
    conf >= 80 ? "bg-emerald-500" :
    conf >= 50 ? "bg-yellow-500"  :
                 "bg-red-500";

  return (
    <div className="flex flex-col gap-2">
      {/* Fix label + confidence */}
      <div className="flex items-center gap-2 px-1">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
          isTop
            ? "bg-emerald-950/40 border-emerald-700/60 text-emerald-400"
            : "bg-gray-900 border-gray-700 text-gray-400"
        }`}>
          {isTop ? "Best Fix" : `Alt Fix ${index + 1}`}
        </span>
        <span className="text-xs text-gray-400 truncate">{fix.title}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-20 h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${conf}%` }} />
          </div>
          <span className="text-[11px] text-gray-500 tabular-nums">{conf}%</span>
        </div>
      </div>

      {/* Steps */}
      <Card
        icon={<ListIcon />}
        title="How to Fix It"
        accent="indigo"
        defaultOpen={isTop}
      >
        <ol className="flex flex-col gap-3">
          {fix.steps.map((step, i) => (
            <li key={i} className="flex gap-3 items-start">
              <span className="
                flex-shrink-0 mt-0.5 w-5 h-5 rounded-full text-[11px] font-bold
                bg-indigo-950 border border-indigo-700 text-indigo-400
                flex items-center justify-center
              ">
                {i + 1}
              </span>
              <p className="text-sm text-gray-300 leading-relaxed">{step}</p>
            </li>
          ))}
        </ol>
      </Card>

      {/* Corrected code */}
      <Card
        icon={<CodeBracketsIcon />}
        title="Corrected Code"
        accent="emerald"
        defaultOpen={isTop}
        noPadding
      >
        <CodeBlock code={fix.improvedCode} />
      </Card>
    </div>
  );
}

/* ─── Optimizations panel ───────────────────────────────────── */

const IMPACT_META = {
  high:   { label: "High impact",   bg: "bg-emerald-950/50", border: "border-emerald-700/60", text: "text-emerald-400" },
  medium: { label: "Medium impact", bg: "bg-yellow-950/50",  border: "border-yellow-700/60",  text: "text-yellow-400"  },
  low:    { label: "Low impact",    bg: "bg-gray-900",       border: "border-gray-700",        text: "text-gray-400"   },
};

function SuggestionList({ items, showImpact = false }) {
  if (!items?.length) return <p className="text-xs text-gray-600 italic">None identified.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item, i) => {
        const imp = showImpact ? (IMPACT_META[item.impact] ?? IMPACT_META.low) : null;
        return (
          <li key={i} className="flex gap-3 items-start">
            <span className="flex-shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-current opacity-50" />
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-200">{item.title}</span>
                {imp && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${imp.bg} ${imp.border} ${imp.text}`}>
                    {imp.label}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">{item.description}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function OptimizationsPanel({ opts }) {
  const totalCount =
    (opts.performance?.length ?? 0) +
    (opts.quality?.length ?? 0) +
    (opts.bestPractices?.length ?? 0);

  return (
    <Card
      icon={<ZapIcon />}
      title={`Optimizations${totalCount ? ` · ${totalCount}` : ""}`}
      accent="teal"
      defaultOpen={false}
    >
      <div className="flex flex-col gap-5">
        {/* Performance */}
        <section>
          <h4 className="flex items-center gap-1.5 text-xs font-semibold text-teal-400 uppercase tracking-wider mb-3">
            <ZapIcon size="sm" /> Performance
          </h4>
          <SuggestionList items={opts.performance} showImpact />
        </section>

        {/* Code Quality */}
        <section>
          <h4 className="flex items-center gap-1.5 text-xs font-semibold text-teal-400 uppercase tracking-wider mb-3">
            <StarIcon /> Code Quality
          </h4>
          <SuggestionList items={opts.quality} />
        </section>

        {/* Best Practices */}
        <section>
          <h4 className="flex items-center gap-1.5 text-xs font-semibold text-teal-400 uppercase tracking-wider mb-3">
            <ShieldIcon /> Best Practices
          </h4>
          <SuggestionList items={opts.bestPractices} />
        </section>

        {/* Optimized code */}
        {opts.improvedCode && (
          <section>
            <h4 className="text-xs font-semibold text-teal-400 uppercase tracking-wider mb-2">
              Fully Optimized Code
            </h4>
            <div className="rounded-xl overflow-hidden border border-teal-800/60">
              <div className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-900 border-b border-teal-800/60">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                <span className="ml-3 text-xs text-gray-600 font-mono">optimized.js</span>
                <div className="ml-auto"><CopyButton text={opts.improvedCode} /></div>
              </div>
              <CodeBlock code={opts.improvedCode} />
            </div>
          </section>
        )}
      </div>
    </Card>
  );
}

/* ─── Collapsible card ───────────────────────────────────────── */

function Card({ icon, title, accent, children, defaultOpen = true, noPadding = false }) {
  const [open, setOpen] = useState(defaultOpen);

  const accents = {
    amber:   { border: "border-amber-800/60",  bg: "bg-amber-950/30",  text: "text-amber-400",  hdr: "bg-amber-950/50"  },
    indigo:  { border: "border-indigo-800/60", bg: "bg-indigo-950/30", text: "text-indigo-400", hdr: "bg-indigo-950/50" },
    emerald: { border: "border-emerald-800/60",bg: "bg-emerald-950/30",text: "text-emerald-400",hdr: "bg-emerald-950/50"},
    teal:    { border: "border-teal-800/60",   bg: "bg-teal-950/30",   text: "text-teal-400",   hdr: "bg-teal-950/50"  },
  };
  const a = accents[accent] ?? accents.indigo;

  return (
    <div className={`rounded-2xl border ${a.border} ${a.bg} overflow-hidden`}>
      {/* Clickable header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`
          w-full flex items-center justify-between px-5 py-3
          border-b ${open ? a.border : "border-transparent"}
          ${a.hdr} hover:brightness-110 transition-all
        `}
      >
        <div className={`flex items-center gap-2 ${a.text} font-semibold text-sm`}>
          {icon}
          {title}
        </div>
        <ChevronIcon open={open} className={a.text} />
      </button>

      {/* Collapsible body — grid trick for smooth animation */}
      <div className={`grid transition-all duration-300 ease-in-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className={noPadding ? "" : "px-5 py-4"}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Syntax-highlighted code block ─────────────────────────── */

function CodeBlock({ code }) {
  return (
    <div>
      {/* Fake window chrome + copy button */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-900 border-b border-emerald-800/60">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
        <span className="ml-3 text-xs text-gray-600 font-mono">fixed.js</span>
        <div className="ml-auto">
          <CopyButton text={code} />
        </div>
      </div>

      {/* Highlighted code */}
      <SyntaxHighlighter
        language="javascript"
        style={vscDarkPlus}
        showLineNumbers
        customStyle={{
          margin: 0,
          borderRadius: 0,
          background: "transparent",
          fontSize: "0.8125rem",
          lineHeight: "1.75",
          padding: "1.25rem",
        }}
        lineNumberStyle={{
          color: "#374151",
          fontSize: "0.7rem",
          paddingRight: "1.25rem",
          userSelect: "none",
        }}
        wrapLongLines={false}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

/* ─── Copy button ────────────────────────────────────────────── */

function CopyButton({ text }) {
  const [state, setState] = useState("idle");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("error");
    } finally {
      setTimeout(() => setState("idle"), 2000);
    }
  }

  const styles = {
    idle:   "bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200",
    copied: "bg-emerald-900/80 text-emerald-300",
    error:  "bg-red-900/80 text-red-300",
  };

  return (
    <button
      onClick={handleCopy}
      title="Copy code"
      className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${styles[state]}`}
    >
      {state === "copied" ? <CheckIcon /> : <ClipboardIcon />}
      {state === "idle" ? "Copy" : state === "copied" ? "Copied!" : "Failed"}
    </button>
  );
}

/* ─── Skeleton loader ────────────────────────────────────────── */

function LoadingState() {
  const heights = ["h-24", "h-36", "h-48"];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
        <span className="font-semibold text-sm text-gray-500">Analyzing…</span>
      </div>

      {heights.map((h, i) => (
        <div key={i} className="rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden animate-pulse">
          <div className="h-10 bg-gray-800 border-b border-gray-700" />
          <div className={`p-5 flex flex-col gap-3 ${h}`}>
            <div className="h-2.5 bg-gray-800 rounded-full w-full" />
            <div className="h-2.5 bg-gray-800 rounded-full w-4/5" />
            <div className="h-2.5 bg-gray-800 rounded-full w-3/5" />
          </div>
        </div>
      ))}

      <p className="text-center text-xs text-gray-700 pt-1">
        Gemini is reading your code…
      </p>
    </div>
  );
}

/* ─── Error state ────────────────────────────────────────────── */

function ErrorState({ message }) {
  return (
    <div className="rounded-2xl border border-red-800/60 bg-red-950/20 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-red-800/60 bg-red-950/40">
        <AlertIcon />
        <span className="text-red-400 font-semibold text-sm">Request Failed</span>
      </div>
      <p className="px-5 py-4 text-sm text-red-300 leading-relaxed">{message}</p>
    </div>
  );
}

/* ─── Icons ──────────────────────────────────────────────────── */

function ChevronIcon({ open, className }) {
  return (
    <svg
      className={`h-4 w-4 transition-transform duration-300 ${open ? "rotate-0" : "-rotate-90"} ${className}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function TriangleIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0
           2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z
           M12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375
           0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375
           0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375
           0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  );
}

function CodeBracketsIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638
           m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0
           01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11
           1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0
           01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057
           1.907-2.185a48.208 48.208 0 011.927-.184" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0
           003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0
           00-3.09 3.09z" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  );
}

function ZapIcon({ size }) {
  const cls = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

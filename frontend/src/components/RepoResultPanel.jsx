import { useState } from "react";

/* ─── Severity / priority / category metadata ───────────────── */

const SEVERITY_META = {
  high:   { label: "High",   bg: "bg-red-950/50",    border: "border-red-700/60",    text: "text-red-400"    },
  medium: { label: "Medium", bg: "bg-yellow-950/50", border: "border-yellow-700/60", text: "text-yellow-400" },
  low:    { label: "Low",    bg: "bg-gray-900",       border: "border-gray-700",      text: "text-gray-400"   },
};

const CATEGORY_META = {
  performance:     { label: "Performance",     text: "text-teal-400",   bg: "bg-teal-950/40",    border: "border-teal-700/60"    },
  security:        { label: "Security",        text: "text-red-400",    bg: "bg-red-950/40",     border: "border-red-700/60"     },
  maintainability: { label: "Maintainability", text: "text-indigo-400", bg: "bg-indigo-950/40",  border: "border-indigo-700/60"  },
  testing:         { label: "Testing",         text: "text-violet-400", bg: "bg-violet-950/40",  border: "border-violet-700/60"  },
  documentation:   { label: "Docs",            text: "text-sky-400",    bg: "bg-sky-950/40",     border: "border-sky-700/60"     },
  duplication:     { label: "Duplication",     text: "text-orange-400", bg: "bg-orange-950/40",  border: "border-orange-700/60"  },
  complexity:      { label: "Complexity",      text: "text-amber-400",  bg: "bg-amber-950/40",   border: "border-amber-700/60"   },
  naming:          { label: "Naming",          text: "text-gray-400",   bg: "bg-gray-900",       border: "border-gray-700"       },
  coupling:        { label: "Coupling",        text: "text-pink-400",   bg: "bg-pink-950/40",    border: "border-pink-700/60"    },
  "dead-code":     { label: "Dead Code",       text: "text-gray-500",   bg: "bg-gray-900",       border: "border-gray-700"       },
  other:           { label: "Other",           text: "text-gray-400",   bg: "bg-gray-900",       border: "border-gray-700"       },
};

/* ─── Shared badge ───────────────────────────────────────────── */

function Badge({ meta }) {
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0 ${meta.bg} ${meta.border} ${meta.text}`}>
      {meta.label}
    </span>
  );
}

/* ─── Main panel ─────────────────────────────────────────────── */

export default function RepoResultPanel({ result, loading, error }) {
  if (loading) return <RepoLoadingState />;
  if (error)   return <ErrorState message={error} />;
  if (!result) return null;

  const { repoMeta, filesAnalyzed, summary, bugs, codeSmells, improvements } = result;

  const highBugs   = bugs.filter((b) => b.severity === "high").length;
  const highImprov = improvements.filter((i) => i.priority === "high").length;

  return (
    <div className="flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-center gap-2 px-1 flex-wrap">
        <div className="w-2 h-2 rounded-full bg-emerald-400" />
        <h2 className="font-semibold text-sm text-gray-200">Repo Analysis Complete</h2>

        <a
          href={repoMeta.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] px-2 py-0.5 rounded-full bg-gray-900 border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors flex items-center gap-1"
        >
          <GithubIcon />
          {repoMeta.owner}/{repoMeta.repo}
        </a>

        {highBugs > 0 && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-950/40 border border-red-700/60 text-red-400 font-medium">
            {highBugs} high-severity {highBugs === 1 ? "bug" : "bugs"}
          </span>
        )}

        <span className="ml-auto text-xs text-gray-600">
          {filesAnalyzed} files reviewed · Click any header to collapse
        </span>
      </div>

      {/* Summary */}
      <Card icon={<BookIcon />} title="Project Summary" accent="indigo" defaultOpen>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-300 leading-relaxed">{summary.description}</p>

          {summary.architecture && (
            <p className="text-sm text-gray-400 leading-relaxed italic border-l-2 border-indigo-800 pl-3">
              {summary.architecture}
            </p>
          )}

          {/* Tech stack */}
          {summary.techStack?.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tech Stack</span>
              <div className="flex flex-wrap gap-1.5">
                {summary.techStack.map((tech, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-md bg-indigo-950/60 border border-indigo-800/60 text-indigo-300">
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Strengths */}
          {summary.strengths?.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Strengths</span>
              <ul className="flex flex-col gap-1.5">
                {summary.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <CheckIcon />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>

      {/* Bugs */}
      <Card
        icon={<BugIcon />}
        title={`Potential Bugs${bugs.length ? ` · ${bugs.length}` : ""}`}
        accent="red"
        defaultOpen={bugs.length > 0}
      >
        {bugs.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No bugs identified from the reviewed files.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {bugs.map((bug, i) => {
              const sev = SEVERITY_META[bug.severity] ?? SEVERITY_META.low;
              return (
                <div key={i} className={`rounded-xl border p-4 flex flex-col gap-2 ${sev.bg} ${sev.border}`}>
                  <div className="flex items-start gap-2 flex-wrap">
                    <Badge meta={sev} />
                    <span className="text-sm font-medium text-gray-200">{bug.title}</span>
                    {bug.file && (
                      <span className="ml-auto text-[10px] font-mono text-gray-500 shrink-0">{bug.file}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{bug.description}</p>
                  {bug.suggestion && (
                    <p className="text-xs text-gray-300 leading-relaxed border-l-2 border-current pl-2 opacity-80">
                      Fix: {bug.suggestion}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Code smells */}
      <Card
        icon={<NoseIcon />}
        title={`Code Smells${codeSmells.length ? ` · ${codeSmells.length}` : ""}`}
        accent="amber"
        defaultOpen={false}
      >
        {codeSmells.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No code smells identified.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {codeSmells.map((smell, i) => {
              const cat = CATEGORY_META[smell.category] ?? CATEGORY_META.other;
              return (
                <div key={i} className="rounded-xl border border-gray-700/60 bg-gray-900/60 p-4 flex flex-col gap-2">
                  <div className="flex items-start gap-2 flex-wrap">
                    <Badge meta={cat} />
                    <span className="text-sm font-medium text-gray-200">{smell.title}</span>
                    {smell.file && (
                      <span className="ml-auto text-[10px] font-mono text-gray-500 shrink-0">{smell.file}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{smell.description}</p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Improvements */}
      <Card
        icon={<LightbulbIcon />}
        title={`Improvements${improvements.length ? ` · ${improvements.length}` : ""}${highImprov ? ` · ${highImprov} high-priority` : ""}`}
        accent="teal"
        defaultOpen={false}
      >
        {improvements.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No improvements identified.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {improvements.map((imp, i) => {
              const cat = CATEGORY_META[imp.category] ?? CATEGORY_META.other;
              const pri = SEVERITY_META[imp.priority]  ?? SEVERITY_META.low;
              return (
                <div key={i} className="rounded-xl border border-gray-700/60 bg-gray-900/60 p-4 flex flex-col gap-2">
                  <div className="flex items-start gap-2 flex-wrap">
                    <Badge meta={cat} />
                    <Badge meta={pri} />
                    <span className="text-sm font-medium text-gray-200">{imp.title}</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{imp.description}</p>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ─── Collapsible card ───────────────────────────────────────── */

function Card({ icon, title, accent, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);

  const accents = {
    indigo: { border: "border-indigo-800/60", bg: "bg-indigo-950/30", text: "text-indigo-400", hdr: "bg-indigo-950/50" },
    red:    { border: "border-red-800/60",    bg: "bg-red-950/30",    text: "text-red-400",    hdr: "bg-red-950/50"    },
    amber:  { border: "border-amber-800/60",  bg: "bg-amber-950/30",  text: "text-amber-400",  hdr: "bg-amber-950/50"  },
    teal:   { border: "border-teal-800/60",   bg: "bg-teal-950/30",   text: "text-teal-400",   hdr: "bg-teal-950/50"   },
  };
  const a = accents[accent] ?? accents.indigo;

  return (
    <div className={`rounded-2xl border ${a.border} ${a.bg} overflow-hidden`}>
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
      <div className={`grid transition-all duration-300 ease-in-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="px-5 py-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* ─── Loading skeleton ───────────────────────────────────────── */

function RepoLoadingState() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
        <span className="font-semibold text-sm text-gray-500">Fetching &amp; analyzing repo…</span>
      </div>
      {["h-32", "h-48", "h-36", "h-40"].map((h, i) => (
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
        Fetching files from GitHub, then running AI review…
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
        <span className="text-red-400 font-semibold text-sm">Analysis Failed</span>
      </div>
      <p className="px-5 py-4 text-sm text-red-300 leading-relaxed">{message}</p>
    </div>
  );
}

/* ─── Icons ──────────────────────────────────────────────────── */

function ChevronIcon({ open, className }) {
  return (
    <svg className={`h-4 w-4 transition-transform duration-300 ${open ? "rotate-0" : "-rotate-90"} ${className}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57
               0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41
               -1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815
               2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925
               0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96
               -.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24
               2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375
               .81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02
               0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0
           016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18
           3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function BugIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 12c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm0 0v8m-4-4H4m16 0h-4
           M5.5 7.5L3 5m15.5 2.5L21 5M5.5 16.5L3 19m15.5-2.5L21 19" />
    </svg>
  );
}

function NoseIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05
           -.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8
           15m-6.8-12a24.301 24.301 0 00-4.5 0m13.5 9.2a9 9 0 10-18 0" />
    </svg>
  );
}

function LightbulbIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75
           .394a12.01 12.01 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0
           -.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
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

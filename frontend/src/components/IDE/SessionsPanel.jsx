import { useState, useEffect, useRef } from "react";
import { useSessions } from "../../hooks/useSessions.js";

/* ─── Helpers ────────────────────────────────────────────────── */

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function groupByDate(sessions) {
  const now       = Date.now();
  const DAY       = 86_400_000;
  const startOfToday     = new Date().setHours(0, 0, 0, 0);
  const startOfYesterday = startOfToday - DAY;
  const startOfWeek      = startOfToday - 6 * DAY;

  const groups = { Today: [], Yesterday: [], "This week": [], Older: [] };

  for (const s of sessions) {
    const t = new Date(s.createdAt).getTime();
    if      (t >= startOfToday)     groups.Today.push(s);
    else if (t >= startOfYesterday) groups.Yesterday.push(s);
    else if (t >= startOfWeek)      groups["This week"].push(s);
    else                            groups.Older.push(s);
  }
  return groups;
}

const CATEGORY_STYLE = {
  syntax:     "bg-red-900/50 text-red-300 border-red-800/60",
  runtime:    "bg-orange-900/50 text-orange-300 border-orange-800/60",
  logic:      "bg-yellow-900/50 text-yellow-300 border-yellow-800/60",
  dependency: "bg-purple-900/50 text-purple-300 border-purple-800/60",
};

const LANG_COLOR = {
  javascript: "text-yellow-400", typescript: "text-blue-400",
  python: "text-green-400",      css: "text-blue-500",
  html: "text-orange-400",       json: "text-yellow-300",
  rust: "text-orange-500",       go: "text-cyan-400",
};

/* ─── Main panel ─────────────────────────────────────────────── */

/**
 * Slide-in sessions drawer, positioned absolute over the IDE.
 *
 * Props:
 *   onClose()
 *   onRestore({ fileName, language, codeSnapshot, analysisResult, errorMessage })
 */
export default function SessionsPanel({ onClose, onRestore }) {
  const { sessions, total, page, pages, loading, saving, error, load, save, remove, fetchOne } =
    useSessions();

  const [query,       setQuery]       = useState("");
  const [restoringId, setRestoringId] = useState(null);
  const [deletingId,  setDeletingId]  = useState(null);
  const [toast,       setToast]       = useState(null); // { type: "ok"|"err", msg }
  const panelRef = useRef(null);

  // Load on mount
  useEffect(() => { load(1); }, [load]);

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Client-side filter
  const filtered = sessions.filter((s) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      s.title?.toLowerCase().includes(q) ||
      s.fileName?.toLowerCase().includes(q) ||
      s.analysisResult?.errorCategory?.includes(q)
    );
  });

  const groups = groupByDate(filtered);

  async function handleRestore(id) {
    setRestoringId(id);
    try {
      const full = await fetchOne(id);
      onRestore(full);
      onClose();
    } catch (err) {
      setToast({ type: "err", msg: err.message });
    } finally {
      setRestoringId(null);
    }
  }

  async function handleDelete(id) {
    setDeletingId(id);
    try {
      await remove(id);
      setToast({ type: "ok", msg: "Session deleted." });
    } catch (err) {
      setToast({ type: "err", msg: err.message });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 z-20 bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="absolute right-0 top-0 bottom-0 z-30 w-[400px] flex flex-col bg-[#1e1e1e] border-l border-white/[0.08] shadow-2xl"
      >
        {/* ── Header ──────────────────────────────────────── */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.07] bg-[#252526]">
          <div className="flex items-center gap-2">
            <BookmarkIcon />
            <span className="text-[13px] font-semibold text-gray-200">Saved Sessions</span>
            {total > 0 && (
              <span className="text-[10px] bg-indigo-700/40 text-indigo-300 px-1.5 py-0.5 rounded-full">
                {total}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-300 p-1 rounded hover:bg-white/[0.06] transition-colors"
          >
            <XIcon />
          </button>
        </div>

        {/* ── Search ──────────────────────────────────────── */}
        <div className="shrink-0 px-3 py-2 border-b border-white/[0.07]">
          <div className="flex items-center gap-2 bg-[#2d2d2d] border border-white/[0.08] rounded-lg px-3 py-1.5">
            <SearchIcon />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter sessions…"
              className="flex-1 bg-transparent text-[12px] text-gray-200 placeholder-gray-600 focus:outline-none"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-gray-600 hover:text-gray-400 transition-colors">
                <XIcon small />
              </button>
            )}
          </div>
        </div>

        {/* ── Toast ───────────────────────────────────────── */}
        {toast && (
          <div className={`shrink-0 mx-3 mt-2 px-3 py-2 rounded-md text-[11px] border ${
            toast.type === "ok"
              ? "bg-emerald-950/40 border-emerald-800/50 text-emerald-300"
              : "bg-red-950/40 border-red-800/50 text-red-300"
          }`}>
            {toast.msg}
          </div>
        )}

        {/* ── Session list ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto py-2">

          {loading && (
            <div className="flex flex-col gap-2 p-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-lg bg-[#252526] animate-pulse" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="mx-3 mt-3 px-3 py-2 rounded-md bg-red-950/40 border border-red-800/50 text-[11px] text-red-300">
              {error}
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <EmptyState hasQuery={!!query.trim()} />
          )}

          {!loading && Object.entries(groups).map(([label, group]) => {
            if (!group.length) return null;
            return (
              <div key={label}>
                <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                  {label}
                </p>
                {group.map((s) => (
                  <SessionCard
                    key={s._id}
                    session={s}
                    restoring={restoringId === s._id}
                    deleting={deletingId === s._id}
                    onRestore={() => handleRestore(s._id)}
                    onDelete={() => handleDelete(s._id)}
                  />
                ))}
              </div>
            );
          })}

          {/* Load more */}
          {!loading && pages > page && (
            <div className="px-3 py-3">
              <button
                onClick={() => load(page + 1)}
                className="w-full py-2 text-[11px] text-gray-500 hover:text-gray-300 rounded-lg border border-white/[0.06] hover:bg-white/[0.04] transition-colors"
              >
                Load more ({total - sessions.length} remaining)
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Session card ───────────────────────────────────────────── */

function SessionCard({ session, restoring, deleting, onRestore, onDelete }) {
  const s        = session;
  const cat      = s.analysisResult?.errorCategory;
  const fixes    = s.analysisResult?.fixes ?? [];
  const langColor = LANG_COLOR[s.language] ?? "text-gray-500";

  return (
    <div className="mx-3 mb-1.5 rounded-lg border border-white/[0.06] bg-[#252526]/60 hover:bg-[#252526] hover:border-white/[0.10] transition-all group">
      {/* Main row */}
      <div className="px-3 py-2.5">
        {/* Title */}
        <p className="text-[12px] font-medium text-gray-200 truncate mb-1.5" title={s.title}>
          {s.title}
        </p>

        {/* Meta badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {s.fileName && (
            <span className={`text-[10px] font-mono ${langColor}`}>{s.fileName}</span>
          )}
          {cat && (
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wide ${CATEGORY_STYLE[cat] ?? "bg-gray-800 text-gray-400 border-gray-700"}`}>
              {cat}
            </span>
          )}
          {fixes.length > 0 && (
            <span className="text-[9px] text-gray-600">
              {fixes.length} {fixes.length === 1 ? "fix" : "fixes"}
            </span>
          )}
          {s.chatMessages?.length > 0 && (
            <span className="text-[9px] text-gray-600">
              · {s.chatMessages.length} msgs
            </span>
          )}
          <span className="text-[10px] text-gray-700 ml-auto shrink-0">
            {relativeTime(s.createdAt)}
          </span>
        </div>

        {/* Root cause preview */}
        {s.analysisResult?.rootCause && (
          <p className="mt-1.5 text-[11px] text-gray-600 line-clamp-2 leading-relaxed">
            {s.analysisResult.rootCause}
          </p>
        )}
      </div>

      {/* Action row — visible on hover */}
      <div className="px-3 pb-2.5 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onRestore}
          disabled={restoring || deleting}
          className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-700/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {restoring ? <MiniSpinner /> : <RestoreIcon />}
          {restoring ? "Restoring…" : "Restore"}
        </button>
        <button
          onClick={onDelete}
          disabled={restoring || deleting}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md text-gray-600 hover:text-red-400 hover:bg-red-950/30 border border-transparent hover:border-red-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {deleting ? <MiniSpinner /> : <TrashIcon />}
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  );
}

/* ─── Empty state ────────────────────────────────────────────── */

function EmptyState({ hasQuery }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
      <div className="w-10 h-10 rounded-xl bg-[#252526] border border-white/[0.06] flex items-center justify-center">
        <BookmarkIcon muted />
      </div>
      <div>
        <p className="text-[12px] font-medium text-gray-400">
          {hasQuery ? "No sessions match your search" : "No saved sessions yet"}
        </p>
        <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">
          {hasQuery
            ? "Try a different search term."
            : "Click Save in the title bar to snapshot your current editor state, errors, and AI responses."}
        </p>
      </div>
    </div>
  );
}

/* ─── Icons ──────────────────────────────────────────────────── */

function BookmarkIcon({ muted }) {
  return (
    <svg className={`h-4 w-4 ${muted ? "text-gray-600" : "text-indigo-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
    </svg>
  );
}

function XIcon({ small }) {
  return (
    <svg className={small ? "h-3 w-3" : "h-4 w-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0z" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}

function MiniSpinner() {
  return (
    <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

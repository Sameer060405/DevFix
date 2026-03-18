import { useEffect, useRef } from "react";

export default function HistoryPanel({ items, loading, error, onSelect, onClose }) {
  const panelRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-20" aria-hidden="true" />

      {/* Drawer */}
      <aside
        ref={panelRef}
        className="fixed right-0 top-0 h-full w-full max-w-sm z-30 flex flex-col"
        style={{ background: "rgba(7,9,26,0.95)", borderLeft: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(20px)", boxShadow: "-24px 0 64px rgba(0,0,0,0.7)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2">
            <ClockIcon />
            <h2 className="font-semibold text-sm text-gray-100">History</h2>
            {items.length > 0 && (
              <span className="text-xs text-gray-500">({items.length})</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-200 transition-colors p-1 rounded"
            aria-label="Close history"
          >
            <XIcon />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex flex-col gap-3 p-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="rounded-xl border border-gray-800 bg-gray-800/50 p-4 animate-pulse">
                  <div className="h-2.5 bg-gray-700 rounded w-3/4 mb-3" />
                  <div className="h-2 bg-gray-700 rounded w-full mb-1.5" />
                  <div className="h-2 bg-gray-700 rounded w-5/6" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="m-4 p-4 rounded-xl border border-red-800 bg-red-950/30 text-sm text-red-300">
              {error}
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <span className="text-3xl opacity-20">📂</span>
              <p className="text-sm text-gray-600">No analyses saved yet.</p>
            </div>
          )}

          {!loading && items.map((item) => (
            <button
              key={item._id}
              onClick={() => onSelect(item._id)}
              className="w-full text-left px-5 py-4 transition-all group"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(139,92,246,0.06)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              {/* Timestamp */}
              <p className="text-[10px] text-gray-600 mb-1.5 font-mono">
                {new Date(item.createdAt).toLocaleString()}
              </p>

              {/* Error preview */}
              <p className="text-xs text-red-400 font-mono truncate mb-1.5">
                {item.errorMessage}
              </p>

              {/* Root cause preview */}
              <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                {item.rootCause}
              </p>

              <p className="text-[10px] text-indigo-500 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                Click to restore →
              </p>
            </button>
          ))}
        </div>
      </aside>
    </>
  );
}

function ClockIcon() {
  return (
    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

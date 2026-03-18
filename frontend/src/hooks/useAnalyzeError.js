import { useState, useRef, useCallback } from "react";
import { analyzeError } from "../api/analyzeError.js";

/**
 * Encapsulates all state for a single analyze-error request cycle.
 *
 * Returns:
 *   result   – { rootCause, fix: string[], improvedCode } | null
 *   status   – "idle" | "loading" | "success" | "error"
 *   error    – string | null
 *   analyze  – (errorMessage, codeSnippet) => void
 *   reset    – () => void  — clears result and error
 */
export function useAnalyzeError() {
  const [result, setResult]   = useState(null);
  const [status, setStatus]   = useState("idle");   // idle | loading | success | error
  const [error, setError]     = useState(null);

  // Keep a ref to the active AbortController so we can cancel stale requests
  const abortRef = useRef(null);

  const analyze = useCallback(async ({ errorMessage, codeSnippet }) => {
    // Cancel any previous in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setStatus("loading");
    setError(null);
    setResult(null);

    try {
      const data = await analyzeError({
        errorMessage,
        codeSnippet,
        signal: abortRef.current.signal,
      });

      setResult(data);
      setStatus("success");
    } catch (err) {
      if (err.name === "AbortError") return; // silently ignore cancelled requests
      setError(err.message);
      setStatus("error");
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setResult(null);
    setError(null);
    setStatus("idle");
  }, []);

  // Restores a saved analysis (from history or sessions) without making an API call.
  // Accepts both the new session format { rootCause, errorCategory, fixes, optimizations }
  // and the legacy history format { rootCause, fix, improvedCode }.
  const restore = useCallback((doc) => {
    abortRef.current?.abort();
    setError(null);
    setResult({
      rootCause:     doc.rootCause,
      errorCategory: doc.errorCategory,
      fixes:         doc.fixes,
      optimizations: doc.optimizations,
      // legacy fields — kept for backward compatibility with old history items
      fix:           doc.fix,
      improvedCode:  doc.improvedCode,
    });
    setStatus("success");
  }, []);

  return {
    result,
    status,
    loading: status === "loading",
    error,
    analyze,
    reset,
    restore,
  };
}

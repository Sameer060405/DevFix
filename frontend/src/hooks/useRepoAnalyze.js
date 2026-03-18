import { useState, useRef, useCallback } from "react";
import { analyzeRepo } from "../api/repoAnalyze.js";

/**
 * Manages state for a single repo analysis request cycle.
 *
 * Returns:
 *   result   – { repoMeta, filesAnalyzed, summary, bugs, codeSmells, improvements } | null
 *   status   – "idle" | "loading" | "success" | "error"
 *   loading  – boolean shorthand
 *   error    – string | null
 *   analyze  – (repoUrl: string) => void
 *   reset    – () => void
 */
export function useRepoAnalyze() {
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error,  setError]  = useState(null);

  const abortRef = useRef(null);

  const analyze = useCallback(async (repoUrl) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setStatus("loading");
    setError(null);
    setResult(null);

    try {
      const data = await analyzeRepo({ repoUrl, signal: abortRef.current.signal });
      setResult(data);
      setStatus("success");
    } catch (err) {
      if (err.name === "AbortError") return;
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

  return {
    result,
    status,
    loading: status === "loading",
    error,
    analyze,
    reset,
  };
}

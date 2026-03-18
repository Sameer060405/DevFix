import { useState, useCallback } from "react";
import { fetchHistory, fetchAnalysisById, saveAnalysis } from "../api/history.js";

export function useHistory() {
  const [items, setItems]   = useState([]);       // list items from GET /history
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchHistory();
      setItems(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const save = useCallback(async (payload) => {
    try {
      const saved = await saveAnalysis(payload);
      // Prepend a minimal item to the list so the sidebar updates instantly
      setItems((prev) => [
        {
          _id: saved.id,
          errorMessage: payload.errorMessage,
          rootCause: payload.rootCause,
          createdAt: saved.createdAt,
        },
        ...prev,
      ]);
    } catch {
      // Save failure is non-critical — swallow silently so the UI stays usable
    }
  }, []);

  const getById = useCallback(fetchAnalysisById, []);

  return { items, loading, error, loadHistory, save, getById };
}

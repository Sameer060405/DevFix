import { useState, useCallback } from "react";
import {
  getSessions  as apiList,
  getSession   as apiGet,
  saveSession  as apiSave,
  deleteSession as apiDelete,
} from "../api/sessions.js";

/**
 * Manages saved-session CRUD.
 *
 * Returns:
 *   sessions   – lightweight list items (no codeSnapshot)
 *   total / page / pages – pagination metadata
 *   loading    – true while fetching the list
 *   saving     – true while a save is in progress
 *   error      – last error string | null
 *   load(page) – fetch / refresh the list
 *   save(payload) → { ok, sessionId, title }
 *   remove(id) – delete and remove from local list
 *   fetchOne(id) → full session with codeSnapshot
 */
export function useSessions() {
  const [sessions, setSessions] = useState([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [pages,    setPages]    = useState(1);
  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState(null);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiList({ page: p });
      setSessions(data.sessions);
      setTotal(data.total);
      setPage(data.page);
      setPages(data.pages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const save = useCallback(async (payload) => {
    setSaving(true);
    setError(null);
    try {
      const result = await apiSave(payload);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const remove = useCallback(async (id) => {
    await apiDelete(id);
    setSessions((prev) => prev.filter((s) => s._id !== id));
    setTotal((prev) => prev - 1);
  }, []);

  const fetchOne = useCallback((id) => apiGet(id), []);

  return { sessions, total, page, pages, loading, saving, error, load, save, remove, fetchOne };
}

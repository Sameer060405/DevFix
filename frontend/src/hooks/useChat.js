import { useState, useEffect, useRef, useCallback } from "react";
import {
  createSession,
  getSession,
  sendMessage as apiSendMessage,
  updateContext as apiUpdateContext,
  deleteSession,
} from "../api/chat.js";

const STORAGE_KEY = "devfix_chat_session_id";

/**
 * Manages the full lifecycle of a chat session:
 * - Reads/writes sessionId from localStorage for persistence across page loads
 * - Bootstraps (create or restore) the session on mount
 * - Handles send, context update, and session reset
 *
 * Returns:
 *   sessionId     string | null
 *   title         string
 *   messages      { _id, role, content, createdAt }[]
 *   codeContext   string
 *   sending       boolean  — true while waiting for AI reply
 *   bootstrapping boolean  — true during initial session load/create
 *   error         string | null
 *   send(text)    async — sends a message, optimistically appends user msg
 *   setCodeContext(code) async — persists code context to backend
 *   clearSession() async — deletes current session and creates a new one
 */
export function useChat() {
  const [sessionId,     setSessionId]     = useState(null);
  const [title,         setTitle]         = useState("New Chat");
  const [messages,      setMessages]      = useState([]);
  const [codeContext,   setCodeContextState] = useState("");
  const [sending,       setSending]       = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [error,         setError]         = useState(null);

  const abortRef = useRef(null);

  // ── Bootstrap: restore or create session on mount ──────────────────────
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (stored) {
        try {
          const session = await getSession(stored);
          if (!cancelled) {
            setSessionId(session.sessionId);
            setTitle(session.title);
            setMessages(session.messages);
            setCodeContextState(session.codeContext ?? "");
          }
          return;
        } catch {
          // Stored session is gone (expired or deleted) — create a fresh one
          localStorage.removeItem(STORAGE_KEY);
        }
      }

      try {
        const session = await createSession();
        if (!cancelled) {
          localStorage.setItem(STORAGE_KEY, session.sessionId);
          setSessionId(session.sessionId);
          setTitle(session.title);
          setMessages([]);
          setCodeContextState("");
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    bootstrap().finally(() => { if (!cancelled) setBootstrapping(false); });
    return () => { cancelled = true; };
  }, []);

  // ── Send a message ──────────────────────────────────────────────────────
  const send = useCallback(async (text) => {
    if (!text.trim() || !sessionId) return;

    // Cancel any previous in-flight send
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    // Optimistically append user message
    const optimisticMsg = {
      _id:       `temp-${Date.now()}`,
      role:      "user",
      content:   text.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setSending(true);
    setError(null);

    try {
      const data = await apiSendMessage(sessionId, text.trim(), abortRef.current.signal);

      // Replace optimistic user msg with confirmed messages from server
      setMessages((prev) => {
        // Remove the optimistic entry and append the confirmed user + assistant messages
        const withoutOptimistic = prev.filter((m) => m._id !== optimisticMsg._id);
        return [
          ...withoutOptimistic,
          { _id: `u-${Date.now()}`, role: "user",      content: text.trim(),  createdAt: new Date().toISOString() },
          { _id: data.messageId,   role: "assistant",  content: data.reply,   createdAt: new Date().toISOString() },
        ];
      });

      // Update title after first message
      if (messages.length === 0) {
        setTitle(text.trim().slice(0, 60) + (text.length > 60 ? "…" : ""));
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      // Roll back the optimistic message
      setMessages((prev) => prev.filter((m) => m._id !== optimisticMsg._id));
      setError(err.message);
    } finally {
      setSending(false);
    }
  }, [sessionId, messages.length]);

  // ── Update code context ─────────────────────────────────────────────────
  const setCodeContext = useCallback(async (code) => {
    if (!sessionId) return;
    setCodeContextState(code);
    try {
      await apiUpdateContext(sessionId, code);
    } catch (err) {
      setError(err.message);
    }
  }, [sessionId]);

  // ── Clear and start a new session ───────────────────────────────────────
  const clearSession = useCallback(async () => {
    abortRef.current?.abort();

    if (sessionId) {
      deleteSession(sessionId).catch(() => {}); // fire-and-forget
    }

    try {
      const session = await createSession();
      localStorage.setItem(STORAGE_KEY, session.sessionId);
      setSessionId(session.sessionId);
      setTitle("New Chat");
      setMessages([]);
      setCodeContextState("");
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [sessionId]);

  return {
    sessionId,
    title,
    messages,
    codeContext,
    sending,
    bootstrapping,
    error,
    send,
    setCodeContext,
    clearSession,
  };
}

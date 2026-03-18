const BASE = "/api/chat";

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      ...options,
    });
  } catch {
    throw new Error("Cannot reach the server. Is the backend running on port 5000?");
  }

  if (res.status === 401) {
    window.dispatchEvent(new Event("auth:expired"));
    throw new Error("Your session has expired. Please log in again.");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
  return data;
}

/** Creates a new chat session. Returns { sessionId, codeContext, messages, title, createdAt } */
export function createSession(codeContext = "") {
  return request("/session", {
    method: "POST",
    body: JSON.stringify({ codeContext }),
  });
}

/** Returns full session state: { sessionId, title, codeContext, messages } */
export function getSession(sessionId) {
  return request(`/session/${sessionId}`);
}

/** Updates the code context for an existing session. Returns { ok, codeContext } */
export function updateContext(sessionId, codeContext) {
  return request(`/session/${sessionId}/context`, {
    method: "PATCH",
    body: JSON.stringify({ codeContext }),
  });
}

/**
 * Sends a message and returns the assistant's reply.
 * Returns { reply, messageId, sessionId }
 */
export function sendMessage(sessionId, message, explainMode, signal) {
  return request(`/session/${sessionId}/message`, {
    method: "POST",
    body: JSON.stringify({ message, explainMode }),
    signal,
  });
}

/** Deletes a session. Returns { ok } */
export function deleteSession(sessionId) {
  return request(`/session/${sessionId}`, { method: "DELETE" });
}

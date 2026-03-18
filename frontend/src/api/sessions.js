const BASE = "/api";

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

/** Save a session snapshot. Returns { ok, sessionId, title } */
export function saveSession(payload) {
  return request("/save-session", { method: "POST", body: JSON.stringify(payload) });
}

/** List sessions (lightweight — no codeSnapshot). Returns { sessions, total, page, pages } */
export function getSessions({ page = 1, limit = 20 } = {}) {
  return request(`/sessions?page=${page}&limit=${limit}`);
}

/** Fetch a single session with full codeSnapshot + chatMessages. */
export function getSession(id) {
  return request(`/sessions/${id}`);
}

/** Delete a session. Returns { ok } */
export function deleteSession(id) {
  return request(`/sessions/${id}`, { method: "DELETE" });
}

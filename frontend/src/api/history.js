async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(path, { credentials: "include", ...options });
  } catch {
    throw new Error("Cannot reach the server. Is the backend running on port 5000?");
  }
  if (res.status === 401) {
    window.dispatchEvent(new Event("auth:expired"));
    throw new Error("Your session has expired. Please log in again.");
  }
  if (!res.ok) throw new Error("Request failed.");
  return res.json();
}

export function fetchHistory() {
  return request("/api/history"); // [{ _id, errorMessage, rootCause, createdAt }]
}

export function fetchAnalysisById(id) {
  return request(`/api/history/${id}`);
}

export function saveAnalysis(payload) {
  return request("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

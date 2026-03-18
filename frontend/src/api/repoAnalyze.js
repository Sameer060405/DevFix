/**
 * API client for POST /api/analyze-repo.
 */
export async function analyzeRepo({ repoUrl, signal }) {
  let res;

  try {
    res = await fetch("/api/analyze-repo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ repoUrl }),
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new Error("Cannot reach the server. Is the backend running on port 5000?");
  }

  if (res.status === 401) {
    window.dispatchEvent(new Event("auth:expired"));
    throw new Error("Your session has expired. Please log in again.");
  }

  const data = await res.json().catch(() => ({}));

  if (res.ok) return data;

  const statusMessages = {
    400: data.error ?? "Invalid repository URL.",
    404: data.error ?? "Repository not found or is private.",
    429: data.error ?? "Rate limit reached. Wait a moment and try again.",
    502: data.error ?? "The AI returned an unexpected response. Try again.",
    503: "Cannot reach the AI service. Check your internet connection.",
  };

  throw new Error(statusMessages[res.status] ?? data.error ?? `Unexpected error (${res.status}).`);
}

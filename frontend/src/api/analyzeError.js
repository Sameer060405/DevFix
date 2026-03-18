/**
 * API client for POST /api/analyze-error.
 * Accepts an AbortSignal so in-flight requests can be cancelled
 * (e.g. user submits a second request before the first finishes).
 */
export async function analyzeError({ errorMessage, codeSnippet, signal }) {
  let res;

  try {
    res = await fetch("/api/analyze-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ errorMessage, codeSnippet }),
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err; // let the hook handle cancellation
    throw new Error("Cannot reach the server. Is the backend running on port 5000?");
  }

  if (res.status === 401) {
    window.dispatchEvent(new Event("auth:expired"));
    throw new Error("Your session has expired. Please log in again.");
  }

  const data = await res.json().catch(() => ({}));

  if (res.ok) return data;

  const statusMessages = {
    400: data.error ?? "Please fill in both fields before submitting.",
    429: "Rate limit reached. Wait a moment and try again.",
    502: data.error ?? "The AI returned an unexpected response. Try again.",
    503: "Cannot reach the AI service. Check your internet connection.",
  };

  throw new Error(statusMessages[res.status] ?? data.error ?? `Unexpected error (${res.status}).`);
}

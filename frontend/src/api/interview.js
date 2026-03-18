const BASE = "/api/interview";

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      ...options,
    });
  } catch {
    throw new Error("Cannot reach the server. Is the backend running?");
  }

  if (res.status === 401) {
    window.dispatchEvent(new Event("auth:expired"));
    throw new Error("Your session has expired. Please log in again.");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
  return data;
}

/**
 * Analyse project files and generate 5 interview questions.
 * @param {Array<{ path: string, lang: string, content: string }>} projectSnapshot
 * @returns {{ projectSummary, techStack, questions }}
 */
export function startInterview(projectSnapshot) {
  return request("/start", {
    method: "POST",
    body: JSON.stringify({ projectSnapshot }),
  });
}

/**
 * Evaluate one answer and get feedback + optional follow-up question.
 * @returns {{ score, strengths, improvements, feedback, followUpQuestion }}
 */
export function evaluateAnswer({ question, answer, projectSummary, questionType, difficulty }) {
  return request("/evaluate", {
    method: "POST",
    body: JSON.stringify({ question, answer, projectSummary, questionType, difficulty }),
  });
}

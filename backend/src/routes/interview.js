import { Router } from "express";
import Groq from "groq-sdk";

const router = Router();
const groq   = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Serialise the project snapshot into a prompt-friendly string.
 * Caps each file at 1 200 chars and takes at most 12 files to stay within
 * the model's context window.
 */
function buildProjectText(projectSnapshot) {
  return projectSnapshot
    .slice(0, 12)
    .map((f) => {
      const body = (f.content ?? "").slice(0, 1_200);
      return `### ${f.path} (${f.lang ?? "unknown"})\n\`\`\`${f.lang ?? ""}\n${body}\n\`\`\``;
    })
    .join("\n\n");
}

function safeParseJSON(raw) {
  // Strip markdown fences if the model wraps its JSON in them
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  return JSON.parse(cleaned);
}

// ─── POST /api/interview/start ────────────────────────────────────────────────
/**
 * Analyses the project snapshot and returns:
 *   { projectSummary, techStack, questions: [{ id, question, type, difficulty }] }
 *
 * Body: { projectSnapshot: [{ path, lang, content }] }
 */
router.post("/interview/start", async (req, res) => {
  const { projectSnapshot = [] } = req.body ?? {};

  if (!Array.isArray(projectSnapshot) || projectSnapshot.length === 0) {
    return res.status(400).json({ error: "No project files provided." });
  }

  const filesText = buildProjectText(projectSnapshot);

  const prompt = `You are a senior technical interviewer conducting a real interview about a software project.

Analyse the following project files carefully, then produce a structured technical interview.

## Project Files
${filesText}

## Your Task
1. Write a short project summary (2–3 sentences: what it does, key patterns, overall complexity).
2. List the tech stack as an array of strings (e.g. ["React", "Node.js", "MongoDB"]).
3. Generate exactly 5 interview questions directly referencing this specific project's code.

Question type distribution (use these exact type values):
  - 1 × "understanding"  — what does this specific code / function do?
  - 1 × "technical"      — deep-dive into an implementation detail
  - 1 × "edge_case"      — what could break? corner cases? error handling?
  - 1 × "optimization"   — how to improve performance or design?
  - 1 × "system_design"  — how would you scale / restructure this?

Each question must:
  - Reference a real file, function name, or code pattern from the project
  - Be answerable in 2–5 minutes by a mid-level developer
  - Have a difficulty of "easy", "medium", or "hard"

Respond with ONLY a valid JSON object — no markdown fences, no extra text:
{
  "projectSummary": "...",
  "techStack": ["...", "..."],
  "questions": [
    { "id": 1, "question": "...", "type": "understanding", "difficulty": "easy"   },
    { "id": 2, "question": "...", "type": "technical",     "difficulty": "medium" },
    { "id": 3, "question": "...", "type": "edge_case",     "difficulty": "medium" },
    { "id": 4, "question": "...", "type": "optimization",  "difficulty": "hard"   },
    { "id": 5, "question": "...", "type": "system_design", "difficulty": "hard"   }
  ]
}`;

  try {
    const completion = await groq.chat.completions.create({
      model:       "llama-3.3-70b-versatile",
      messages:    [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens:  2_048,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";

    let data;
    try {
      data = safeParseJSON(raw);
    } catch {
      return res.status(502).json({ error: "AI returned invalid JSON. Please try again." });
    }

    return res.json({
      projectSummary: data.projectSummary ?? "Project analysed.",
      techStack:      Array.isArray(data.techStack) ? data.techStack : [],
      questions:      (Array.isArray(data.questions) ? data.questions : []).slice(0, 5),
    });
  } catch (err) {
    const msg = err.message ?? "";
    console.error("[interview/start]", msg);
    if (msg.includes("429") || msg.includes("rate_limit")) {
      return res.status(429).json({ error: "Rate limit reached. Wait a moment and try again." });
    }
    return res.status(500).json({ error: "Failed to analyse project. Please try again." });
  }
});

// ─── POST /api/interview/evaluate ─────────────────────────────────────────────
/**
 * Evaluates one answer and optionally generates a follow-up question.
 *
 * Body: { question, answer, projectSummary, questionType, difficulty }
 * Returns: { score, strengths, improvements, feedback, followUpQuestion }
 */
router.post("/interview/evaluate", async (req, res) => {
  const { question, answer, projectSummary, questionType, difficulty } = req.body ?? {};

  if (!question || typeof question !== "string") {
    return res.status(400).json({ error: "Missing question." });
  }
  if (!answer || typeof answer !== "string" || !answer.trim()) {
    return res.status(400).json({ error: "Missing answer." });
  }

  const prompt = `You are a senior technical interviewer evaluating a candidate's answer.

## Project Context
${projectSummary ?? "A software project."}

## Question
Type: ${questionType ?? "technical"} | Difficulty: ${difficulty ?? "medium"}
"${question}"

## Candidate's Answer
"${answer.trim()}"

## Your Task
Evaluate the answer fairly. Consider:
1. **Correctness** — is the technical content accurate?
2. **Depth** — does it show understanding beyond the surface?
3. **Clarity** — is the explanation structured and easy to follow?
4. **Engineering mindset** — does it show good problem-solving instincts?

Rules for scoring:
- 0–3:  Incorrect or severely incomplete
- 4–5:  Partially correct but missing key points
- 6–7:  Correct with reasonable depth
- 8–9:  Strong, well-explained, demonstrates real understanding
- 10:   Exceptional — covers edge cases, trade-offs, and advanced insights

For followUpQuestion: generate ONE deeper follow-up question if the answer had an interesting gap or opened an important topic.
If the answer was comprehensive (score ≥ 8), set followUpQuestion to null.

Respond with ONLY a valid JSON object — no markdown fences, no extra text:
{
  "score": <integer 0–10>,
  "strengths": ["...", "..."],
  "improvements": ["...", "..."],
  "feedback": "...(2–3 sentences of overall feedback)",
  "followUpQuestion": "...or null"
}`;

  try {
    const completion = await groq.chat.completions.create({
      model:       "llama-3.3-70b-versatile",
      messages:    [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens:  1_024,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";

    let data;
    try {
      data = safeParseJSON(raw);
    } catch {
      return res.status(502).json({ error: "AI returned invalid JSON. Please try again." });
    }

    return res.json({
      score:             Math.min(10, Math.max(0, Number(data.score) || 5)),
      strengths:         Array.isArray(data.strengths)    ? data.strengths    : [],
      improvements:      Array.isArray(data.improvements) ? data.improvements : [],
      feedback:          data.feedback          ?? "",
      followUpQuestion:  data.followUpQuestion  ?? null,
    });
  } catch (err) {
    const msg = err.message ?? "";
    console.error("[interview/evaluate]", msg);
    if (msg.includes("429") || msg.includes("rate_limit")) {
      return res.status(429).json({ error: "Rate limit reached. Wait a moment and try again." });
    }
    return res.status(500).json({ error: "Failed to evaluate answer. Please try again." });
  }
});

export default router;

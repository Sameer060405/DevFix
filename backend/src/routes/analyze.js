import { Router } from "express";
import Groq from "groq-sdk";
import { generateEmbedding } from "../services/embeddings.js";
import { querySimilar } from "../services/pinecone.js";
import { classifyError } from "../services/classifyError.js";
import { getUserContext, pushError, setLastCode } from "../services/redis.js";

const router = Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are DevFix, a senior software engineer and patient coding mentor.
Your job is to analyze a runtime error and a code snippet, then explain the problem,
provide multiple possible fixes ranked by confidence, and suggest optimizations for the
surrounding code — all in a way a beginner can understand without sacrificing accuracy.

## Your personality
- Calm, clear, and encouraging. Never condescending.
- You explain the "why", not just the "what".
- You use plain English first, then add technical terms with a brief definition.

## Analysis process (think through all of these before writing your response)
1. Read the error message carefully — identify the error type, message, and file/line if present.
2. Trace the error back to its root cause in the code snippet.
3. Classify the error category:
   - "syntax"     — malformed code the parser rejects (missing bracket, typo in keyword, bad indentation, etc.)
   - "runtime"    — valid code that crashes during execution (null access, type mismatch, stack overflow, etc.)
   - "logic"      — code runs without crashing but produces wrong results (off-by-one, wrong operator, bad condition, etc.)
   - "dependency" — missing, incompatible, or unresolvable package / module / import
4. Formulate 2–3 distinct fixes ordered from most to least confident. Each fix is a self-contained
   approach — they should genuinely differ (e.g., one minimal patch vs. one refactor vs. a defensive guard).
5. For each fix, assign a confidence score (0–100) reflecting how likely it is to resolve the issue.
6. Independently of the bug fix, review the code snippet for improvements across three areas:
   a. Performance — things that make the code faster or use fewer resources
      (e.g., avoid recomputing inside loops, use more efficient data structures, cache repeated lookups).
      Rate each suggestion's impact: "high", "medium", or "low".
   b. Quality — readability, maintainability, and structure
      (e.g., extract magic numbers to named constants, rename unclear variables, simplify nested conditions).
   c. Best practices — language idioms, security, and error handling conventions
      (e.g., use strict equality, add input validation, prefer const over let, handle promise rejections).
   Then write a single "optimized" version of the snippet that applies the best fix AND all worthwhile
   optimizations together. Add brief inline comments only on changed lines.

## Output format
Respond with a single JSON object. No markdown fences, no extra keys, no trailing commas.
Use this exact structure:

{
  "rootCause": "<Plain-English explanation of WHY the error happened. 2–4 sentences.>",
  "errorCategory": "<one of: syntax | runtime | logic | dependency>",
  "fixes": [
    {
      "title": "<Short label, e.g. 'Add null check before access'>",
      "confidence": <integer 0–100>,
      "affectedLines": [<1-based line numbers in the code snippet where the bug lives, e.g. [3, 7]. Empty array [] if no specific line can be identified.>],
      "steps": [
        "<Step 1: What to do first and why>",
        "<Step 2: The actual change, quoting bad code then corrected code>",
        "<Step 3 (optional): Follow-up check or related caveat>"
      ],
      "improvedCode": "<Full corrected snippet with only this fix applied. Never truncate.>"
    }
  ],
  "optimizations": {
    "performance": [
      {
        "title": "<Short label>",
        "description": "<1–2 sentences: what to change and why it's faster/lighter>",
        "impact": "<high | medium | low>"
      }
    ],
    "quality": [
      {
        "title": "<Short label>",
        "description": "<1–2 sentences: what to change and why it's cleaner/clearer>"
      }
    ],
    "bestPractices": [
      {
        "title": "<Short label>",
        "description": "<1–2 sentences: what to change and why it follows the convention>"
      }
    ],
    "improvedCode": "<Full snippet with the best fix AND all worthwhile optimizations applied.
                     Add inline comments only on changed lines. Never truncate.>"
  }
}

## Rules
- rootCause must be beginner-friendly.
- errorCategory must be exactly one of: syntax, runtime, logic, dependency.
- fixes must contain 2–3 objects sorted by confidence descending.
- Each fix.steps: array of strings, minimum 2 steps, maximum 5.
- Each fix.improvedCode: full snippet, no diffs, no truncation.
- optimizations.performance, .quality, and .bestPractices may each be an empty array [] if
  no meaningful suggestion exists for that category — but at least one category must be non-empty.
- optimizations.improvedCode: full snippet combining best fix + all optimizations.
- If the error cannot be diagnosed from the given information, say so in rootCause and ask
  for more context, while still providing best-guess fixes and any observable optimizations.
- Never add imports, dependencies, or refactors unrelated to fixing the error or optimizing the snippet.
- Each fix.affectedLines: array of 1-based integers. Must be present (use [] if line unknown).`;

// ─── Redis context builder ────────────────────────────────────────────────────

/**
 * Converts the user's Redis context into a prompt section.
 * Returns an empty string when there is no useful context.
 */
function buildUserContextSection({ recentErrors, lastCode }) {
  const parts = [];

  if (recentErrors.length) {
    const list = recentErrors
      .map((e, i) => {
        const age = formatAge(e.timestamp);
        return `${i + 1}. \`${e.errorMessage.slice(0, 120)}\` (${e.category}${age ? ` — ${age}` : ""})`;
      })
      .join("\n");
    parts.push(`### Recent Errors From This User's Session\n${list}`);
  }

  if (lastCode) {
    parts.push(
      `### Last Analyzed Code (may be from the same file)\n\`\`\`\n${lastCode.slice(0, 2_000)}${lastCode.length > 2_000 ? "\n// [truncated]" : ""}\n\`\`\``
    );
  }

  if (!parts.length) return "";

  return (
    `## Cross-Request Session Context\n` +
    `The user has been actively debugging. Use this context if it seems relevant — ` +
    `do NOT mention it explicitly unless directly related to the current error.\n\n` +
    parts.join("\n\n") +
    `\n\n---\n\n`
  );
}

function formatAge(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins   = Math.floor(diffMs / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the "similar past errors" section prepended to the user prompt.
 * Returns an empty string when no similar errors were found.
 */
function buildSimilarContext(similar) {
  if (!similar.length) return "";

  const items = similar
    .map((s, i) => {
      const pct  = Math.round(s.score * 100);
      const steps = s.fix.slice(0, 2).join(" → ");
      return (
        `### Past Error ${i + 1} (${pct}% similar)\n` +
        `**Error:** ${s.errorMessage}\n` +
        `**Root Cause:** ${s.rootCause}\n` +
        `**Fix Summary:** ${steps}`
      );
    })
    .join("\n\n---\n\n");

  return (
    `## Similar Past Errors (for reference)\n` +
    `The following resolved errors are semantically similar to the one below. ` +
    `Use them to inform your analysis if relevant — but always base your answer on the current error and code.\n\n` +
    `${items}\n\n` +
    `---\n\n`
  );
}

router.post("/analyze-error", async (req, res) => {
  const { errorMessage, codeSnippet } = req.body ?? {};

  // --- Input validation ---
  if (!codeSnippet || typeof codeSnippet !== "string" || !codeSnippet.trim()) {
    return res.status(400).json({ error: "Missing or empty required field: codeSnippet." });
  }
  const hasError = typeof errorMessage === "string" && errorMessage.trim().length > 0;

  // --- Similarity search + pre-classification + Redis context (all in parallel, all non-blocking) ---
  let similar = [];
  let preClassification = null;
  let userCtx = { recentErrors: [], lastCode: null, recentChat: [] };

  await Promise.all([
    hasError
      ? generateEmbedding(errorMessage.trim())
          .then((embedding) => querySimilar(embedding))
          .then((results) => { similar = results; })
          .catch(() => {})
      : Promise.resolve(),
    hasError
      ? classifyError(errorMessage.trim(), codeSnippet.trim())
          .then((result) => { preClassification = result; })
          .catch(() => {})
      : Promise.resolve(),
    getUserContext(req.userId)
      .then((ctx) => { userCtx = ctx; })
      .catch(() => {}),
  ]);

  // --- Build prompt ---
  const similarContext      = buildSimilarContext(similar);
  const userContextSection  = buildUserContextSection(userCtx);
  const classificationHint  = preClassification
    ? `## Pre-Classification Hint\nPattern/AI pre-analysis suggests this is a **${preClassification.category}** error ` +
      `(confidence: ${preClassification.confidence}%, method: ${preClassification.method}). ` +
      `Use this as a strong signal — override it only if you see clear contradicting evidence.\n\n`
    : "";

  const userPrompt =
    `${userContextSection}` +
    `${similarContext}` +
    `${classificationHint}` +
    (hasError
      ? `## Error Message\n\`\`\`\n${errorMessage.trim()}\n\`\`\`\n\n`
      : `## Task\nNo specific error was reported. Review the code below for bugs, issues, and improvements.\n\n`) +
    `## Code Snippet\n\`\`\`\n${codeSnippet.trim()}\n\`\`\`\n\n` +
    `Diagnose the error above and return the JSON response described in your instructions.`;

  // --- Call Groq ---
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const rawText = completion.choices[0]?.message?.content ?? "";

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return res.status(502).json({ error: "Received an unexpected response format from the AI. Please try again." });
    }

    const { rootCause, fixes, optimizations } = parsed;
    const validCategories = ["syntax", "runtime", "logic", "dependency"];

    // Accept AI category; fall back to pre-classification if AI returned something invalid.
    let errorCategory = parsed.errorCategory;
    if (!validCategories.includes(errorCategory)) {
      errorCategory = preClassification?.category ?? "runtime";
    }

    const fixesInvalid =
      !Array.isArray(fixes) ||
      fixes.length === 0 ||
      fixes.some((f) => !f.title || typeof f.confidence !== "number" || !Array.isArray(f.steps) || !f.improvedCode);

    const optsInvalid =
      !optimizations ||
      typeof optimizations !== "object" ||
      !Array.isArray(optimizations.performance) ||
      !Array.isArray(optimizations.quality) ||
      !Array.isArray(optimizations.bestPractices) ||
      !optimizations.improvedCode;

    if (!rootCause || fixesInvalid || optsInvalid) {
      return res.status(502).json({ error: "AI response was missing required fields. Please try again." });
    }

    // --- Write context back to Redis (fire-and-forget — never blocks the response) ---
    if (req.userId) {
      const tasks = [setLastCode(req.userId, codeSnippet.trim())];
      if (hasError) tasks.push(pushError(req.userId, { errorMessage: errorMessage.trim(), category: errorCategory }));
      Promise.all(tasks).catch(() => {});
    }

    return res.json({
      rootCause,
      errorCategory,
      fixes,
      optimizations,
      similarCount: similar.length,
      classificationMethod: preClassification?.method ?? "ai",
      contextUsed: {
        recentErrorCount: userCtx.recentErrors.length,
        hadLastCode:      !!userCtx.lastCode,
      },
    });
  } catch (err) {
    const msg = err.message ?? "";
    console.error("[analyze-error]", msg);
    if (msg.includes("401") || msg.includes("invalid_api_key") || msg.includes("Authentication")) {
      return res.status(401).json({ error: "Invalid Groq API key — check GROQ_API_KEY in backend/.env." });
    }
    if (msg.includes("429") || msg.includes("rate_limit") || msg.includes("quota")) {
      return res.status(429).json({ error: "Rate limit reached. Wait a moment and try again." });
    }
    if (msg.includes("fetch failed") || msg.includes("ENOTFOUND")) {
      return res.status(503).json({ error: "Could not reach the AI service. Check your network." });
    }
    return res.status(500).json({ error: "An unexpected error occurred." });
  }
});

export default router;

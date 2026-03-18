/**
 * classifyError.js
 *
 * Two-stage error classifier:
 *   1. Pattern matching — fast, free, no API call.
 *      Returns a category + confidence if a rule fires with confidence >= PATTERN_THRESHOLD.
 *   2. AI fallback (Groq) — used when pattern matching is inconclusive (confidence < threshold).
 *      Sends only the error message (not the full code) to keep tokens minimal.
 *
 * Exported:
 *   classifyError(errorMessage, codeSnippet?) → { category, confidence, method }
 *     category : "syntax" | "runtime" | "logic" | "dependency"
 *     confidence: 0–100 integer
 *     method    : "pattern" | "ai" | "default"
 */

import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── Pattern rules ────────────────────────────────────────────────────────────
//
// Evaluated in priority order (dependency first — most unambiguous).
// Each entry holds:
//   category       : the label to return
//   baseConfidence : confidence for a single match
//   bonusPerExtra  : added per each additional match beyond the first (capped at 98)
//   patterns       : array of RegExp tested against the lowercased error message

const PATTERN_RULES = [
  {
    category: "dependency",
    baseConfidence: 92,
    bonusPerExtra: 2,
    patterns: [
      /cannot find module/i,
      /module not found/i,
      /failed to resolve import/i,
      /could not resolve/i,
      /no module named/i,
      /modulenotfounderror/i,
      /importerror/i,
      /is not exported from/i,
      /does not provide an export named/i,
      /peer dep(endency)?/i,
      /missing peer/i,
      /version conflict/i,
      /npm err!/i,
      /yarn error/i,
      /package not found/i,
      /require stack/i,
      /enoent.*node_modules/i,
    ],
  },
  {
    category: "syntax",
    baseConfidence: 90,
    bonusPerExtra: 2,
    patterns: [
      /syntaxerror/i,
      /unexpected token/i,
      /unexpected end of (input|file)/i,
      /invalid or unexpected token/i,
      /unterminated string literal/i,
      /missing \) after argument list/i,
      /missing ; before statement/i,
      /indentationerror/i,
      /unexpected eof/i,
      /parseerror/i,
      /expected expression/i,
      /illegal character/i,
      /octal literals are not allowed/i,
    ],
  },
  {
    category: "runtime",
    baseConfidence: 82,
    bonusPerExtra: 3,
    patterns: [
      /typeerror/i,
      /referenceerror/i,
      /rangeerror/i,
      /urierror/i,
      /evalerror/i,
      /is not a function/i,
      /is not defined/i,
      /cannot read prop(erty|erties of)/i,
      /cannot set prop(erty|erties of)/i,
      /null is not an object/i,
      /undefined is not an object/i,
      /maximum call stack size exceeded/i,
      /out of memory/i,
      /indexerror/i,
      /attributeerror/i,
      /nameerror/i,
      /keyerror/i,
      /valueerror/i,
      /zerodivisionerror/i,
      /nullpointerexception/i,
      /arrayindexoutofboundsexception/i,
      /classcastexception/i,
      /stackoverflowerror/i,
      /segmentation fault/i,
      /access violation/i,
      /cannot destructure property/i,
      /is not iterable/i,
    ],
  },
  {
    category: "logic",
    baseConfidence: 68,
    bonusPerExtra: 4,
    patterns: [
      /assertionerror/i,
      /assertion (failed|error)/i,
      /expected .+ (but got|received|to be)/i,
      /incorrect (output|result|value)/i,
      /wrong (output|result|answer)/i,
      /off.by.one/i,
      /infinite loop/i,
      /test failed/i,
      /does not match expected/i,
    ],
  },
];

/** Minimum pattern-match confidence to skip the AI fallback. */
const PATTERN_THRESHOLD = 70;

// ─── Stage 1: pattern matching ────────────────────────────────────────────────

function classifyByPattern(errorMessage) {
  for (const { category, baseConfidence, bonusPerExtra, patterns } of PATTERN_RULES) {
    const hits = patterns.filter((p) => p.test(errorMessage));
    if (hits.length === 0) continue;

    const confidence = Math.min(98, baseConfidence + (hits.length - 1) * bonusPerExtra);
    return { category, confidence };
  }

  // No rule fired — return a low-confidence default so AI fallback kicks in.
  return { category: "runtime", confidence: 35 };
}

// ─── Stage 2: AI fallback ─────────────────────────────────────────────────────

const AI_CLASSIFY_PROMPT = `You are a code error classifier. Given an error message (and optionally a code snippet),
respond with a single JSON object using exactly this structure — no markdown, no extra keys:

{
  "category": "<one of: syntax | runtime | logic | dependency>",
  "confidence": <integer 0-100>,
  "reason": "<one concise sentence explaining your choice>"
}

Categories:
- syntax     : malformed code the parser rejects (missing bracket, bad keyword, indentation, etc.)
- runtime    : valid code that crashes during execution (null access, type mismatch, stack overflow, etc.)
- logic      : code runs without crashing but produces wrong results (wrong condition, off-by-one, etc.)
- dependency : missing, incompatible, or unresolvable package / module / import`;

async function classifyByAI(errorMessage, codeSnippet) {
  const userContent =
    `## Error Message\n\`\`\`\n${errorMessage}\n\`\`\`` +
    (codeSnippet ? `\n\n## Code Snippet (first 800 chars)\n\`\`\`\n${codeSnippet.slice(0, 800)}\n\`\`\`` : "");

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",   // lightweight model — classification only
    messages: [
      { role: "system", content: AI_CLASSIFY_PROMPT },
      { role: "user",   content: userContent },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 120,
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  const parsed = JSON.parse(raw);

  const validCategories = ["syntax", "runtime", "logic", "dependency"];
  if (
    !validCategories.includes(parsed.category) ||
    typeof parsed.confidence !== "number"
  ) {
    throw new Error("AI classifier returned invalid shape");
  }

  return {
    category: parsed.category,
    confidence: Math.min(100, Math.max(0, Math.round(parsed.confidence))),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Classifies an error into one of: syntax | runtime | logic | dependency.
 *
 * @param {string} errorMessage  - The raw error text.
 * @param {string} [codeSnippet] - Optional code context used only by the AI fallback.
 * @returns {Promise<{ category: string, confidence: number, method: string }>}
 */
export async function classifyError(errorMessage, codeSnippet = "") {
  const patternResult = classifyByPattern(errorMessage);

  if (patternResult.confidence >= PATTERN_THRESHOLD) {
    return { ...patternResult, method: "pattern" };
  }

  // Pattern confidence is too low — try AI.
  try {
    const aiResult = await classifyByAI(errorMessage, codeSnippet);
    return { ...aiResult, method: "ai" };
  } catch {
    // AI fallback failed — return the best pattern result we have.
    return { ...patternResult, method: "default" };
  }
}

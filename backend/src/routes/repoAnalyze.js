import { Router } from "express";
import Groq from "groq-sdk";
import { fetchRepo, parseGitHubUrl } from "../services/githubFetcher.js";

const router = Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are DevFix Repo Analyzer, a senior software engineer and code reviewer.
You receive a GitHub repository's file tree and source files, then produce a structured code review.

## Your review covers four areas

1. **Summary** — What the project does, its tech stack, how it is architected, and what it does well.

2. **Bugs** — Real defects: unhandled errors, race conditions, null dereferences, incorrect logic,
   missing validation, security vulnerabilities, dangerous patterns. Only report genuine problems,
   not stylistic preferences.

3. **Code Smells** — Structural or maintainability issues: duplicated logic, overly complex
   functions, unclear naming, tight coupling, God objects, magic numbers, dead code, etc.

4. **Improvements** — Actionable suggestions grouped by category:
   - performance  : measurable speed or memory wins
   - security     : hardening, input validation, secret management, auth
   - maintainability : readability, refactoring, dependency hygiene
   - testing      : missing tests, coverage gaps, test quality
   - documentation : missing or outdated docs/comments

## Output format
Respond with a single JSON object. No markdown fences, no extra keys, no trailing commas.

{
  "summary": {
    "description": "<2–4 sentences: what the project does and who it is for>",
    "techStack": ["<technology or library name>"],
    "architecture": "<2–3 sentences: how the codebase is structured and the key patterns used>",
    "strengths": ["<something the project does well — be specific>"]
  },
  "bugs": [
    {
      "severity": "<high | medium | low>",
      "file": "<relative file path, or null if repo-wide>",
      "title": "<short label>",
      "description": "<what is wrong and why it is a problem>",
      "suggestion": "<concrete fix>"
    }
  ],
  "codeSmells": [
    {
      "category": "<duplication | complexity | naming | coupling | dead-code | other>",
      "file": "<relative file path, or null if repo-wide>",
      "title": "<short label>",
      "description": "<what the smell is and why it matters>"
    }
  ],
  "improvements": [
    {
      "category": "<performance | security | maintainability | testing | documentation>",
      "priority": "<high | medium | low>",
      "title": "<short label>",
      "description": "<what to do and why it matters>"
    }
  ]
}

## Rules
- bugs: up to 8 items, sorted severity high → low. Only include real defects, not opinions.
- codeSmells: up to 8 items.
- improvements: up to 10 items, sorted priority high → low.
- summary.strengths: 2–4 items.
- summary.techStack: list only technologies clearly visible in the code/config.
- Be specific — reference actual file names, function names, or line patterns where possible.
- If the repo is too small to review meaningfully, still provide what you can.
- Do not invent bugs that are not evidenced in the provided files.`;

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt({ repoMeta, tree, files }) {
  const header =
    `## Repository: ${repoMeta.owner}/${repoMeta.repo}\n` +
    `Branch: ${repoMeta.branch} | ` +
    `Language: ${repoMeta.language ?? "mixed"} | ` +
    `Stars: ${repoMeta.stars} | ` +
    `Files: ${repoMeta.fileCount}${repoMeta.truncated ? " (tree truncated)" : ""}\n` +
    (repoMeta.description ? `Description: ${repoMeta.description}\n` : "") +
    `\n`;

  const treeSection =
    `## File Tree (all paths)\n\`\`\`\n` +
    tree.slice(0, 500).join("\n") +          // cap at 500 paths to avoid blowing the prompt
    (tree.length > 500 ? `\n... and ${tree.length - 500} more files` : "") +
    `\n\`\`\`\n\n`;

  const filesSection =
    `## Source Files (${files.length} fetched)\n\n` +
    files
      .map(
        (f) =>
          `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``
      )
      .join("\n\n");

  return (
    header +
    treeSection +
    filesSection +
    `\n\nReview the repository above and return the JSON response described in your instructions.`
  );
}

// ─── Route ────────────────────────────────────────────────────────────────────

router.post("/analyze-repo", async (req, res) => {
  const { repoUrl } = req.body ?? {};

  if (!repoUrl || typeof repoUrl !== "string" || !repoUrl.trim()) {
    return res.status(400).json({ error: "Missing or empty repoUrl." });
  }

  // Validate URL format before making any network calls
  try {
    parseGitHubUrl(repoUrl.trim());
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // ── Fetch repo ──────────────────────────────────────────────────────────
  let repoData;
  try {
    repoData = await fetchRepo(repoUrl.trim());
  } catch (err) {
    const msg = err.message ?? "";
    if (msg.includes("not found") || msg.includes("private")) {
      return res.status(404).json({ error: msg });
    }
    if (msg.includes("rate limit")) {
      return res.status(429).json({ error: msg });
    }
    if (msg.includes("Invalid GitHub URL")) {
      return res.status(400).json({ error: msg });
    }
    console.error("[analyze-repo fetch]", msg);
    return res.status(502).json({ error: "Failed to fetch repository from GitHub. " + msg });
  }

  // ── Call Groq ───────────────────────────────────────────────────────────
  try {
    const userPrompt = buildPrompt(repoData);

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
      return res.status(502).json({ error: "AI returned an unexpected response format. Please try again." });
    }

    const { summary, bugs, codeSmells, improvements } = parsed;

    if (
      !summary?.description ||
      !Array.isArray(bugs) ||
      !Array.isArray(codeSmells) ||
      !Array.isArray(improvements)
    ) {
      return res.status(502).json({ error: "AI response was missing required fields. Please try again." });
    }

    return res.json({
      repoMeta:     repoData.repoMeta,
      filesAnalyzed: repoData.files.length,
      summary,
      bugs,
      codeSmells,
      improvements,
    });
  } catch (err) {
    const msg = err.message ?? "";
    console.error("[analyze-repo groq]", msg);
    if (msg.includes("401") || msg.includes("invalid_api_key")) {
      return res.status(401).json({ error: "Invalid Groq API key — check GROQ_API_KEY in backend/.env." });
    }
    if (msg.includes("429") || msg.includes("rate_limit")) {
      return res.status(429).json({ error: "Rate limit reached. Wait a moment and try again." });
    }
    if (msg.includes("fetch failed") || msg.includes("ENOTFOUND")) {
      return res.status(503).json({ error: "Could not reach the AI service. Check your network." });
    }
    return res.status(500).json({ error: "An unexpected error occurred." });
  }
});

export default router;

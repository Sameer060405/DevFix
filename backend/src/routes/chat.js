import { Router } from "express";
import Groq from "groq-sdk";
import ChatSession from "../models/ChatSession.js";
import { getUserContext, pushChatMessages } from "../services/redis.js";

const router = Router();
const groq   = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * How many of the most-recent messages are sent to the LLM.
 * Keeps token usage bounded while preserving meaningful conversational context.
 */
const MAX_HISTORY_MESSAGES = 20;

// ─── Explain mode instructions ────────────────────────────────────────────────

const EXPLAIN_MODE_INSTRUCTIONS = {
  beginner: `
## Explanation Mode: Beginner
The user is new to programming or unfamiliar with this topic. Adapt ALL responses accordingly:
- Use very simple language — avoid or define every technical term you use
- Explain concepts through real-world analogies and everyday comparisons
- Break down each step explicitly, never skip "obvious" steps
- Use short sentences and simple structure
- Avoid acronyms without spelling them out first
- End complex explanations with a simple "In short: ..." summary`,

  intermediate: `
## Explanation Mode: Intermediate
The user has working programming knowledge. Adapt responses accordingly:
- Use standard technical terminology without over-explaining basics
- Explain the logic and reasoning behind the code, not just what it does
- Include practical examples where helpful
- Point out common patterns or idioms being used
- Mention edge cases or caveats worth knowing`,

  senior: `
## Explanation Mode: Senior Developer
The user is an experienced engineer. Adapt responses with maximum technical depth:
- Dive into architectural decisions and design patterns
- Discuss trade-offs: time/space complexity, readability vs performance, coupling
- Highlight edge cases, failure modes, and subtle bugs
- Mention scalability and production concerns where relevant
- Reference best practices, SOLID principles, or well-known patterns by name
- Be concise — skip basics entirely, focus on depth and nuance`,

  interview: `
## Explanation Mode: Interview Prep
The user is preparing for a technical interview. Structure ALL responses for interview success:
- Lead with a concise, clear definition suitable for verbal delivery
- Use bullet points to organize key concepts
- Highlight what interviewers specifically look for on this topic
- Include time/space complexity analysis where applicable
- Close each response with 2–3 likely follow-up interview questions on the same topic
- Keep answers thorough but structured — interviewers reward clarity and structure`,
};

const DEFAULT_MODE = "intermediate";

// ─── System prompt factory ────────────────────────────────────────────────────

function buildSystemPrompt(codeContext, userCtx = {}, explainMode = DEFAULT_MODE) {
  const codeSection = codeContext?.trim()
    ? `\n\n## Code Context\nThe user has attached the following code for this session.\nRefer to it whenever relevant — treat it as the primary subject of discussion unless the user asks about something else.\n\n\`\`\`\n${codeContext.trim()}\n\`\`\``
    : "\n\n## Code Context\nNo code has been attached yet. If the user's question requires seeing code, ask them to paste it using the code context panel.";

  // ── Cross-session context from Redis ──────────────────────────────────────
  const ctxParts = [];

  if (userCtx.recentErrors?.length) {
    const list = userCtx.recentErrors
      .map((e) => `- \`${e.errorMessage.slice(0, 120)}\` (${e.category})`)
      .join("\n");
    ctxParts.push(`**Recent errors debugged by this user:**\n${list}`);
  }

  // Only inject last code if the session has no explicit code context set
  if (!codeContext?.trim() && userCtx.lastCode) {
    ctxParts.push(
      `**Last code snippet the user analyzed (may be related):**\n\`\`\`\n${userCtx.lastCode.slice(0, 1_500)}\n\`\`\``
    );
  }

  const crossSessionSection = ctxParts.length
    ? `\n\n## Cross-Session Context\nThe following context comes from the user's recent debugging activity outside this chat. ` +
      `Use it to give more relevant answers — do not mention it unless directly useful.\n\n${ctxParts.join("\n\n")}`
    : "";

  const modeInstructions = EXPLAIN_MODE_INSTRUCTIONS[explainMode] ?? EXPLAIN_MODE_INSTRUCTIONS[DEFAULT_MODE];

  return `You are DevFix Assistant, an expert software engineer and patient coding mentor embedded in a debugging tool.
Your job is to help the user understand, debug, and improve their code through natural conversation.

## Behaviour
- Answer coding questions with precision and clarity.
- When referencing the user's code, cite specific line numbers, variable names, or function names.
- For bugs: identify the root cause, then show a corrected snippet with inline comments.
- If you don't have enough context to answer, ask a focused clarifying question.
- Format code in fenced code blocks (\`\`\`) with the language identifier.${modeInstructions}${codeSection}${crossSessionSection}`;
}

// ─── Helper: derive a session title from the first user message ───────────────

function deriveTitle(text) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length > 60 ? cleaned.slice(0, 57) + "…" : cleaned;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/chat/session
 * Creates a new chat session.
 * Body (optional): { codeContext: string }
 */
router.post("/chat/session", async (req, res) => {
  const { codeContext = "" } = req.body ?? {};

  try {
    const session = await ChatSession.create({ codeContext: codeContext.trim() });
    return res.status(201).json({
      sessionId:  session.sessionId,
      codeContext: session.codeContext,
      messages:   session.messages,
      title:      session.title,
      createdAt:  session.createdAt,
    });
  } catch (err) {
    console.error("[chat/session POST]", err.message);
    return res.status(500).json({ error: "Failed to create session." });
  }
});

/**
 * GET /api/chat/session/:sessionId
 * Returns a session's full state: code context + all messages.
 */
router.get("/chat/session/:sessionId", async (req, res) => {
  try {
    const session = await ChatSession.findOne({ sessionId: req.params.sessionId }).lean();
    if (!session) return res.status(404).json({ error: "Session not found." });

    return res.json({
      sessionId:   session.sessionId,
      title:       session.title,
      codeContext: session.codeContext,
      messages:    session.messages,
      createdAt:   session.createdAt,
      updatedAt:   session.updatedAt,
    });
  } catch (err) {
    console.error("[chat/session GET]", err.message);
    return res.status(500).json({ error: "Failed to load session." });
  }
});

/**
 * PATCH /api/chat/session/:sessionId/context
 * Updates the code context for an existing session.
 * Body: { codeContext: string }
 */
router.patch("/chat/session/:sessionId/context", async (req, res) => {
  const { codeContext = "" } = req.body ?? {};

  try {
    const session = await ChatSession.findOneAndUpdate(
      { sessionId: req.params.sessionId },
      { codeContext: codeContext.trim() },
      { new: true }
    );
    if (!session) return res.status(404).json({ error: "Session not found." });

    return res.json({ ok: true, codeContext: session.codeContext });
  } catch (err) {
    console.error("[chat/session PATCH context]", err.message);
    return res.status(500).json({ error: "Failed to update code context." });
  }
});

/**
 * POST /api/chat/session/:sessionId/message
 * Sends a user message and returns the assistant's reply.
 * Body: { message: string }
 */
router.post("/chat/session/:sessionId/message", async (req, res) => {
  const { message, explainMode } = req.body ?? {};

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Missing or empty message." });
  }

  const validModes = Object.keys(EXPLAIN_MODE_INSTRUCTIONS);
  const resolvedMode = validModes.includes(explainMode) ? explainMode : DEFAULT_MODE;

  // ── Load session + Redis context in parallel ────────────────────────────
  let session;
  let userCtx = { recentErrors: [], lastCode: null, recentChat: [] };

  try {
    [session] = await Promise.all([
      ChatSession.findOne({ sessionId: req.params.sessionId }),
      getUserContext(req.userId).then((ctx) => { userCtx = ctx; }).catch(() => {}),
    ]);
    if (!session) return res.status(404).json({ error: "Session not found." });
  } catch (err) {
    return res.status(500).json({ error: "Failed to load session." });
  }

  // ── Append user message ─────────────────────────────────────────────────
  const userMessage = { role: "user", content: message.trim() };
  session.messages.push(userMessage);

  // Set title from the first user message
  if (session.messages.length === 1) {
    session.title = deriveTitle(message.trim());
  }

  // ── Build LLM message history (rolling window) ──────────────────────────
  const recent = session.messages.slice(-MAX_HISTORY_MESSAGES);
  const llmMessages = [
    { role: "system", content: buildSystemPrompt(session.codeContext, userCtx, resolvedMode) },
    ...recent.map((m) => ({ role: m.role, content: m.content })),
  ];

  // ── Call Groq ────────────────────────────────────────────────────────────
  try {
    const completion = await groq.chat.completions.create({
      model:       "llama-3.3-70b-versatile",
      messages:    llmMessages,
      temperature: 0.4,
      max_tokens:  2048,
    });

    const reply = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!reply) {
      return res.status(502).json({ error: "AI returned an empty response. Please try again." });
    }

    // ── Persist both messages ───────────────────────────────────────────────
    session.messages.push({ role: "assistant", content: reply });
    await session.save();

    // ── Write to Redis context (fire-and-forget) ────────────────────────────
    if (req.userId) {
      pushChatMessages(req.userId, [
        { role: "user",      content: message.trim() },
        { role: "assistant", content: reply },
      ]).catch(() => {});
    }

    return res.json({
      reply,
      messageId: session.messages[session.messages.length - 1]._id,
      sessionId: session.sessionId,
    });
  } catch (err) {
    // Remove the optimistically-added user message on failure so state stays consistent
    session.messages.pop();

    const msg = err.message ?? "";
    console.error("[chat/message]", msg);

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

/**
 * DELETE /api/chat/session/:sessionId
 * Deletes a session and all its messages.
 */
router.delete("/chat/session/:sessionId", async (req, res) => {
  try {
    await ChatSession.deleteOne({ sessionId: req.params.sessionId });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[chat/session DELETE]", err.message);
    return res.status(500).json({ error: "Failed to delete session." });
  }
});

export default router;

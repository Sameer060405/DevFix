import { Router } from "express";
import Session from "../models/Session.js";

const router = Router();

const PAGE_SIZE    = 20;
const CODE_LIMIT   = 100_000; // 100 KB max code snapshot
const MSG_LIMIT    = 30;      // max chat messages to persist
const CODE_PER_FIX = 8_000;   // max improvedCode chars per fix

// ─── Auto-title generator ─────────────────────────────────────────────────────

function makeTitle(body) {
  if (body.title?.trim()) return body.title.trim().slice(0, 200);

  const parts = [body.fileName, body.analysisResult?.errorCategory].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  if (body.errorMessage?.trim()) return body.errorMessage.trim().slice(0, 100);
  return "Untitled Session";
}

// ─── Sanitise analysisResult before storing ───────────────────────────────────

function sanitiseAnalysis(raw) {
  if (!raw || typeof raw !== "object") return undefined;
  return {
    rootCause:     typeof raw.rootCause     === "string" ? raw.rootCause     : undefined,
    errorCategory: typeof raw.errorCategory === "string" ? raw.errorCategory : undefined,
    fixes: Array.isArray(raw.fixes)
      ? raw.fixes.slice(0, 3).map((f) => ({
          title:         String(f.title         ?? ""),
          confidence:    Number(f.confidence    ?? 0),
          affectedLines: Array.isArray(f.affectedLines) ? f.affectedLines : [],
          steps:         Array.isArray(f.steps) ? f.steps.slice(0, 5) : [],
          // cap each improvedCode to avoid oversized documents
          improvedCode:  typeof f.improvedCode === "string"
            ? f.improvedCode.slice(0, CODE_PER_FIX)
            : "",
        }))
      : [],
  };
}

// ─── POST /api/save-session ───────────────────────────────────────────────────

router.post("/save-session", async (req, res) => {
  const { fileName, language, codeSnapshot, errorMessage, analysisResult, chatMessages } =
    req.body ?? {};

  if (!codeSnapshot?.trim() && !analysisResult) {
    return res.status(400).json({
      error: "Nothing to save — provide codeSnapshot or analysisResult.",
    });
  }

  try {
    const doc = await Session.create({
      userId:   req.userId ?? "anonymous",
      title:    makeTitle(req.body),
      fileName: fileName?.trim()  || undefined,
      language: language?.trim()  || undefined,
      codeSnapshot: typeof codeSnapshot === "string"
        ? codeSnapshot.slice(0, CODE_LIMIT)
        : undefined,
      errorMessage: typeof errorMessage === "string" && errorMessage.trim()
        ? errorMessage.trim()
        : undefined,
      analysisResult: sanitiseAnalysis(analysisResult),
      chatMessages: Array.isArray(chatMessages)
        ? chatMessages
            .slice(-MSG_LIMIT)
            .filter((m) => m.role && m.content)
            .map((m) => ({ role: m.role, content: String(m.content) }))
        : [],
    });

    return res.status(201).json({ ok: true, sessionId: doc._id, title: doc.title });
  } catch (err) {
    console.error("[save-session]", err.message);
    return res.status(500).json({ error: "Failed to save session." });
  }
});

// ─── GET /api/sessions ────────────────────────────────────────────────────────
// Returns lightweight list (no codeSnapshot / chatMessages / fix.improvedCode)

router.get("/sessions", async (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(400).json({ error: "Missing X-User-Id header." });

  const page  = Math.max(1, parseInt(req.query.page  ?? "1",  10));
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit ?? String(PAGE_SIZE), 10)));
  const skip  = (page - 1) * limit;

  try {
    const [sessions, total] = await Promise.all([
      Session.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        // Exclude large fields from the list view
        .select("-codeSnapshot -chatMessages -analysisResult.fixes.improvedCode")
        .lean(),
      Session.countDocuments({ userId }),
    ]);

    return res.json({ sessions, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("[GET /sessions]", err.message);
    return res.status(500).json({ error: "Failed to fetch sessions." });
  }
});

// ─── GET /api/sessions/:id ────────────────────────────────────────────────────
// Full detail — includes codeSnapshot and chatMessages

router.get("/sessions/:id", async (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(400).json({ error: "Missing X-User-Id header." });

  try {
    const session = await Session.findOne({ _id: req.params.id, userId }).lean();
    if (!session) return res.status(404).json({ error: "Session not found." });
    return res.json(session);
  } catch (err) {
    console.error("[GET /sessions/:id]", err.message);
    return res.status(500).json({ error: "Failed to fetch session." });
  }
});

// ─── DELETE /api/sessions/:id ─────────────────────────────────────────────────

router.delete("/sessions/:id", async (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(400).json({ error: "Missing X-User-Id header." });

  try {
    const { deletedCount } = await Session.deleteOne({ _id: req.params.id, userId });
    if (!deletedCount) return res.status(404).json({ error: "Session not found." });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /sessions/:id]", err.message);
    return res.status(500).json({ error: "Failed to delete session." });
  }
});

export default router;

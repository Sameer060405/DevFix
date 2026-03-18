import { Router } from "express";
import Analysis from "../models/Analysis.js";
import { generateEmbedding } from "../services/embeddings.js";
import { upsertVector } from "../services/pinecone.js";

const router = Router();

/* ── POST /api/save ─────────────────────────────────────────────
   Saves one completed analysis to MongoDB.
   Body: { errorMessage, codeSnippet, rootCause, errorCategory, fixes, optimizations, classificationMethod? }
──────────────────────────────────────────────────────────────── */
router.post("/save", async (req, res) => {
  const { errorMessage, codeSnippet, rootCause, errorCategory, fixes, optimizations, classificationMethod } = req.body ?? {};

  const missing = [];
  if (!errorMessage)                          missing.push("errorMessage");
  if (!codeSnippet)                           missing.push("codeSnippet");
  if (!rootCause)                             missing.push("rootCause");
  if (!errorCategory)                         missing.push("errorCategory");
  if (!Array.isArray(fixes) || !fixes.length) missing.push("fixes");
  if (!optimizations || typeof optimizations !== "object") missing.push("optimizations");

  if (missing.length) {
    return res.status(400).json({ error: `Missing field(s): ${missing.join(", ")}.` });
  }

  try {
    const doc = await Analysis.create({ errorMessage, codeSnippet, rootCause, errorCategory, fixes, optimizations, classificationMethod });

    // Upsert to Pinecone after MongoDB succeeds — fire-and-forget so it never blocks the response
    // Pass the top fix's steps as the legacy `fix` field for backward-compatible vector metadata
    const topFixSteps = fixes[0]?.steps ?? [];
    generateEmbedding(errorMessage)
      .then((embedding) =>
        upsertVector({ id: doc._id.toString(), embedding, errorMessage, rootCause, fix: topFixSteps })
      )
      .catch((err) => console.warn("[pinecone upsert]", err.message));

    return res.status(201).json({ id: doc._id, createdAt: doc.createdAt });
  } catch (err) {
    console.error("[save]", err.message);
    return res.status(500).json({ error: "Failed to save analysis." });
  }
});

/* ── GET /api/history ───────────────────────────────────────────
   Returns the 50 most recent analyses, newest first.
   Each item is stripped down — full details only on demand.
──────────────────────────────────────────────────────────────── */
router.get("/history", async (_req, res) => {
  try {
    const items = await Analysis.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .select("errorMessage rootCause createdAt")  // keep payload small
      .lean();

    return res.json(items);
  } catch (err) {
    console.error("[history]", err.message);
    return res.status(500).json({ error: "Failed to fetch history." });
  }
});

/* ── GET /api/history/:id ───────────────────────────────────────
   Returns a single full analysis by ID (used when clicking a
   history item to restore the result panel).
──────────────────────────────────────────────────────────────── */
router.get("/history/:id", async (req, res) => {
  try {
    const doc = await Analysis.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: "Analysis not found." });
    return res.json(doc);
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(400).json({ error: "Invalid ID format." });
    }
    console.error("[history/:id]", err.message);
    return res.status(500).json({ error: "Failed to fetch analysis." });
  }
});

export default router;

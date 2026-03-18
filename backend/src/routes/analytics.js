import { Router } from "express";
import RequestLog from "../models/RequestLog.js";

const router = Router();

/* ── Shared helpers ────────────────────────────────────────────── */

/** Returns a Date `n` days before now. */
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/**
 * Computes approximate percentile from a sorted array.
 * p = 0.95 → p95, etc.
 */
function percentile(sortedArr, p) {
  if (!sortedArr.length) return 0;
  const idx = Math.ceil(sortedArr.length * p) - 1;
  return sortedArr[Math.min(idx, sortedArr.length - 1)];
}

/* ── GET /api/analytics/summary ────────────────────────────────── */
/**
 * High-level KPIs for the past 24 h and 7 days:
 *   totalRequests, errorCount, errorRate,
 *   avgResponseTime, p95ResponseTime, p99ResponseTime
 */
router.get("/summary", async (req, res) => {
  try {
    const window = req.query.window === "7d" ? daysAgo(7) : daysAgo(1);

    const [agg] = await RequestLog.aggregate([
      { $match: { createdAt: { $gte: window } } },
      {
        $group: {
          _id:            null,
          total:          { $sum: 1 },
          errors:         { $sum: { $cond: [{ $gte: ["$statusCode", 400] }, 1, 0] } },
          avgMs:          { $avg: "$responseTimeMs" },
          allMs:          { $push: "$responseTimeMs" },
        },
      },
      {
        $project: {
          _id:          0,
          total:        1,
          errors:       1,
          avgMs:        { $round: ["$avgMs", 1] },
          allMs:        1,
        },
      },
    ]);

    if (!agg) {
      return res.json({
        total: 0, errors: 0, errorRate: 0,
        avgMs: 0, p95Ms: 0, p99Ms: 0,
      });
    }

    const sorted = [...agg.allMs].sort((a, b) => a - b);

    res.json({
      total:     agg.total,
      errors:    agg.errors,
      errorRate: agg.total ? +((agg.errors / agg.total) * 100).toFixed(1) : 0,
      avgMs:     agg.avgMs,
      p95Ms:     percentile(sorted, 0.95),
      p99Ms:     percentile(sorted, 0.99),
    });
  } catch (err) {
    console.error("[analytics/summary]", err.message);
    res.status(500).json({ error: "Failed to fetch summary." });
  }
});

/* ── GET /api/analytics/routes ─────────────────────────────────── */
/**
 * Per-route breakdown: request count, error count, avg + p95 latency.
 * Sorted by request count descending, limited to top 20.
 */
router.get("/routes", async (req, res) => {
  try {
    const window = req.query.window === "7d" ? daysAgo(7) : daysAgo(1);

    const rows = await RequestLog.aggregate([
      { $match: { createdAt: { $gte: window } } },
      {
        $group: {
          _id:    { method: "$method", path: "$path" },
          count:  { $sum: 1 },
          errors: { $sum: { $cond: [{ $gte: ["$statusCode", 400] }, 1, 0] } },
          avgMs:  { $avg: "$responseTimeMs" },
          allMs:  { $push: "$responseTimeMs" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
      {
        $project: {
          _id:    0,
          method: "$_id.method",
          path:   "$_id.path",
          count:  1,
          errors: 1,
          avgMs:  { $round: ["$avgMs", 1] },
          allMs:  1,
        },
      },
    ]);

    const result = rows.map((r) => {
      const sorted = [...r.allMs].sort((a, b) => a - b);
      return { ...r, p95Ms: percentile(sorted, 0.95), allMs: undefined };
    });

    res.json(result);
  } catch (err) {
    console.error("[analytics/routes]", err.message);
    res.status(500).json({ error: "Failed to fetch route stats." });
  }
});

/* ── GET /api/analytics/timeseries ─────────────────────────────── */
/**
 * Request counts bucketed by hour (last 24 h) or by day (last 7 d).
 * Returns [{ bucket: ISO string, total, errors }]
 */
router.get("/timeseries", async (req, res) => {
  try {
    const sevenDay = req.query.window === "7d";
    const window = sevenDay ? daysAgo(7) : daysAgo(1);

    // Group by day for 7d window, by hour for 24h window
    const dateTrunc = sevenDay
      ? { $dateToString: { format: "%Y-%m-%d",       date: "$createdAt" } }
      : { $dateToString: { format: "%Y-%m-%dT%H:00", date: "$createdAt" } };

    const rows = await RequestLog.aggregate([
      { $match: { createdAt: { $gte: window } } },
      {
        $group: {
          _id:    dateTrunc,
          total:  { $sum: 1 },
          errors: { $sum: { $cond: [{ $gte: ["$statusCode", 400] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, bucket: "$_id", total: 1, errors: 1 } },
    ]);

    res.json(rows);
  } catch (err) {
    console.error("[analytics/timeseries]", err.message);
    res.status(500).json({ error: "Failed to fetch timeseries." });
  }
});

/* ── GET /api/analytics/errors ─────────────────────────────────── */
/**
 * The 50 most recent errors (statusCode >= 400).
 */
router.get("/errors", async (req, res) => {
  try {
    const logs = await RequestLog.find({ statusCode: { $gte: 400 } })
      .sort({ createdAt: -1 })
      .limit(50)
      .select("method path statusCode responseTimeMs errorMessage userId createdAt")
      .lean();

    res.json(logs);
  } catch (err) {
    console.error("[analytics/errors]", err.message);
    res.status(500).json({ error: "Failed to fetch errors." });
  }
});

export default router;

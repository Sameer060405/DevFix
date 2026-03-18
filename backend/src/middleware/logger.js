import RequestLog from "../models/RequestLog.js";

/**
 * Normalises a URL path so analytics group by route shape, not specific IDs.
 * e.g. /api/sessions/507f1f77bcf86cd799439011  →  /api/sessions/:id
 *      /api/chat/session/abc123/message         →  /api/chat/session/:id/message
 */
function normalisePath(rawPath) {
  // Strip query string
  const path = rawPath.split("?")[0];

  return path
    // MongoDB ObjectIds (24 hex chars)
    .replace(/\/[0-9a-f]{24}(\/|$)/gi, "/:id$1")
    // UUIDs
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\/|$)/gi, "/:id$1")
    // Pure numeric segments
    .replace(/\/\d+(\/|$)/g, "/:id$1");
}

/**
 * Express middleware that records timing and status for every request.
 * The DB write is fire-and-forget — it never delays or blocks the response.
 */
export function requestLogger(req, res, next) {
  const start = Date.now();

  res.on("finish", () => {
    const responseTimeMs = Date.now() - start;
    const statusCode = res.statusCode;

    const doc = {
      method:         req.method,
      path:           normalisePath(req.path),
      statusCode,
      responseTimeMs,
      userId:         req.userId ?? null,
      errorMessage:   statusCode >= 400 ? (res.locals.errorMessage ?? null) : null,
      ip:             req.ip ?? req.socket?.remoteAddress ?? null,
      userAgent:      req.headers["user-agent"] ?? null,
    };

    // Non-blocking: log to MongoDB in the background
    RequestLog.create(doc).catch((err) =>
      console.error("[logger] Failed to persist request log:", err.message)
    );

    // Always print to stdout — useful during development
    const colour = statusCode >= 500 ? "\x1b[31m"  // red
                 : statusCode >= 400 ? "\x1b[33m"  // yellow
                 : statusCode >= 300 ? "\x1b[36m"  // cyan
                 :                    "\x1b[32m";  // green
    const reset = "\x1b[0m";
    console.log(
      `${colour}${req.method}${reset} ${doc.path} ${colour}${statusCode}${reset} ${responseTimeMs}ms`
    );
  });

  next();
}

/**
 * Error-capturing middleware (place after route handlers).
 * Stores the error message in res.locals so the finish handler can pick it up.
 */
export function errorLogger(err, req, res, next) {
  res.locals.errorMessage = err.message ?? "Unknown error";
  console.error("[error]", req.method, req.path, err.message);
  next(err);
}

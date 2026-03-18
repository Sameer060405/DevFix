/**
 * userContext.js
 *
 * Extracts the X-User-Id header and attaches it to req.userId.
 * A missing or malformed header is silently treated as anonymous (null).
 *
 * The header value must be a UUID-like alphanumeric string (8–64 chars).
 * This guards against header injection while staying simple.
 */

const USER_ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;

export function extractUserId(req, _res, next) {
  const raw = req.headers["x-user-id"];
  req.userId = raw && USER_ID_PATTERN.test(raw) ? raw : null;
  next();
}

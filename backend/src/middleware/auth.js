import jwt from "jsonwebtoken";

const COOKIE_NAME = "devfix_token";

/**
 * Verifies the JWT stored in the httpOnly cookie.
 * Sets req.userId to the user's MongoDB _id string on success.
 * Returns 401 if the token is missing or invalid.
 */
export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: "Session expired. Please log in again." });
  }
}

/** Generates a signed JWT and sets it as an httpOnly cookie on the response. */
export function setAuthCookie(res, userId) {
  const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  });
}

/** Clears the auth cookie. */
export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "strict" });
}

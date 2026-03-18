import { Router } from "express";
import User from "../models/User.js";
import { requireAuth, setAuthCookie, clearAuthCookie } from "../middleware/auth.js";

const router = Router();

/* ── POST /api/auth/register ──────────────────────────────────── */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const user = await User.create({ name: name.trim(), email, password });

    setAuthCookie(res, user._id.toString());
    res.status(201).json({ ok: true, user });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

/* ── POST /api/auth/login ─────────────────────────────────────── */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    setAuthCookie(res, user._id.toString());
    res.json({ ok: true, user });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

/* ── POST /api/auth/logout ────────────────────────────────────── */
router.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

/* ── GET /api/auth/me ─────────────────────────────────────────── */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      clearAuthCookie(res);
      return res.status(401).json({ error: "Account not found." });
    }
    res.json({ user });
  } catch (err) {
    console.error("Me error:", err.message);
    res.status(500).json({ error: "Could not fetch user." });
  }
});

export default router;

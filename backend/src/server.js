import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { connectDB } from "./db/connect.js";
import { initPinecone } from "./services/pinecone.js";
import { initRedis } from "./services/redis.js";
import { requireAuth } from "./middleware/auth.js";
import { requestLogger, errorLogger } from "./middleware/logger.js";
import authRouter        from "./routes/auth.js";
import analyzeRouter     from "./routes/analyze.js";
import historyRouter     from "./routes/history.js";
import repoAnalyzeRouter from "./routes/repoAnalyze.js";
import chatRouter        from "./routes/chat.js";
import sessionsRouter    from "./routes/sessions.js";
import analyticsRouter   from "./routes/analytics.js";
import interviewRouter   from "./routes/interview.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,   // required for httpOnly cookies
}));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(requestLogger);          // log every request (timing + status → MongoDB)

// Public auth routes — no JWT required
app.use("/api/auth", authRouter);

// All other /api routes require a valid session
app.use("/api", requireAuth);
app.use("/api", analyzeRouter);
app.use("/api", historyRouter);
app.use("/api", repoAnalyzeRouter);
app.use("/api", chatRouter);
app.use("/api", sessionsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api", interviewRouter);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use(errorLogger);            // capture error messages before Express's default handler

async function start() {
  await connectDB();
  await initPinecone(); // non-fatal — logs warning if key missing
  await initRedis();    // non-fatal — context features degrade gracefully if Redis is down
  app.listen(PORT, () => {
    console.log(`DevFix API running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Startup failed:", err.message);
  process.exit(1);
});

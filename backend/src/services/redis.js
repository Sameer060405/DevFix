/**
 * redis.js
 *
 * Singleton Redis client + context helpers.
 *
 * Design principles:
 * - All operations are non-fatal: if Redis is down, every function is a no-op.
 * - The rest of the app must never await these calls in a way that blocks a response.
 * - Context expires after 2 hours of inactivity (refreshed on every write).
 *
 * Per-user Redis schema (keyed by userId UUID):
 *   ctx:{uid}:errors  LIST  – last 5 { errorMessage, category, timestamp }
 *   ctx:{uid}:code    STR   – last analyzed code snippet (≤ 8 000 chars)
 *   ctx:{uid}:chat    LIST  – last 20 { role, content } cross-session messages
 */

import Redis from "ioredis";

// ─── Config ───────────────────────────────────────────────────────────────────

const TTL             = 2 * 60 * 60; // 2 hours in seconds
const MAX_ERRORS      = 5;
const MAX_CHAT        = 20;
const MAX_CODE_CHARS  = 8_000;
const MAX_MSG_CHARS   = 600;   // per chat message stored in context

// ─── Client singleton ─────────────────────────────────────────────────────────

let client    = null;
let available = false;

/**
 * Initialises the Redis connection.
 * Called once from server.js — failure is logged but does NOT crash the server.
 */
export async function initRedis() {
  const url = process.env.REDIS_URL || "redis://localhost:6379";

  client = new Redis(url, {
    lazyConnect:          true,
    maxRetriesPerRequest: 1,
    connectTimeout:       3_000,
    commandTimeout:       2_000,
    enableOfflineQueue:   false,
  });

  client.on("connect",     ()    => { available = true;  console.log("Redis connected:", url); });
  client.on("close",       ()    => { available = false; });
  client.on("error",       (err) => {
    if (available) console.warn("[Redis] error:", err.message);
    available = false;
  });

  try {
    await client.connect();
  } catch (err) {
    console.warn("[Redis] unavailable — context features disabled:", err.message);
  }
}

export function isRedisAvailable() { return available; }

// ─── Key builders ─────────────────────────────────────────────────────────────

const k = {
  errors: (uid) => `ctx:${uid}:errors`,
  code:   (uid) => `ctx:${uid}:code`,
  chat:   (uid) => `ctx:${uid}:chat`,
};

// ─── Safe wrapper ─────────────────────────────────────────────────────────────

async function safe(fn, fallback = null) {
  if (!available) return fallback;
  try {
    return await fn();
  } catch (err) {
    console.warn("[Redis] operation error:", err.message);
    return fallback;
  }
}

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Reads all three context buckets for a user in a single pipeline.
 *
 * @returns {{ recentErrors: object[], lastCode: string|null, recentChat: object[] }}
 */
export async function getUserContext(userId) {
  const empty = { recentErrors: [], lastCode: null, recentChat: [] };
  if (!userId) return empty;

  const result = await safe(async () => {
    const pipeline = client.pipeline();
    pipeline.lrange(k.errors(userId), 0, MAX_ERRORS - 1);
    pipeline.get(k.code(userId));
    pipeline.lrange(k.chat(userId), 0, MAX_CHAT - 1);
    return pipeline.exec();
  });

  if (!result) return empty;

  const parse = (raw) => {
    try { return JSON.parse(raw); } catch { return null; }
  };

  const [[, errorsRaw], [, codeRaw], [, chatRaw]] = result;

  return {
    recentErrors: (errorsRaw  ?? []).map(parse).filter(Boolean),
    lastCode:     codeRaw     ?? null,
    recentChat:   (chatRaw    ?? []).map(parse).filter(Boolean),
  };
}

/**
 * Prepends a new error to the user's recent-errors list.
 * Caps at MAX_ERRORS items, refreshes TTL.
 */
export async function pushError(userId, { errorMessage, category }) {
  if (!userId) return;

  const entry = JSON.stringify({
    errorMessage: String(errorMessage).slice(0, 200),
    category:     String(category),
    timestamp:    new Date().toISOString(),
  });

  await safe(async () => {
    const pipeline = client.pipeline();
    pipeline.lpush(k.errors(userId), entry);
    pipeline.ltrim(k.errors(userId), 0, MAX_ERRORS - 1);
    pipeline.expire(k.errors(userId), TTL);
    await pipeline.exec();
  });
}

/**
 * Stores the user's most-recently analyzed code snippet.
 * Truncates to MAX_CODE_CHARS, refreshes TTL.
 */
export async function setLastCode(userId, code) {
  if (!userId || !code?.trim()) return;

  const stored =
    code.length > MAX_CODE_CHARS
      ? code.slice(0, MAX_CODE_CHARS) + "\n// [truncated]"
      : code;

  await safe(() => client.set(k.code(userId), stored, "EX", TTL));
}

/**
 * Appends messages to the user's cross-session chat context.
 * Accepts an array of { role, content } objects.
 * Caps at MAX_CHAT messages (most-recent at the front), refreshes TTL.
 */
export async function pushChatMessages(userId, messages) {
  if (!userId || !messages?.length) return;

  await safe(async () => {
    const pipeline = client.pipeline();
    // lpush keeps newest at index-0; reverse the array so the last sent message ends up at [0]
    for (const msg of [...messages].reverse()) {
      pipeline.lpush(
        k.chat(userId),
        JSON.stringify({
          role:    msg.role,
          content: String(msg.content).slice(0, MAX_MSG_CHARS),
        })
      );
    }
    pipeline.ltrim(k.chat(userId), 0, MAX_CHAT - 1);
    pipeline.expire(k.chat(userId), TTL);
    await pipeline.exec();
  });
}

/**
 * Removes all context for a user (e.g. on explicit "clear session").
 */
export async function clearUserContext(userId) {
  if (!userId) return;
  await safe(() =>
    client.del(k.errors(userId), k.code(userId), k.chat(userId))
  );
}

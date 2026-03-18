/**
 * githubFetcher.js
 *
 * Fetches a GitHub repository's file tree and relevant source file contents
 * via the GitHub REST API.
 *
 * - Public repos work without auth (60 req/hr limit).
 * - Set GITHUB_TOKEN in .env for private repos or to raise the limit to 5000 req/hr.
 *
 * Exported:
 *   fetchRepo(repoUrl) → { repoMeta, tree, files }
 *     repoMeta : { owner, repo, branch, description, language, stars, forks, truncated }
 *     tree     : string[]  — every file path in the repo
 *     files    : { path, content }[]  — selected source files (within budget)
 */

const GITHUB_API = "https://api.github.com";

/** Hard cap on total fetched content to stay within LLM token limits (~80k chars ≈ 20k tokens). */
const MAX_TOTAL_CHARS  = 80_000;
/** Individual file content is truncated at this size. */
const MAX_FILE_CHARS   = 8_000;
/** Files larger than this in the tree are skipped (GitHub won't inline them anyway). */
const MAX_FILE_BYTES   = 512_000;

// ─── File classification ──────────────────────────────────────────────────────

/** Directories that are never useful for code review. */
const SKIP_DIRS = new Set([
  "node_modules", "dist", "build", ".git", ".next", ".nuxt", ".svelte-kit",
  "__pycache__", ".pytest_cache", "venv", "env", ".venv", ".tox",
  "coverage", ".nyc_output", "vendor", "target", "out", ".gradle",
  ".idea", ".vscode", ".DS_Store",
]);

/** File extensions that represent binary or generated/unreadable content. */
const SKIP_EXTENSIONS = new Set([
  ".lock", ".log", ".map",
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".zip", ".tar", ".gz", ".rar", ".7z",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx",
  ".mp3", ".mp4", ".avi", ".mov",
  ".bin", ".exe", ".dll", ".so", ".dylib",
  ".pyc", ".pyo", ".class",
]);

/** Names that are always fetched first (project-level manifest / docs). */
const HIGH_PRIORITY_NAMES = new Set([
  "readme.md", "readme.txt", "readme",
  "package.json", "pyproject.toml", "setup.py", "requirements.txt",
  "cargo.toml", "go.mod", "go.sum", "pom.xml", "build.gradle",
  "tsconfig.json", "tsconfig.base.json",
  "dockerfile", "docker-compose.yml", "docker-compose.yaml",
  ".env.example", ".env.sample",
  "vite.config.js", "vite.config.ts", "webpack.config.js",
  "next.config.js", "next.config.ts",
]);

/** Entry-point file names that reveal the application's core structure. */
const ENTRY_POINT_NAMES = new Set([
  "index.js", "index.ts", "index.jsx", "index.tsx",
  "main.js",  "main.ts",  "main.jsx",  "main.tsx",
  "app.js",   "app.ts",   "app.jsx",   "app.tsx",
  "server.js","server.ts",
  "main.py",  "app.py",   "__init__.py",
  "main.go",  "main.rs",  "main.java",
]);

/** Extensions we're willing to read as source code. */
const CODE_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
  ".py", ".rb",  ".go", ".rs",  ".java", ".kt", ".kts",
  ".c",  ".cpp", ".cc", ".h",   ".hpp",
  ".cs", ".php", ".swift", ".scala",
  ".vue", ".svelte",
  ".html", ".css", ".scss", ".sass", ".less",
  ".sh",  ".bash", ".zsh", ".fish",
  ".json", ".yaml", ".yml", ".toml", ".ini",
  ".md",  ".txt",
]);

// ─── URL parser ───────────────────────────────────────────────────────────────

/**
 * Extracts owner, repo, and optional branch from a GitHub URL.
 * Handles:
 *   https://github.com/owner/repo
 *   https://github.com/owner/repo.git
 *   https://github.com/owner/repo/tree/branch
 */
export function parseGitHubUrl(url) {
  const cleaned = url.trim().replace(/\.git$/, "");
  const match = cleaned.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+))?/
  );
  if (!match) {
    throw new Error(
      "Invalid GitHub URL. Expected format: https://github.com/owner/repo"
    );
  }
  return { owner: match[1], repo: match[2], branch: match[3] ?? null };
}

// ─── GitHub API helper ────────────────────────────────────────────────────────

function ghHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function ghFetch(path) {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: ghHeaders() });

  if (res.status === 404) {
    throw new Error(
      "Repository not found. Check that the URL is correct and the repo is public."
    );
  }
  if (res.status === 403 || res.status === 429) {
    const rateLimitMsg = process.env.GITHUB_TOKEN
      ? "GitHub API rate limit exceeded. Please wait before retrying."
      : "GitHub API rate limit exceeded. Set GITHUB_TOKEN in backend/.env to increase the limit.";
    throw new Error(rateLimitMsg);
  }
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ─── File selection ───────────────────────────────────────────────────────────

function shouldSkipPath(filePath) {
  const parts = filePath.split("/");

  // Skip if any path segment is a blocked directory
  for (const part of parts) {
    if (SKIP_DIRS.has(part)) return true;
  }

  const name = parts[parts.length - 1].toLowerCase();
  const ext  = name.includes(".") ? "." + name.split(".").pop() : "";

  // Skip binary / generated extensions
  if (SKIP_EXTENSIONS.has(ext)) return true;

  // Skip minified files
  if (name.includes(".min.")) return true;

  // Skip test files (they add noise without value for architecture review)
  if (
    name.includes(".test.") || name.includes(".spec.") ||
    parts.some((p) => p === "__tests__" || p === "test" || p === "tests" || p === "spec")
  ) return true;

  return false;
}

/**
 * Assigns a priority score to a candidate file.
 * Higher score = fetched first. Returns -1 to skip entirely.
 */
function scoreFile({ path, size }) {
  if (shouldSkipPath(path)) return -1;

  const parts = path.split("/");
  const name  = parts[parts.length - 1].toLowerCase();
  const ext   = name.includes(".") ? "." + name.split(".").pop() : "";

  if (!CODE_EXTENSIONS.has(ext) && !HIGH_PRIORITY_NAMES.has(name)) return -1;
  if (size > MAX_FILE_BYTES) return -1;

  let score = 0;

  if (HIGH_PRIORITY_NAMES.has(name))  score += 120;
  if (ENTRY_POINT_NAMES.has(name))    score += 80;

  // Shallower files are more architecturally significant
  const depth = path.split("/").length;
  score += Math.max(0, 30 - depth * 4);

  // Penalise large files (they eat the budget fast)
  if (size > 50_000) score -= 40;
  else if (size > 20_000) score -= 20;
  else if (size > 10_000) score -= 10;

  return score;
}

// ─── Content fetcher ──────────────────────────────────────────────────────────

async function fetchFileContent(owner, repo, branch, filePath) {
  try {
    const data = await ghFetch(
      `/repos/${owner}/${repo}/contents/${filePath.split("/").map(encodeURIComponent).join("/")}?ref=${branch}`
    );

    if (data.encoding !== "base64" || !data.content) return null;

    const raw = Buffer.from(data.content, "base64").toString("utf-8");
    if (raw.length > MAX_FILE_CHARS) {
      return raw.slice(0, MAX_FILE_CHARS) + `\n\n[... truncated at ${MAX_FILE_CHARS} chars ...]`;
    }
    return raw;
  } catch {
    return null; // non-critical — skip unreadable files silently
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetches a GitHub repo and returns structured data for LLM analysis.
 *
 * @param {string} repoUrl  - A GitHub repo URL (https://github.com/owner/repo)
 * @returns {{ repoMeta, tree, files }}
 */
export async function fetchRepo(repoUrl) {
  const { owner, repo, branch: requestedBranch } = parseGitHubUrl(repoUrl);

  // ── 1. Repo metadata ──────────────────────────────────────────────────────
  const repoData = await ghFetch(`/repos/${owner}/${repo}`);

  if (repoData.private && !process.env.GITHUB_TOKEN) {
    throw new Error(
      "This repository is private. Set GITHUB_TOKEN in backend/.env to analyze private repos."
    );
  }

  const branch = requestedBranch || repoData.default_branch;

  // ── 2. File tree ──────────────────────────────────────────────────────────
  const treeData = await ghFetch(
    `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
  );

  const blobs = (treeData.tree ?? []).filter((n) => n.type === "blob");
  const allPaths = blobs.map((n) => n.path);

  // ── 3. Select files to fetch ──────────────────────────────────────────────
  const candidates = blobs
    .map((n) => ({ path: n.path, size: n.size ?? 0, score: scoreFile(n) }))
    .filter((f) => f.score >= 0)
    .sort((a, b) => b.score - a.score);

  // ── 4. Fetch content sequentially within budget ───────────────────────────
  const files = [];
  let totalChars = 0;

  for (const candidate of candidates) {
    if (totalChars >= MAX_TOTAL_CHARS) break;

    const content = await fetchFileContent(owner, repo, branch, candidate.path);
    if (!content) continue;

    files.push({ path: candidate.path, content });
    totalChars += content.length;
  }

  return {
    repoMeta: {
      owner,
      repo,
      branch,
      url: `https://github.com/${owner}/${repo}`,
      description: repoData.description ?? null,
      language:    repoData.language    ?? null,
      stars:       repoData.stargazers_count,
      forks:       repoData.forks_count,
      fileCount:   blobs.length,
      truncated:   treeData.truncated ?? false,
    },
    tree:  allPaths,
    files,
  };
}

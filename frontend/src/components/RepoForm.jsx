import { useState } from "react";

export default function RepoForm({ onAnalyze, loading }) {
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");

  function validateUrl(value) {
    if (!value.trim()) return "Please enter a GitHub repository URL.";
    if (!value.trim().match(/^https?:\/\/github\.com\/[^/]+\/[^/]+/)) {
      return "Must be a GitHub URL, e.g. https://github.com/owner/repo";
    }
    return "";
  }

  function handleSubmit(e) {
    e.preventDefault();
    const err = validateUrl(url);
    if (err) { setUrlError(err); return; }
    setUrlError("");
    onAnalyze(url.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* URL input */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
          <GithubIcon />
          GitHub Repository URL
        </label>

        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setUrlError(""); }}
            placeholder="https://github.com/owner/repo"
            disabled={loading}
            spellCheck={false}
            className={`
              flex-1 px-4 py-3 rounded-xl bg-gray-900 border text-sm text-gray-100
              placeholder:text-gray-600 outline-none transition-all font-mono
              focus:ring-2 focus:ring-indigo-500/40
              disabled:opacity-50 disabled:cursor-not-allowed
              ${urlError ? "border-red-700 focus:border-red-500" : "border-gray-700 focus:border-indigo-500"}
            `}
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="
              px-5 py-3 rounded-xl text-sm font-semibold transition-all
              bg-indigo-600 hover:bg-indigo-500 text-white
              disabled:opacity-40 disabled:cursor-not-allowed
              flex items-center gap-2 shrink-0
            "
          >
            {loading ? <SpinnerIcon /> : <SearchIcon />}
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>

        {urlError && (
          <p className="text-xs text-red-400 pl-1">{urlError}</p>
        )}
      </div>

      {/* Help text */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <CheckDotIcon /> Public repos only (or set GITHUB_TOKEN for private)
        </span>
        <span className="flex items-center gap-1">
          <CheckDotIcon /> Source files are fetched and reviewed by AI
        </span>
        <span className="flex items-center gap-1">
          <CheckDotIcon /> Returns bugs, code smells &amp; improvements
        </span>
      </div>
    </form>
  );
}

function GithubIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57
               0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41
               -1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815
               2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925
               0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96
               -.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24
               2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375
               .81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02
               0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function CheckDotIcon() {
  return (
    <svg className="h-3 w-3 text-indigo-500" fill="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" className="opacity-20" />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

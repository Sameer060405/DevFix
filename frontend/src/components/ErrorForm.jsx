import { useState } from "react";

const EXAMPLE = {
  errorMessage: `TypeError: Cannot read properties of undefined (reading 'map')
    at App (App.jsx:12:18)
    at renderWithHooks (react-dom.development.js:14985:18)`,
  codeSnippet: `function App() {
  const [data, setData] = useState();

  return (
    <ul>
      {data.map(item => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
}`,
};

export default function ErrorForm({ onAnalyze, loading }) {
  const [errorMessage, setErrorMessage] = useState("");
  const [codeSnippet, setCodeSnippet] = useState("");

  const canSubmit = errorMessage.trim() && codeSnippet.trim() && !loading;

  function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    onAnalyze({ errorMessage, codeSnippet });
  }

  function loadExample() {
    setErrorMessage(EXAMPLE.errorMessage);
    setCodeSnippet(EXAMPLE.codeSnippet);
  }

  function clearAll() {
    setErrorMessage("");
    setCodeSnippet("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden"
    >
      {/* Form header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-800">
        <h2 className="font-semibold text-sm text-gray-100">Debug a Problem</h2>
        <div className="flex items-center gap-3">
          {(errorMessage || codeSnippet) && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={loadExample}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Load example
          </button>
        </div>
      </div>

      <div className="p-5 flex flex-col gap-5">
        {/* Error message textarea */}
        <Field
          label="Error Message"
          hint="Paste the full error text or stack trace"
          badge={{ text: "required", color: "red" }}
        >
          <textarea
            value={errorMessage}
            onChange={(e) => setErrorMessage(e.target.value)}
            rows={5}
            spellCheck={false}
            placeholder={`TypeError: Cannot read properties of undefined\n    at App (App.jsx:12)`}
            className="
              w-full font-mono text-sm bg-gray-950 border border-gray-700 rounded-xl p-4
              text-red-300 placeholder-gray-700 resize-none leading-relaxed
              focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50
              transition-colors
            "
          />
        </Field>

        {/* Code snippet textarea */}
        <Field
          label="Code Snippet"
          hint="Paste the relevant code that produced the error"
          badge={{ text: "required", color: "emerald" }}
        >
          <textarea
            value={codeSnippet}
            onChange={(e) => setCodeSnippet(e.target.value)}
            rows={10}
            spellCheck={false}
            placeholder={`function myFunction() {\n  // paste your code here\n}`}
            className="
              w-full font-mono text-sm bg-gray-950 border border-gray-700 rounded-xl p-4
              text-emerald-300 placeholder-gray-700 resize-none leading-relaxed
              focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50
              transition-colors
            "
          />
        </Field>

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit}
          className="
            w-full py-3 px-6 rounded-xl font-semibold text-sm transition-all
            flex items-center justify-center gap-2
            bg-indigo-600 hover:bg-indigo-500 text-white
            disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed
          "
        >
          {loading ? (
            <>
              <Spinner />
              Analyzing with Gemini...
            </>
          ) : (
            <>
              <BugIcon />
              Analyze &amp; Fix
            </>
          )}
        </button>
      </div>
    </form>
  );
}

function Field({ label, hint, badge, children }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
          {label}
        </label>
        {badge && (
          <span
            className={`
              text-[10px] px-1.5 py-0.5 rounded font-medium
              ${badge.color === "red"
                ? "bg-red-950 text-red-400 border border-red-800"
                : "bg-emerald-950 text-emerald-400 border border-emerald-800"}
            `}
          >
            {badge.text}
          </span>
        )}
        {hint && (
          <span className="ml-auto text-xs text-gray-600">{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function BugIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 20h.01M8 20h.01M16 20h.01M5 14H3m18 0h-2M5 9l-2-2m18-0l-2 2
           M9 3l1 3m4-3l-1 3m-4 4h6m-6 4h6m-7 0a5 5 0 0010 0V10a5 5 0 00-10 0v4z" />
    </svg>
  );
}

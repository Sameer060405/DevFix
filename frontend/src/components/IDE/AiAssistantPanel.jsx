import { useState, useEffect, useRef } from "react";
import { useChat } from "../../hooks/useChat.js";

/* ─── Slash commands ─────────────────────────────────────────── */

const SLASH_COMMANDS = [
  { cmd: "/explain",  desc: "Explain this code",        prompt: "Explain what this code does, step by step." },
  { cmd: "/fix",      desc: "Find and fix bugs",         prompt: "What bugs are in this code and how should I fix them?" },
  { cmd: "/optimize", desc: "Optimize performance",      prompt: "How can I optimize this code for performance?" },
  { cmd: "/test",     desc: "Write unit tests",          prompt: "Write unit tests for the main functions in this code." },
  { cmd: "/docs",     desc: "Add JSDoc documentation",  prompt: "Add JSDoc comments to all functions in this code." },
  { cmd: "/refactor", desc: "Suggest refactoring",       prompt: "How can I refactor this code to be cleaner and more maintainable?" },
  { cmd: "/review",   desc: "Code review",               prompt: "Do a code review of this file and highlight any issues." },
];

/* ─── Main component ─────────────────────────────────────────── */

/**
 * Copilot-style AI assistant panel for the IDE.
 *
 * Props:
 *   currentFile     { name, path, lang, content } | null
 *   analysisResult  result from useAnalyzeError — shown as collapsible suggestions
 *   onInsertCode    (code: string) => void — replaces active editor content
 */
export default function AiAssistantPanel({ currentFile, analysisResult, onInsertCode }) {
  const {
    messages, sending, bootstrapping, error,
    send, setCodeContext, clearSession,
  } = useChat();

  const [input,           setInput]           = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(true);
  const [slashOpen,       setSlashOpen]       = useState(false);

  const bottomRef      = useRef(null);
  const inputRef       = useRef(null);
  const lastSyncedPath = useRef(null);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // ── Sync current file content to chat context on file switch ───────────────
  // (only fires when the active path changes, not on every keystroke)
  useEffect(() => {
    if (!currentFile || currentFile.path === lastSyncedPath.current) return;
    lastSyncedPath.current = currentFile.path;
    setCodeContext(currentFile.content ?? "");
  }, [currentFile?.path, setCodeContext]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Input handling ─────────────────────────────────────────────────────────
  function handleInputChange(val) {
    setInput(val);
    setSlashOpen(val.startsWith("/") && val.length > 0);
  }

  function handleKeyDown(e) {
    if (e.key === "Escape" && slashOpen) { setSlashOpen(false); return; }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  async function handleSend(text) {
    const msg = (text ?? input).trim();
    if (!msg || sending || bootstrapping) return;
    setInput("");
    setSlashOpen(false);
    await send(msg);
    inputRef.current?.focus();
  }

  function applySlashCommand(prompt) {
    setInput("");
    setSlashOpen(false);
    handleSend(prompt);
  }

  const fixes    = analysisResult?.fixes ?? [];
  const isEmpty  = messages.length === 0 && !bootstrapping;
  const slashQuery = input.startsWith("/") ? input : "";
  const slashMatches = SLASH_COMMANDS.filter((c) =>
    c.cmd.startsWith(slashQuery) || slashQuery === "/"
  );

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-[13px] overflow-hidden">

      {/* ── Panel header ─────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-3 h-9 border-b border-white/[0.07] bg-[#252526]">
        <div className="flex items-center gap-2">
          <SparkleIcon />
          <span className="text-[12px] font-semibold text-gray-200 tracking-tight">DevFix AI</span>
          {currentFile && (
            <span className="text-[10px] text-gray-600 truncate max-w-[110px]" title={currentFile.path}>
              · {currentFile.name}
            </span>
          )}
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearSession}
            title="Start new chat"
            className="text-[10px] text-gray-600 hover:text-gray-300 px-2 py-1 rounded hover:bg-white/[0.06] transition-colors"
          >
            New chat
          </button>
        )}
      </div>

      {/* ── Analysis suggestions (collapsible) ───────────────────── */}
      {fixes.length > 0 && (
        <AnalysisSuggestions
          fixes={fixes}
          rootCause={analysisResult?.rootCause}
          open={suggestionsOpen}
          onToggle={() => setSuggestionsOpen((v) => !v)}
          onApply={onInsertCode}
        />
      )}

      {/* ── Message list ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto flex flex-col">

        {bootstrapping && <BootstrapSkeleton />}

        {isEmpty && (
          <EmptyState
            currentFile={currentFile}
            hasSuggestions={fixes.length > 0}
            onQuickAction={handleSend}
          />
        )}

        {!bootstrapping && messages.map((msg, i) => (
          <MessageRow
            key={msg._id ?? i}
            message={msg}
            onInsert={onInsertCode}
          />
        ))}

        {sending && <TypingRow />}

        {error && (
          <div className="mx-3 mb-3 px-3 py-2 rounded-md bg-red-950/40 border border-red-800/50 text-[11px] text-red-300 leading-relaxed">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input area ───────────────────────────────────────────── */}
      <div className="shrink-0 p-3 border-t border-white/[0.07]">

        {/* File context pill */}
        {currentFile && (
          <div className="flex items-center gap-1.5 mb-2 text-[10px] text-gray-600">
            <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
            </svg>
            <span className="truncate">{currentFile.path}</span>
          </div>
        )}

        {/* Slash command popup */}
        {slashOpen && slashMatches.length > 0 && (
          <div className="mb-2 bg-[#2d2d2d] border border-white/[0.10] rounded-lg overflow-hidden shadow-xl">
            {slashMatches.map((c) => (
              <button
                key={c.cmd}
                onMouseDown={(e) => { e.preventDefault(); applySlashCommand(c.prompt); }}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/[0.06] transition-colors text-left"
              >
                <span className="text-[12px] font-mono text-indigo-400 shrink-0">{c.cmd}</span>
                <span className="text-[11px] text-gray-500 truncate">{c.desc}</span>
              </button>
            ))}
          </div>
        )}

        {/* Textarea + send button */}
        <div className="flex items-end gap-2 bg-[#2d2d2d] rounded-lg border border-white/[0.08] focus-within:border-indigo-500/60 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending || bootstrapping}
            placeholder={bootstrapping ? "Loading session…" : "Ask anything, or type / for commands"}
            rows={1}
            className="flex-1 bg-transparent resize-none text-[12px] text-gray-200 placeholder-gray-600 px-3 py-2.5 focus:outline-none disabled:opacity-50 max-h-32 overflow-y-auto leading-relaxed"
            onInput={(e) => {
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 128) + "px";
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || sending || bootstrapping}
            className="shrink-0 m-1.5 w-7 h-7 rounded flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 disabled:bg-transparent disabled:text-gray-700 disabled:cursor-not-allowed text-white transition-colors"
            title="Send (Enter)"
          >
            {sending ? <MiniSpinner /> : <SendIcon />}
          </button>
        </div>

        <p className="text-[10px] text-gray-700 mt-1.5 px-0.5">
          Enter to send · Shift+Enter for newline · Type <span className="text-gray-600">/</span> for commands
        </p>
      </div>
    </div>
  );
}

/* ─── Analysis suggestions panel ────────────────────────────── */

function AnalysisSuggestions({ fixes, rootCause, open, onToggle, onApply }) {
  return (
    <div className="shrink-0 border-b border-white/[0.07] bg-[#252526]">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-gray-400 hover:text-gray-200 transition-colors"
      >
        <svg className="h-3.5 w-3.5 text-amber-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
        </svg>
        <span className="font-medium">Analysis Results</span>
        <span className="ml-1 text-[10px] bg-amber-700/40 text-amber-300 px-1.5 py-0.5 rounded-full">
          {fixes.length} {fixes.length === 1 ? "fix" : "fixes"}
        </span>
        <span className="ml-auto text-gray-600 text-[10px]">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 flex flex-col gap-2">
          {rootCause && (
            <p className="text-[11px] text-gray-500 leading-relaxed border-l-2 border-gray-700 pl-2.5 italic">
              {rootCause.length > 200 ? rootCause.slice(0, 200) + "…" : rootCause}
            </p>
          )}
          {fixes.map((fix, i) => (
            <FixCard key={i} fix={fix} rank={i} onApply={onApply} />
          ))}
        </div>
      )}
    </div>
  );
}

function FixCard({ fix, rank, onApply }) {
  const [expanded, setExpanded] = useState(rank === 0);
  const conf  = fix.confidence;
  const dot   = conf >= 80 ? "bg-red-500"    : conf >= 50 ? "bg-yellow-500"   : "bg-blue-400";
  const label = conf >= 80 ? "text-red-400"  : conf >= 50 ? "text-yellow-400" : "text-blue-400";

  return (
    <div className="rounded-md border border-white/[0.07] overflow-hidden bg-[#1e1e1e]/60">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-white/[0.03] transition-colors"
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
        <span className="flex-1 text-[11px] text-gray-300 truncate">{fix.title}</span>
        <span className={`text-[10px] font-semibold shrink-0 ${label}`}>{conf}%</span>
        <span className="text-gray-700 text-[10px] ml-1">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.06] px-2.5 py-2.5 flex flex-col gap-2">
          {(fix.steps ?? []).slice(0, 2).map((step, i) => (
            <p key={i} className="text-[11px] text-gray-500 leading-relaxed">
              <span className="text-gray-600 mr-1">{i + 1}.</span>{step}
            </p>
          ))}
          {fix.improvedCode && (
            <button
              onClick={() => onApply?.(fix.improvedCode)}
              className="self-start flex items-center gap-1.5 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 mt-1 transition-colors group"
            >
              <svg className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Apply fix to editor
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Empty state ────────────────────────────────────────────── */

const QUICK_ACTIONS = [
  { label: "Explain this code" },
  { label: "Find bugs"         },
  { label: "Optimize"          },
  { label: "Add tests"         },
];

function EmptyState({ currentFile, hasSuggestions, onQuickAction }) {
  // Map label → prompt when sending
  const prompts = {
    "Explain this code": "Explain what this code does, step by step.",
    "Find bugs":         "Find potential bugs and issues in this code.",
    "Optimize":          "How can I optimize the performance of this code?",
    "Add tests":         "Write unit tests for the main functions in this code.",
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 px-5 py-8 text-center">
      <div className="w-10 h-10 rounded-xl bg-indigo-950/50 border border-indigo-800/40 flex items-center justify-center">
        <SparkleIcon large />
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-[13px] font-medium text-gray-200">
          {currentFile ? `Chatting about ${currentFile.name}` : "What can I help with?"}
        </p>
        <p className="text-[11px] text-gray-600 leading-relaxed max-w-[200px]">
          {hasSuggestions
            ? "Analysis results are ready above. Ask questions or apply a fix."
            : "Ask questions about your code, get explanations, or request fixes."}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 justify-center max-w-[230px]">
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.label}
            onClick={() => onQuickAction(prompts[a.label])}
            className="text-[11px] px-2.5 py-1 rounded-full border border-white/[0.10] text-gray-400 hover:text-gray-200 hover:border-indigo-700/60 hover:bg-indigo-950/30 transition-all"
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Message row (flat Copilot-style layout) ────────────────── */

function MessageRow({ message, onInsert }) {
  const isUser = message.role === "user";

  return (
    <div className={`px-3 py-3.5 flex gap-3 ${isUser ? "" : "bg-[#252526]/50"}`}>
      {/* Avatar */}
      <div className={`
        shrink-0 w-5 h-5 rounded flex items-center justify-center mt-0.5
        ${isUser
          ? "bg-gray-700 text-gray-300 text-[9px] font-bold"
          : "bg-indigo-800/70 text-indigo-200"
        }
      `}>
        {isUser ? "U" : <SparkleIconTiny />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
          {isUser ? "You" : "DevFix AI"}
        </p>
        <MessageContent content={message.content} onInsert={isUser ? null : onInsert} />
        {message.createdAt && (
          <p className="text-[10px] text-gray-700 mt-2">
            {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Message content renderer ───────────────────────────────── */

function MessageContent({ content, onInsert }) {
  const parts = splitByCodeBlocks(content);
  return (
    <div className="flex flex-col gap-2">
      {parts.map((part, i) =>
        part.type === "code"
          ? <CodeBlock key={i} lang={part.lang} code={part.code} onInsert={onInsert} />
          : <InlineText key={i} text={part.text} />
      )}
    </div>
  );
}

function InlineText({ text }) {
  if (!text.trim()) return null;
  // Render inline `code` spans
  const segments = text.split(/(`[^`\n]+`)/g);
  return (
    <p className="text-[12px] text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
      {segments.map((seg, i) =>
        seg.startsWith("`") && seg.endsWith("`") && seg.length > 2 ? (
          <code
            key={i}
            className="px-1 py-0.5 rounded bg-[#3c3c3c] font-mono text-[11px] text-emerald-300 border border-white/[0.08]"
          >
            {seg.slice(1, -1)}
          </code>
        ) : seg
      )}
    </p>
  );
}

function CodeBlock({ lang, code, onInsert }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-md overflow-hidden border border-white/[0.08]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#2d2d2d] border-b border-white/[0.07]">
        <span className="text-[10px] font-mono text-gray-500">{lang || "code"}</span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={copy}
            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
              copied ? "text-emerald-400" : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.05]"
            }`}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          {onInsert && (
            <button
              onClick={() => onInsert(code)}
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/40 transition-colors"
              title="Apply to Editor — replaces current file content"
            >
              {/* small insert-into-editor icon */}
              <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Apply to Editor
            </button>
          )}
        </div>
      </div>
      {/* Code */}
      <pre className="px-3 py-2.5 overflow-x-auto text-[11px] font-mono text-emerald-300 bg-[#1e1e1e] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/* ─── Typing indicator ───────────────────────────────────────── */

function TypingRow() {
  return (
    <div className="px-3 py-3.5 flex gap-3 bg-[#252526]/50">
      <div className="shrink-0 w-5 h-5 rounded bg-indigo-800/70 flex items-center justify-center mt-0.5">
        <SparkleIconTiny />
      </div>
      <div className="flex-1">
        <p className="text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">DevFix AI</p>
        <div className="flex items-center gap-1.5 h-5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-gray-600 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Bootstrap skeleton ─────────────────────────────────────── */

function BootstrapSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4 animate-pulse">
      <div className="flex gap-3">
        <div className="w-5 h-5 rounded bg-gray-800 shrink-0" />
        <div className="flex flex-col gap-2 flex-1">
          <div className="h-2 w-12 rounded bg-gray-800" />
          <div className="h-10 rounded bg-gray-800" />
        </div>
      </div>
      <div className="flex gap-3">
        <div className="w-5 h-5 rounded bg-gray-800 shrink-0" />
        <div className="flex flex-col gap-2 flex-1">
          <div className="h-2 w-16 rounded bg-gray-800" />
          <div className="h-16 rounded bg-gray-800" />
        </div>
      </div>
    </div>
  );
}

/* ─── Code block splitter ────────────────────────────────────── */

function splitByCodeBlocks(content) {
  const parts  = [];
  const regex  = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", text: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: "code", lang: match[1] || "", code: match[2] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({ type: "text", text: content.slice(lastIndex) });
  }

  return parts.length ? parts : [{ type: "text", text: content }];
}

/* ─── Icons ──────────────────────────────────────────────────── */

function SparkleIcon({ large }) {
  const cls = large ? "h-5 w-5 text-indigo-400" : "h-3.5 w-3.5 text-indigo-400";
  return (
    <svg className={cls} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" />
    </svg>
  );
}

function SparkleIconTiny() {
  return (
    <svg className="h-3 w-3 text-indigo-300" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  );
}

function MiniSpinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

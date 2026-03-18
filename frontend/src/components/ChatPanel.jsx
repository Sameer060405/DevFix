import { useState, useEffect, useRef } from "react";
import { useChat } from "../hooks/useChat.js";

export default function ChatPanel({ className }) {
  const {
    title, messages, codeContext,
    sending, bootstrapping, error,
    send, setCodeContext, clearSession,
  } = useChat();

  const [input,          setInput]          = useState("");
  const [contextOpen,    setContextOpen]    = useState(false);
  const [contextDraft,   setContextDraft]   = useState("");
  const [contextSaving,  setContextSaving]  = useState(false);

  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // Sync draft when context panel opens
  useEffect(() => {
    if (contextOpen) setContextDraft(codeContext);
  }, [contextOpen, codeContext]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending || bootstrapping) return;
    setInput("");
    await send(text);
    inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleSaveContext() {
    setContextSaving(true);
    await setCodeContext(contextDraft);
    setContextSaving(false);
    setContextOpen(false);
  }

  const isEmpty = messages.length === 0 && !bootstrapping;

  return (
    <div className={className ?? "flex flex-col h-[calc(100vh-12rem)] min-h-[500px] bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden"}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <ChatBubbleIcon />
          <span className="font-semibold text-sm text-gray-100 truncate">
            {bootstrapping ? "Loading…" : title}
          </span>
        </div>

        {/* Code context toggle */}
        <button
          onClick={() => setContextOpen((v) => !v)}
          title="Set code context"
          className={`
            flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all
            ${codeContext
              ? "bg-indigo-950/60 border-indigo-700/60 text-indigo-400 hover:brightness-110"
              : "bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600"
            }
          `}
        >
          <CodeIcon />
          {codeContext ? "Context set" : "Add code"}
        </button>

        {/* New chat */}
        {messages.length > 0 && (
          <button
            onClick={clearSession}
            title="Start a new chat"
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors px-2 py-1.5 rounded-lg hover:bg-gray-800"
          >
            New chat
          </button>
        )}
      </div>

      {/* ── Code context panel (collapsible) ────────────────────────────── */}
      {contextOpen && (
        <div className="border-b border-indigo-800/60 bg-indigo-950/20 shrink-0 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5">
              <CodeIcon /> Code Context
            </span>
            <span className="text-xs text-gray-600">
              Paste the code you want to discuss — the AI will refer to it throughout this session
            </span>
          </div>
          <textarea
            ref={textareaRef}
            value={contextDraft}
            onChange={(e) => setContextDraft(e.target.value)}
            rows={8}
            spellCheck={false}
            placeholder={"// Paste your code here…\nfunction example() {\n  // …\n}"}
            className="
              w-full font-mono text-xs bg-gray-950 border border-indigo-800/60 rounded-xl p-3
              text-emerald-300 placeholder-gray-700 resize-none leading-relaxed
              focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40
              transition-colors
            "
          />
          <div className="flex items-center gap-2 justify-end">
            {codeContext && (
              <button
                onClick={() => { setContextDraft(""); }}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-3 py-1.5"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => setContextOpen(false)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-3 py-1.5"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveContext}
              disabled={contextSaving}
              className="
                text-xs font-semibold px-4 py-1.5 rounded-lg transition-all
                bg-indigo-600 hover:bg-indigo-500 text-white
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              {contextSaving ? "Saving…" : "Save Context"}
            </button>
          </div>
        </div>
      )}

      {/* ── Message list ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 scroll-smooth">

        {/* Bootstrap skeleton */}
        {bootstrapping && (
          <div className="flex flex-col gap-3 animate-pulse">
            <div className="self-end h-8 w-48 rounded-2xl bg-gray-800" />
            <div className="self-start h-16 w-72 rounded-2xl bg-gray-800" />
            <div className="self-end h-8 w-36 rounded-2xl bg-gray-800" />
            <div className="self-start h-24 w-80 rounded-2xl bg-gray-800" />
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-950/60 border border-indigo-800/60 flex items-center justify-center">
              <ChatBubbleIcon large />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-gray-300">Ask anything about your code</p>
              <p className="text-xs text-gray-600 max-w-xs">
                Paste code using the <span className="text-indigo-400">Add code</span> button, then ask questions — the AI remembers the whole conversation.
              </p>
            </div>
            <div className="flex flex-col gap-2 mt-2 text-left w-full max-w-sm">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(s); inputRef.current?.focus(); }}
                  className="text-xs text-left px-3 py-2 rounded-xl border border-gray-800 bg-gray-900/60 hover:border-gray-700 hover:bg-gray-800/60 text-gray-400 hover:text-gray-200 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {!bootstrapping && messages.map((msg) => (
          <MessageBubble key={msg._id} message={msg} />
        ))}

        {/* Typing indicator */}
        {sending && <TypingIndicator />}

        {/* Error toast */}
        {error && (
          <div className="self-stretch rounded-xl border border-red-800/60 bg-red-950/30 px-4 py-3 text-xs text-red-300 flex items-start gap-2">
            <AlertIcon />
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-gray-800 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={sending || bootstrapping}
            placeholder={bootstrapping ? "Loading session…" : "Ask a question… (Enter to send, Shift+Enter for newline)"}
            className="
              flex-1 font-sans text-sm bg-gray-950 border border-gray-700 rounded-xl px-4 py-3
              text-gray-100 placeholder-gray-600 resize-none leading-relaxed
              focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors max-h-40 overflow-y-auto
            "
            style={{ height: "auto", minHeight: "3rem" }}
            onInput={(e) => {
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending || bootstrapping}
            className="
              shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all
              bg-indigo-600 hover:bg-indigo-500 text-white
              disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed
            "
            title="Send (Enter)"
          >
            {sending ? <SpinnerIcon /> : <SendIcon />}
          </button>
        </div>
        <p className="text-[10px] text-gray-700 mt-1.5 pl-1">
          Enter to send · Shift+Enter for newline · Conversation stored for 30 days
        </p>
      </div>
    </div>
  );
}

/* ─── Message bubble ─────────────────────────────────────────── */

function MessageBubble({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div className={`
        shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold
        ${isUser
          ? "bg-indigo-600 text-white"
          : "bg-gray-700 text-gray-300"
        }
      `}>
        {isUser ? "U" : "AI"}
      </div>

      {/* Bubble */}
      <div className={`
        max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed
        ${isUser
          ? "bg-indigo-600/20 border border-indigo-700/40 text-gray-100 rounded-tr-sm"
          : "bg-gray-800/60 border border-gray-700/60 text-gray-200 rounded-tl-sm"
        }
      `}>
        <MessageContent content={message.content} />
        {message.createdAt && (
          <p className={`text-[10px] mt-1.5 ${isUser ? "text-indigo-400/60 text-right" : "text-gray-600"}`}>
            {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Message content renderer ───────────────────────────────── */
// Splits on fenced code blocks, renders code with monospace styling.

function MessageContent({ content }) {
  const parts = splitByCodeBlocks(content);

  return (
    <div className="flex flex-col gap-2">
      {parts.map((part, i) =>
        part.type === "code" ? (
          <CodeBlock key={i} lang={part.lang} code={part.code} />
        ) : (
          <InlineText key={i} text={part.text} />
        )
      )}
    </div>
  );
}

function InlineText({ text }) {
  // Render inline code spans and plain paragraphs
  const segments = text.split(/(`[^`]+`)/g);
  return (
    <p className="whitespace-pre-wrap break-words">
      {segments.map((seg, i) =>
        seg.startsWith("`") && seg.endsWith("`") && seg.length > 2 ? (
          <code key={i} className="px-1 py-0.5 rounded bg-gray-900 font-mono text-xs text-emerald-300 border border-gray-700">
            {seg.slice(1, -1)}
          </code>
        ) : (
          seg
        )
      )}
    </p>
  );
}

function CodeBlock({ lang, code }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl overflow-hidden border border-gray-700 text-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900 border-b border-gray-700">
        <span className="font-mono text-gray-500">{lang || "code"}</span>
        <button
          onClick={copy}
          className={`text-[10px] px-2 py-0.5 rounded transition-all ${copied ? "text-emerald-400" : "text-gray-500 hover:text-gray-300"}`}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto font-mono text-emerald-300 bg-gray-950 leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * Splits a message string into alternating text/code segments.
 * Handles ```lang\n...``` fenced blocks.
 */
function splitByCodeBlocks(content) {
  const parts = [];
  const regex = /```(\w*)\n?([\s\S]*?)```/g;
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

/* ─── Typing indicator ───────────────────────────────────────── */

function TypingIndicator() {
  return (
    <div className="flex gap-2.5 flex-row">
      <div className="shrink-0 w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-[11px] font-bold text-gray-300">
        AI
      </div>
      <div className="bg-gray-800/60 border border-gray-700/60 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Suggestion prompts ─────────────────────────────────────── */

const SUGGESTIONS = [
  "What does this code do?",
  "Are there any bugs in this code?",
  "How can I improve the performance?",
  "Explain the logic step by step",
];

/* ─── Icons ──────────────────────────────────────────────────── */

function ChatBubbleIcon({ large }) {
  const cls = large ? "h-6 w-6 text-indigo-400" : "h-4 w-4 text-gray-400";
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0
           11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0
           01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337
           A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0
           00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556
           4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999
           12zm0 0h7.5" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0 mt-0.5 text-red-400" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  );
}

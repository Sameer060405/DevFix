import { useState } from "react";

/* ─── Difficulty colours ─────────────────────────────────────── */

const DIFF_STYLE = {
  easy:   { badge: "bg-emerald-900/50 border-emerald-700/60 text-emerald-300", dot: "bg-emerald-400" },
  medium: { badge: "bg-amber-900/50   border-amber-700/60   text-amber-300",   dot: "bg-amber-400"   },
  hard:   { badge: "bg-red-900/50     border-red-700/60     text-red-300",     dot: "bg-red-400"     },
};

const TYPE_LABEL = {
  understanding: "Understanding",
  technical:     "Technical",
  edge_case:     "Edge Cases",
  optimization:  "Optimization",
  system_design: "System Design",
};

/* ─── Score colour ───────────────────────────────────────────── */

function scoreColor(score) {
  if (score >= 8) return "text-emerald-400";
  if (score >= 5) return "text-amber-400";
  return "text-red-400";
}

function scoreBg(score) {
  if (score >= 8) return "bg-emerald-500";
  if (score >= 5) return "bg-amber-500";
  return "bg-red-500";
}

/* ─── Timer formatter ────────────────────────────────────────── */

function fmt(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/* ─── Main component ─────────────────────────────────────────── */

/**
 * Props:
 *   interview  — return value from useInterview()
 *   onClose    — () => void  — hides the panel
 */
export default function InterviewPanel({ interview, onClose }) {
  const {
    state, projectSummary, techStack,
    currentQuestion, currentIndex, progress,
    evaluations, currentEval,
    totalScore, maxScore,
    timer, error,
    startInterview, submitAnswer, acceptFollowUp, nextQuestion, resetInterview,
  } = interview;

  // Passed in from parent (IDELayout) via a ref prop so we don't need it here
  // — startInterview is called from the robot button with files.

  return (
    <div className="flex flex-col h-full bg-[#1a1a2e] text-[13px] overflow-hidden">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-3 h-9 border-b border-white/[0.07] bg-[#16213e]">
        <div className="flex items-center gap-2">
          <RobotIcon small />
          <span className="text-[12px] font-semibold text-violet-200 tracking-tight">Interview Agent</span>
          {state !== "IDLE" && state !== "ANALYZING" && (
            <span className="text-[10px] text-gray-500 font-mono">
              Q {progress.current}/{progress.total}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Timer — visible while asking */}
          {(state === "ASKING" || state === "EVALUATING") && (
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
              timer > 180 ? "text-red-400 border-red-800/60 bg-red-950/30" : "text-gray-500 border-gray-700/60"
            }`}>
              ⏱ {fmt(timer)}
            </span>
          )}

          {state !== "IDLE" && (
            <button
              onClick={() => { resetInterview(); }}
              title="End interview"
              className="text-[10px] text-gray-600 hover:text-gray-300 px-2 py-1 rounded hover:bg-white/[0.06] transition-colors"
            >
              End
            </button>
          )}

          <button
            onClick={onClose}
            title="Close panel"
            className="text-gray-600 hover:text-gray-300 p-1 rounded hover:bg-white/[0.06] transition-colors"
          >
            <XIcon />
          </button>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* ── IDLE ─────────────────────────────────────────────── */}
        {state === "IDLE" && <IdleScreen />}

        {/* ── ANALYZING ────────────────────────────────────────── */}
        {state === "ANALYZING" && (
          <div className="flex flex-col items-center justify-center gap-5 h-full px-6 py-12 text-center">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-2 border-violet-700/40 border-t-violet-400 animate-spin" />
              <div className="absolute inset-2 rounded-full bg-violet-950/60 flex items-center justify-center">
                <RobotIcon />
              </div>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-gray-200 mb-1">Analysing your project…</p>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Reading code structure, detecting patterns,<br />generating tailored questions.
              </p>
            </div>
            <div className="flex flex-col gap-1.5 w-full max-w-[200px]">
              {["Reading files", "Detecting tech stack", "Crafting questions"].map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse"
                    style={{ animationDelay: `${i * 300}ms` }} />
                  <span className="text-[11px] text-gray-600">{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ASKING ───────────────────────────────────────────── */}
        {state === "ASKING" && currentQuestion && (
          <AskingView
            question={currentQuestion}
            progress={progress}
            projectSummary={projectSummary}
            techStack={techStack}
            onSubmit={submitAnswer}
            error={error}
          />
        )}

        {/* ── EVALUATING ───────────────────────────────────────── */}
        {state === "EVALUATING" && (
          <div className="flex flex-col items-center justify-center gap-4 h-full px-6 py-12 text-center">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-2 border-indigo-700/40 border-t-indigo-400 animate-spin" />
              <div className="absolute inset-2 rounded-full bg-indigo-950/60 flex items-center justify-center">
                <EvalIcon />
              </div>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-gray-200 mb-1">Evaluating your answer…</p>
              <p className="text-[11px] text-gray-600">Scoring correctness, depth, and clarity.</p>
            </div>
          </div>
        )}

        {/* ── FEEDBACK ─────────────────────────────────────────── */}
        {state === "FEEDBACK" && currentEval && currentQuestion && (
          <FeedbackView
            evaluation={currentEval}
            question={currentQuestion}
            progress={progress}
            isLast={progress.current >= progress.total && !currentEval.followUpQuestion}
            onAcceptFollowUp={acceptFollowUp}
            onNext={nextQuestion}
          />
        )}

        {/* ── COMPLETED ────────────────────────────────────────── */}
        {state === "COMPLETED" && (
          <CompletedView
            evaluations={evaluations}
            totalScore={totalScore}
            maxScore={maxScore}
            techStack={techStack}
            onReset={resetInterview}
          />
        )}

        {/* Global error banner */}
        {error && state !== "ASKING" && state !== "FEEDBACK" && (
          <div className="m-3 px-3 py-2 rounded-md bg-red-950/40 border border-red-800/50 text-[11px] text-red-300 leading-relaxed">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Idle screen ────────────────────────────────────────────── */

function IdleScreen() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 px-5 py-10 text-center h-full">
      <div className="w-14 h-14 rounded-2xl bg-violet-950/60 border border-violet-800/50 flex items-center justify-center">
        <RobotIcon large />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[14px] font-semibold text-gray-100">Interview Agent</p>
        <p className="text-[11px] text-gray-500 leading-relaxed max-w-[210px]">
          Click the robot button to start a structured technical interview based on your project's code.
        </p>
      </div>

      <div className="flex flex-col gap-2 text-left w-full max-w-[220px]">
        {[
          ["📂", "Reads your project files"],
          ["🧠", "Generates 5 tailored questions"],
          ["📊", "Evaluates depth & correctness"],
          ["🏆", "Final score + improvement plan"],
        ].map(([icon, text]) => (
          <div key={text} className="flex items-center gap-2.5">
            <span className="text-[13px]">{icon}</span>
            <span className="text-[11px] text-gray-500">{text}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-gray-700 max-w-[200px] leading-relaxed">
        Use the floating robot button (bottom-right of the editor) to begin.
      </p>
    </div>
  );
}

/* ─── Asking view ────────────────────────────────────────────── */

function AskingView({ question, progress, techStack, onSubmit, error }) {
  const [answer, setAnswer] = useState("");
  const diff = DIFF_STYLE[question.difficulty] ?? DIFF_STYLE.medium;

  function handleSubmit() {
    const text = answer.trim();
    if (!text) return;
    onSubmit(text);
  }

  return (
    <div className="flex flex-col gap-0 h-full">
      {/* Progress bar */}
      <div className="h-0.5 bg-gray-800 shrink-0">
        <div
          className="h-full bg-violet-500 transition-all duration-500"
          style={{ width: `${(progress.current / progress.total) * 100}%` }}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap">
          {question.isFollowUp && (
            <span className="text-[10px] px-2 py-0.5 rounded border bg-violet-950/50 border-violet-700/60 text-violet-300">
              ↩ Follow-up
            </span>
          )}
          <span className={`text-[10px] px-2 py-0.5 rounded border ${diff.badge}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${diff.dot}`} />
            {question.difficulty}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded border border-gray-700/60 text-gray-500">
            {TYPE_LABEL[question.type] ?? question.type}
          </span>
          {techStack.length > 0 && (
            <span className="text-[10px] text-gray-600 truncate">
              {techStack.slice(0, 3).join(" · ")}
            </span>
          )}
        </div>

        {/* Question */}
        <div className="rounded-xl border border-violet-800/30 bg-violet-950/20 p-4">
          <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-wider mb-2">Question {progress.current}/{progress.total}</p>
          <p className="text-[13px] text-gray-100 leading-relaxed">{question.question}</p>
        </div>

        {/* Tips */}
        <div className="rounded-lg bg-gray-900/40 border border-gray-800/60 px-3 py-2.5">
          <p className="text-[10px] text-gray-600 leading-relaxed">
            💡 Take your time — explain your reasoning clearly. Reference specific code where relevant.
          </p>
        </div>
      </div>

      {/* Answer input fixed at bottom */}
      <div className="shrink-0 p-3 border-t border-white/[0.06]">
        {error && (
          <div className="mb-2 px-3 py-2 rounded-md bg-red-950/40 border border-red-800/50 text-[11px] text-red-300">
            {error}
          </div>
        )}
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) handleSubmit(); }}
          placeholder="Type your answer here…"
          rows={5}
          className="
            w-full bg-[#2a2a3e] border border-white/[0.08] rounded-lg px-3 py-2.5
            text-[12px] text-gray-200 placeholder-gray-600 resize-none
            focus:outline-none focus:border-violet-500/60 transition-colors leading-relaxed
          "
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-gray-700">Ctrl+Enter to submit</span>
          <button
            onClick={handleSubmit}
            disabled={!answer.trim()}
            className="
              flex items-center gap-1.5 text-[12px] font-semibold px-4 py-1.5 rounded-lg transition-all
              bg-violet-600 hover:bg-violet-500 text-white
              disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed
            "
          >
            <SendIcon />
            Submit Answer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Feedback view ──────────────────────────────────────────── */

function FeedbackView({ evaluation, question, progress, isLast, onAcceptFollowUp, onNext }) {
  const { score, strengths, improvements, feedback, followUpQuestion } = evaluation;
  const diff = DIFF_STYLE[question.difficulty] ?? DIFF_STYLE.medium;
  const bars = Math.round(score);

  return (
    <div className="flex flex-col gap-0 h-full">
      {/* Progress bar */}
      <div className="h-0.5 bg-gray-800 shrink-0">
        <div
          className="h-full bg-violet-500 transition-all duration-500"
          style={{ width: `${(progress.current / progress.total) * 100}%` }}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Score card */}
        <div className="rounded-xl border border-white/[0.07] bg-[#1e1e35] p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-2 py-0.5 rounded border ${diff.badge}`}>
                {question.difficulty}
              </span>
              <span className="text-[10px] text-gray-600">{TYPE_LABEL[question.type] ?? question.type}</span>
            </div>
            <span className={`text-2xl font-bold tabular-nums ${scoreColor(score)}`}>
              {score}<span className="text-[14px] text-gray-600">/10</span>
            </span>
          </div>

          {/* Score bar */}
          <div className="flex items-center gap-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                  i < bars ? scoreBg(score) : "bg-gray-800"
                }`}
                style={{ transitionDelay: `${i * 40}ms` }}
              />
            ))}
          </div>
        </div>

        {/* Feedback text */}
        {feedback && (
          <p className="text-[12px] text-gray-300 leading-relaxed border-l-2 border-violet-700/60 pl-3 italic">
            {feedback}
          </p>
        )}

        {/* Strengths */}
        {strengths.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500/20 flex items-center justify-center text-[8px]">✓</span>
              Strengths
            </p>
            {strengths.map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-emerald-500 text-[11px] shrink-0 mt-0.5">✓</span>
                <p className="text-[11px] text-gray-400 leading-relaxed">{s}</p>
              </div>
            ))}
          </div>
        )}

        {/* Improvements */}
        {improvements.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500/20 flex items-center justify-center text-[8px]">!</span>
              Improvements
            </p>
            {improvements.map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-amber-500 text-[11px] shrink-0 mt-0.5">→</span>
                <p className="text-[11px] text-gray-400 leading-relaxed">{s}</p>
              </div>
            ))}
          </div>
        )}

        {/* Follow-up question preview */}
        {followUpQuestion && (
          <div className="rounded-xl border border-violet-700/40 bg-violet-950/20 p-3 flex flex-col gap-2">
            <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider">Follow-up Question</p>
            <p className="text-[12px] text-gray-200 leading-relaxed">{followUpQuestion}</p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="shrink-0 p-3 border-t border-white/[0.06] flex flex-col gap-2">
        {followUpQuestion && (
          <button
            onClick={onAcceptFollowUp}
            className="w-full text-[12px] font-semibold py-2 rounded-lg bg-violet-700 hover:bg-violet-600 text-white transition-all flex items-center justify-center gap-2"
          >
            <span>↩</span> Answer Follow-up
          </button>
        )}
        <button
          onClick={onNext}
          className={`w-full text-[12px] font-semibold py-2 rounded-lg transition-all flex items-center justify-center gap-2 ${
            followUpQuestion
              ? "border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 hover:bg-gray-800/60"
              : "bg-indigo-600 hover:bg-indigo-500 text-white"
          }`}
        >
          {isLast
            ? <><TrophyIcon /> View Final Report</>
            : followUpQuestion
            ? "Skip → Next Question"
            : <><ArrowIcon /> Next Question</>
          }
        </button>
      </div>
    </div>
  );
}

/* ─── Completed / final report ───────────────────────────────── */

function CompletedView({ evaluations, totalScore, maxScore, techStack, onReset }) {
  const pct     = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  const grade   = pct >= 80 ? { label: "Excellent", color: "text-emerald-400", bg: "bg-emerald-500" }
                : pct >= 60 ? { label: "Good",      color: "text-indigo-400",  bg: "bg-indigo-500"  }
                : pct >= 40 ? { label: "Fair",       color: "text-amber-400",   bg: "bg-amber-500"   }
                :             { label: "Needs Work", color: "text-red-400",     bg: "bg-red-500"     };

  // Aggregate strengths and improvements across all evaluations
  const allStrengths    = evaluations.flatMap((e) => e.strengths    ?? []).slice(0, 5);
  const allImprovements = evaluations.flatMap((e) => e.improvements ?? []).slice(0, 5);

  return (
    <div className="p-4 flex flex-col gap-5 pb-8">
      {/* Trophy header */}
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <div className="text-3xl">🏆</div>
        <div>
          <p className="text-[14px] font-bold text-gray-100">Interview Complete</p>
          <p className="text-[11px] text-gray-500 mt-0.5">{techStack.slice(0, 3).join(" · ")}</p>
        </div>

        {/* Score ring */}
        <div className="flex flex-col items-center gap-1 mt-1">
          <span className={`text-4xl font-bold tabular-nums ${grade.color}`}>{pct}%</span>
          <span className={`text-[11px] font-semibold ${grade.color}`}>{grade.label}</span>
          <span className="text-[11px] text-gray-600">{totalScore} / {maxScore} points</span>
        </div>

        {/* Score bar */}
        <div className="w-full max-w-[200px] h-2 rounded-full bg-gray-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${grade.bg}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Per-question breakdown */}
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Question Breakdown</p>
        {evaluations.map((e, i) => {
          const d = DIFF_STYLE[e.difficulty] ?? DIFF_STYLE.medium;
          return (
            <div key={i} className="rounded-lg border border-white/[0.06] bg-[#1e1e35] p-2.5 flex items-center gap-3">
              <span className="text-[10px] text-gray-600 shrink-0 tabular-nums w-4">Q{i + 1}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded border shrink-0 ${d.badge}`}>
                {e.difficulty}
              </span>
              <span className="text-[11px] text-gray-400 flex-1 truncate">{TYPE_LABEL[e.type] ?? e.type}</span>
              <span className={`text-[13px] font-bold tabular-nums shrink-0 ${scoreColor(e.score)}`}>
                {e.score}/10
              </span>
            </div>
          );
        })}
      </div>

      {/* Strengths */}
      {allStrengths.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Key Strengths</p>
          {allStrengths.map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-emerald-500 shrink-0 mt-0.5 text-[11px]">✓</span>
              <p className="text-[11px] text-gray-400 leading-relaxed">{s}</p>
            </div>
          ))}
        </div>
      )}

      {/* Improvement roadmap */}
      {allImprovements.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Improvement Roadmap</p>
          {allImprovements.map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-amber-500 shrink-0 mt-0.5 text-[11px] tabular-nums">{i + 1}.</span>
              <p className="text-[11px] text-gray-400 leading-relaxed">{s}</p>
            </div>
          ))}
        </div>
      )}

      {/* Restart button */}
      <button
        onClick={onReset}
        className="w-full text-[12px] font-semibold py-2.5 rounded-lg bg-violet-700 hover:bg-violet-600 text-white transition-all flex items-center justify-center gap-2 mt-2"
      >
        <RobotIcon small /> Start New Interview
      </button>
    </div>
  );
}

/* ─── Icons ──────────────────────────────────────────────────── */

function RobotIcon({ small, large }) {
  const cls = large ? "h-7 w-7 text-violet-400"
            : small ? "h-3.5 w-3.5 text-violet-400"
            :         "h-5 w-5 text-violet-400";
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <rect x="4" y="8" width="16" height="12" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h.01M15 12h.01M9 16h6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8V5m-2 0h4" />
      <circle cx="12" cy="4" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  );
}

function EvalIcon() {
  return (
    <svg className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-4.5A3.75 3.75 0 0112 10.5a3.75 3.75 0 01-4.5 3.75V18.75m-3-11.25V5.25A2.25 2.25 0 016.75 3h10.5A2.25 2.25 0 0119.5 5.25v2.25M6 7.5H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 1.036.84 1.875 1.875 1.875H6M18 7.5h2.625c.621 0 1.125.504 1.125 1.125v1.5c0 1.036-.84 1.875-1.875 1.875H18" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  );
}

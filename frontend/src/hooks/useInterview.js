import { useState, useEffect, useRef, useCallback } from "react";
import { startInterview as apiStart, evaluateAnswer as apiEvaluate } from "../api/interview.js";

/**
 * State machine states:
 *   IDLE         — not started
 *   ANALYZING    — backend is analysing the project and generating questions
 *   ASKING       — user is reading the question and composing an answer
 *   EVALUATING   — backend is scoring the submitted answer
 *   FEEDBACK     — showing evaluation; user chooses: answer follow-up OR continue
 *   COMPLETED    — all questions done, final report shown
 */

export function useInterview() {
  // ── Machine state ──────────────────────────────────────────────────────────
  const [state,          setState]         = useState("IDLE");

  // ── Project context ────────────────────────────────────────────────────────
  const [projectSummary, setProjectSummary] = useState("");
  const [techStack,      setTechStack]      = useState([]);

  // ── Questions queue ────────────────────────────────────────────────────────
  // Each entry: { id, question, type, difficulty, isFollowUp? }
  const [questions,      setQuestions]      = useState([]);
  const [currentIndex,   setCurrentIndex]   = useState(0);

  // ── Per-question evaluation history ───────────────────────────────────────
  // Each entry: { question, answer, score, strengths, improvements, feedback }
  const [evaluations,    setEvaluations]    = useState([]);

  // ── Current evaluation (shown in FEEDBACK state) ──────────────────────────
  const [currentEval,    setCurrentEval]    = useState(null);

  // ── Error ──────────────────────────────────────────────────────────────────
  const [error,          setError]          = useState(null);

  // ── Elapsed timer (seconds) ────────────────────────────────────────────────
  const [timer,          setTimer]          = useState(0);
  const timerRef = useRef(null);

  // ─── Timer helpers ──────────────────────────────────────────────────────────

  function startTimer() {
    setTimer(0);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setTimer((t) => t + 1), 1_000);
  }

  function stopTimer() {
    clearInterval(timerRef.current);
  }

  useEffect(() => () => clearInterval(timerRef.current), []);

  // ─── Derived values ─────────────────────────────────────────────────────────

  const currentQuestion = questions[currentIndex] ?? null;
  const totalQuestions  = questions.length;
  const progress        = { current: Math.min(currentIndex + 1, totalQuestions), total: totalQuestions || 5 };
  const totalScore      = evaluations.reduce((s, e) => s + (e.score ?? 0), 0);
  const maxScore        = evaluations.length * 10;

  // ─── startInterview ─────────────────────────────────────────────────────────
  /**
   * Call with the list of open files from IDELayout.
   * @param {Array<{ path, lang, content }>} projectFiles
   */
  const startInterview = useCallback(async (projectFiles) => {
    if (state !== "IDLE") return;

    setError(null);
    setState("ANALYZING");

    try {
      const data = await apiStart(projectFiles);
      const qs   = (data.questions ?? []).map((q, i) => ({ ...q, id: q.id ?? i + 1 }));

      setProjectSummary(data.projectSummary ?? "");
      setTechStack(data.techStack ?? []);
      setQuestions(qs);
      setCurrentIndex(0);
      setEvaluations([]);
      setCurrentEval(null);

      if (qs.length === 0) {
        setError("AI returned no questions. Please try again.");
        setState("IDLE");
        return;
      }

      setState("ASKING");
      startTimer();
    } catch (err) {
      setError(err.message);
      setState("IDLE");
    }
  }, [state]);

  // ─── submitAnswer ───────────────────────────────────────────────────────────
  const submitAnswer = useCallback(async (answer) => {
    if (state !== "ASKING" || !currentQuestion) return;

    stopTimer();
    setError(null);
    setState("EVALUATING");

    try {
      const result = await apiEvaluate({
        question:       currentQuestion.question,
        answer,
        projectSummary,
        questionType:   currentQuestion.type,
        difficulty:     currentQuestion.difficulty,
      });

      const evalEntry = {
        question:     currentQuestion.question,
        type:         currentQuestion.type,
        difficulty:   currentQuestion.difficulty,
        answer,
        score:        result.score,
        strengths:    result.strengths,
        improvements: result.improvements,
        feedback:     result.feedback,
      };

      setEvaluations((prev) => [...prev, evalEntry]);
      setCurrentEval({ ...result, followUpQuestion: result.followUpQuestion ?? null });
      setState("FEEDBACK");
    } catch (err) {
      setError(err.message);
      setState("ASKING");
      startTimer();
    }
  }, [state, currentQuestion, projectSummary]);

  // ─── acceptFollowUp ─────────────────────────────────────────────────────────
  /** Insert the follow-up as the next question and move to it. */
  const acceptFollowUp = useCallback(() => {
    if (state !== "FEEDBACK" || !currentEval?.followUpQuestion) return;

    const followUp = {
      id:         questions.length + 1,
      question:   currentEval.followUpQuestion,
      type:       currentQuestion?.type ?? "technical",
      difficulty: "medium",
      isFollowUp: true,
    };

    // Insert follow-up immediately after current position
    setQuestions((prev) => {
      const next = [...prev];
      next.splice(currentIndex + 1, 0, followUp);
      return next;
    });

    setCurrentIndex((i) => i + 1);
    setCurrentEval(null);
    setState("ASKING");
    startTimer();
  }, [state, currentEval, questions.length, currentIndex, currentQuestion]);

  // ─── nextQuestion ───────────────────────────────────────────────────────────
  /** Skip follow-up (or there is none) and move to next main question. */
  const nextQuestion = useCallback(() => {
    if (state !== "FEEDBACK") return;

    const nextIndex = currentIndex + 1;
    setCurrentEval(null);

    if (nextIndex >= questions.length) {
      setState("COMPLETED");
      stopTimer();
    } else {
      setCurrentIndex(nextIndex);
      setState("ASKING");
      startTimer();
    }
  }, [state, currentIndex, questions.length]);

  // ─── resetInterview ─────────────────────────────────────────────────────────
  const resetInterview = useCallback(() => {
    stopTimer();
    setState("IDLE");
    setQuestions([]);
    setCurrentIndex(0);
    setEvaluations([]);
    setCurrentEval(null);
    setProjectSummary("");
    setTechStack([]);
    setError(null);
    setTimer(0);
  }, []);

  return {
    // State
    state,
    // Project info
    projectSummary,
    techStack,
    // Questions
    questions,
    currentQuestion,
    currentIndex,
    totalQuestions,
    progress,
    // Evaluation
    evaluations,
    currentEval,
    // Scores
    totalScore,
    maxScore,
    // UI helpers
    timer,
    error,
    // Actions
    startInterview,
    submitAnswer,
    acceptFollowUp,
    nextQuestion,
    resetInterview,
  };
}

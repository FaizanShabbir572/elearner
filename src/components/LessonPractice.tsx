"use client";
import { useEffect, useRef, useState } from "react";
import {
  loadPractice, saveChallengeResponse, submitQuiz,
  type ChallengeWithResponse, type PracticeData, type QuestionResult, type QuizStats,
} from "@/app/actions/quiz";
import type { PublicQuestion } from "@/lib/assessment";

const DISCLAIMER = "Educational practice only — not financial advice.";

/** Quiz + Practice tabs under a lesson. Content is loaded (and generated, the first time) when a tab is opened. */
export function LessonPractice({ lessonId, availability }: { lessonId: string; availability: "available" | "too_short" }) {
  const [tab, setTab] = useState<"quiz" | "practice" | null>(null);
  const [data, setData] = useState<PracticeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function load() {
    setLoading(true);
    setFailed(false);
    try {
      setData(await loadPractice(lessonId));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  function open(next: "quiz" | "practice") {
    setTab(next);
    if (!data && !loading && availability === "available") void load();
  }

  const ready = data?.status === "ready" ? data : null;

  return (
    <section className="card mt-10 overflow-hidden" aria-label="Quiz and practice">
      <div className="flex border-b border-slate-200 bg-slate-50/70">
        {(["quiz", "practice"] as const).map((t) => (
          <button key={t} type="button" onClick={() => open(t)}
            className={`px-5 py-3 text-sm font-medium ${tab === t ? "border-b-2 border-brand-600 bg-white text-brand-700" : "text-slate-600 hover:text-slate-900"}`}>
            {t === "quiz" ? "Quiz" : "Practice"}
          </button>
        ))}
        {!tab && <span className="self-center px-3 text-xs text-slate-400">Test yourself on this lesson</span>}
      </div>

      {tab && (
        <div className="p-5">
          {availability === "too_short" || data?.status === "too_short" ? (
            <p className="text-sm text-slate-500">Quiz not available for this lesson yet.</p>
          ) : loading ? (
            <p className="text-sm text-slate-500" role="status">Preparing questions for this lesson… this can take a few seconds the first time.</p>
          ) : failed || !ready ? (
            <div className="text-sm text-slate-500">
              <p>The quiz isn&apos;t available right now.</p>
              <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={() => void load()}>Try again</button>
            </div>
          ) : tab === "quiz" ? (
            ready.questions ? <Quiz lessonId={lessonId} questions={ready.questions} initialStats={ready.stats} /> : <p className="text-sm text-slate-500">Quiz not available for this lesson yet.</p>
          ) : ready.challenges.length ? (
            <Challenges lessonId={lessonId} challenges={ready.challenges} />
          ) : (
            <p className="text-sm text-slate-500">No practice challenges for this lesson yet.</p>
          )}
          <p className="mt-6 text-xs text-slate-400">{DISCLAIMER}</p>
        </div>
      )}
    </section>
  );
}

/* ----------------------------- Quiz ----------------------------- */

function shuffled<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Round = { questions: PublicQuestion[]; order: Record<string, number[]>; isRetry: boolean };

function newRound(questions: PublicQuestion[], isRetry: boolean): Round {
  // A retry shows options in a new order; answers are always sent as the original index.
  const order = Object.fromEntries(questions.map((q) => [q.id, isRetry ? shuffled(q.options.map((_, i) => i)) : q.options.map((_, i) => i)]));
  return { questions, order, isRetry };
}

function Quiz({ lessonId, questions, initialStats }: { lessonId: string; questions: PublicQuestion[]; initialStats: QuizStats }) {
  const [round, setRound] = useState(() => newRound(questions, false));
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [results, setResults] = useState<{ score: number; total: number; byId: Record<string, QuestionResult> } | null>(null);
  const [stats, setStats] = useState(initialStats);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const allAnswered = round.questions.every((q) => q.id in answers);
  const wrong = results ? round.questions.filter((q) => !results.byId[q.id]?.correct) : [];

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      const res = await submitQuiz(lessonId, answers, round.isRetry);
      if (!res.ok) return setError(res.error);
      setResults({ score: res.score, total: res.total, byId: Object.fromEntries(res.results.map((r) => [r.questionId, r])) });
      setStats(res.stats);
    } catch {
      setError("Couldn't submit — check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function restart(qs: PublicQuestion[], isRetry: boolean) {
    setRound(newRound(qs, isRetry));
    setAnswers({});
    setResults(null);
    setError("");
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-slate-600">{round.isRetry ? `Retrying ${round.questions.length} question${round.questions.length === 1 ? "" : "s"}` : `${round.questions.length} questions`}</p>
        {stats && <p className="text-slate-500">Best score <strong className="text-slate-800">{stats.bestScore}/{stats.bestTotal}</strong> · {stats.attempts} attempt{stats.attempts === 1 ? "" : "s"}</p>}
      </div>

      {results && (
        <div className={`mb-5 rounded-lg px-4 py-3 text-sm ${results.score === results.total ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`} role="status">
          You scored <strong>{results.score} / {results.total}</strong>{results.score === results.total ? " — perfect!" : "."}
        </div>
      )}

      <ol className="space-y-5">
        {round.questions.map((q, qi) => {
          const r = results?.byId[q.id];
          return (
            <li key={q.id} className="rounded-lg border border-slate-200 p-4">
              <p className="mb-3 text-sm font-medium text-slate-900">{qi + 1}. {q.question}</p>
              <div className="space-y-1.5">
                {round.order[q.id].map((optIndex) => {
                  const chosen = answers[q.id] === optIndex;
                  const isCorrect = r && optIndex === r.correctIndex;
                  const isWrongChoice = r && chosen && !r.correct;
                  return (
                    <label key={optIndex}
                      className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-sm ${
                        isCorrect ? "border-emerald-300 bg-emerald-50" : isWrongChoice ? "border-red-300 bg-red-50" : chosen ? "border-brand-300 bg-brand-50/50" : "border-slate-200 hover:bg-slate-50"
                      } ${r ? "cursor-default" : ""}`}>
                      <input type="radio" name={`${q.id}-${round.isRetry ? "r" : "f"}`} className="mt-0.5" checked={chosen} disabled={!!r}
                        onChange={() => setAnswers((a) => ({ ...a, [q.id]: optIndex }))} />
                      <span>{q.options[optIndex]}</span>
                    </label>
                  );
                })}
              </div>
              {r && (
                <div className="mt-3 text-sm">
                  <p className={r.correct ? "font-medium text-emerald-700" : "font-medium text-red-700"}>{r.correct ? "✓ Correct" : r.choice === null ? "✗ Not answered" : "✗ Incorrect"}</p>
                  <p className="mt-1 text-slate-600">{r.explanation}</p>
                  <blockquote className="mt-2 border-l-2 border-slate-300 pl-3 text-xs text-slate-500 italic">“{r.sourceQuote}”</blockquote>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {error && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}
      <div className="mt-5 flex flex-wrap gap-2">
        {!results ? (
          <button type="button" className="btn btn-primary" disabled={!allAnswered || submitting} onClick={submit}>
            {submitting ? "Checking…" : allAnswered ? "Submit answers" : "Answer every question to submit"}
          </button>
        ) : (
          <>
            {wrong.length > 0 && <button type="button" className="btn btn-primary" onClick={() => restart(wrong, true)}>Retry incorrect questions ({wrong.length})</button>}
            <button type="button" className="btn btn-secondary" onClick={() => restart(questions, false)}>Take the full quiz again</button>
          </>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- Challenges ----------------------------- */

function Challenges({ lessonId, challenges }: { lessonId: string; challenges: ChallengeWithResponse[] }) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">Work through these on your own. A challenge is complete when you&apos;ve written an answer and ticked every item on its checklist. Your work saves automatically.</p>
      {challenges.map((c) => <ChallengeCard key={c.id} lessonId={lessonId} challenge={c} />)}
    </div>
  );
}

const AUTOSAVE_DELAY_MS = 800;

function ChallengeCard({ lessonId, challenge }: { lessonId: string; challenge: ChallengeWithResponse }) {
  const [answer, setAnswer] = useState(challenge.answer);
  const [reflection, setReflection] = useState(challenge.reflection);
  const [checked, setChecked] = useState(challenge.checked);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const latest = useRef({ answer, reflection, checked });
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const queue = useRef<Promise<void>>(Promise.resolve());

  function save() {
    clearTimeout(timer.current);
    queue.current = queue.current.then(async () => {
      if (!dirty.current) return;
      dirty.current = false;
      setStatus("saving");
      try {
        const res = await saveChallengeResponse(lessonId, challenge.id, latest.current);
        if (!res.ok) {
          setStatus("error");
          setError(res.error);
          return;
        }
        setStatus(dirty.current ? "saving" : "saved");
      } catch {
        dirty.current = true;
        setStatus("error");
        setError("Couldn't save — check your connection.");
      }
    });
  }

  function change(patch: Partial<typeof latest.current>, immediate = false) {
    latest.current = { ...latest.current, ...patch };
    dirty.current = true;
    setStatus("saving");
    clearTimeout(timer.current);
    if (immediate) save();
    else timer.current = setTimeout(save, AUTOSAVE_DELAY_MS);
  }

  // Mirrors the server rule: an answer plus every checklist item ticked.
  const completed = answer.trim().length > 0 && checked.every(Boolean);

  // Flush pending edits when leaving the lesson.
  useEffect(() => () => save(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <article className={`rounded-lg border p-4 ${completed ? "border-emerald-300 bg-emerald-50/30" : "border-slate-200"}`}>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-medium text-slate-900">{challenge.title}</h3>
        <div className="flex items-center gap-2 text-xs">
          <span className={status === "error" ? "text-red-600" : "text-slate-400"} aria-live="polite">
            {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? error : ""}
          </span>
          {completed && <span className="badge bg-emerald-100 text-emerald-800">✓ Completed</span>}
        </div>
      </div>
      <p className="mb-4 text-sm whitespace-pre-wrap text-slate-600">{challenge.instructions}</p>

      <label className="label" htmlFor={`${challenge.id}-answer`}>Your answer</label>
      <textarea id={`${challenge.id}-answer`} className="input mb-4 min-h-28 resize-y" value={answer} maxLength={10_000}
        onChange={(e) => { setAnswer(e.target.value); change({ answer: e.target.value }); }} onBlur={save} />

      <label className="label" htmlFor={`${challenge.id}-reflection`}>Reflection — what did you learn / what was hard?</label>
      <textarea id={`${challenge.id}-reflection`} className="input mb-4 min-h-20 resize-y" value={reflection} maxLength={5_000}
        onChange={(e) => { setReflection(e.target.value); change({ reflection: e.target.value }); }} onBlur={save} />

      <fieldset>
        <legend className="label">Self-check</legend>
        <div className="space-y-1.5">
          {challenge.checklist.map((item, i) => (
            <label key={i} className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" className="mt-0.5" checked={checked[i] ?? false}
                onChange={(e) => {
                  const next = checked.map((v, j) => (j === i ? e.target.checked : v));
                  setChecked(next);
                  change({ checked: next }, true);
                }} />
              <span>{item}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </article>
  );
}

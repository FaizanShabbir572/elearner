"use client";
import { useState } from "react";
import { submitRecall, type RecallResult } from "@/app/actions/revision";
import type { RecallItem } from "@/lib/revision";

const keyOf = (i: { lessonId: string; question: { id: string } }) => `${i.lessonId}:${i.question.id}`;

/** A short quick-recall round; graded on the server with explanations. */
export function RecallQuiz({ items }: { items: RecallItem[] }) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [results, setResults] = useState<Record<string, RecallResult> | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const allAnswered = items.every((i) => keyOf(i) in answers);

  async function submit() {
    setPending(true);
    setError("");
    try {
      const res = await submitRecall(items.map((i) => ({ lessonId: i.lessonId, questionId: i.question.id, choice: answers[keyOf(i)] })));
      if (!res.ok) return setError(res.error);
      setResults(Object.fromEntries(res.results.map((r) => [`${r.lessonId}:${r.questionId}`, r])));
    } catch {
      setError("Couldn't submit — check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  const score = results ? Object.values(results).filter((r) => r.correct).length : 0;

  return (
    <div>
      {results && (
        <p className="mb-4 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700" role="status">
          You got <strong>{score} / {Object.keys(results).length}</strong>. Questions you answered correctly will rest for a few days; reload later for a fresh round.
        </p>
      )}
      <ol className="space-y-4">
        {items.map((item, idx) => {
          const k = keyOf(item);
          const r = results?.[k];
          return (
            <li key={k} className="rounded-lg border border-slate-200 p-4">
              <p className="mb-1 text-xs text-slate-400">From: {item.lessonTitle}</p>
              <p className="mb-3 text-sm font-medium text-slate-900">{idx + 1}. {item.question.question}</p>
              <div className="space-y-1.5">
                {item.question.options.map((opt, oi) => {
                  const chosen = answers[k] === oi;
                  const isCorrect = r && oi === r.correctIndex;
                  const isWrong = r && chosen && !r.correct;
                  return (
                    <label key={oi} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 text-sm ${
                      isCorrect ? "border-emerald-300 bg-emerald-50" : isWrong ? "border-red-300 bg-red-50" : chosen ? "border-brand-300 bg-brand-50/50" : "border-slate-200 hover:bg-slate-50"
                    }`}>
                      <input type="radio" name={k} className="mt-0.5" checked={chosen} disabled={!!results} onChange={() => setAnswers((a) => ({ ...a, [k]: oi }))} />
                      <span>{opt}</span>
                    </label>
                  );
                })}
              </div>
              {r && (
                <div className="mt-3 text-sm">
                  <p className={r.correct ? "font-medium text-emerald-700" : "font-medium text-red-700"}>{r.correct ? "✓ Correct" : "✗ Incorrect"}</p>
                  <p className="mt-1 text-slate-600">{r.explanation}</p>
                  <blockquote className="mt-2 border-l-2 border-slate-300 pl-3 text-xs text-slate-500 italic">“{r.sourceQuote}”</blockquote>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
      {!results && (
        <button type="button" className="btn btn-primary mt-4" disabled={!allAnswered || pending} onClick={submit}>
          {pending ? "Checking…" : allAnswered ? "Check answers" : "Answer every question to check"}
        </button>
      )}
      <p className="mt-4 text-xs text-slate-400">Educational practice only — not financial advice.</p>
    </div>
  );
}

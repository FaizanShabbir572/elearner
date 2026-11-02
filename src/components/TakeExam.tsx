"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveExamAnswers, submitExam } from "@/app/actions/exams";

const LETTERS = ["A", "B", "C", "D"];
const AUTOSAVE_DELAY_MS = 1000;

type Q = { id: string; text: string; options: string[] };

/** Answer sheet for an assigned quiz. Answers autosave; submitting sends it for admin review. */
export function TakeExam({ assignmentId, questions, initialAnswers }: { assignmentId: string; questions: Q[]; initialAnswers: Record<string, number> }) {
  const router = useRouter();
  const [answers, setAnswers] = useState(initialAnswers);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const latest = useRef(initialAnswers);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const answered = questions.filter((q) => q.id in answers).length;

  function choose(qid: string, i: number) {
    const next = { ...latest.current, [qid]: i };
    latest.current = next;
    setAnswers(next);
    setStatus("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await saveExamAnswers(assignmentId, latest.current);
        setStatus(res.ok ? "saved" : "error");
        if (!res.ok) setError(res.error);
      } catch {
        setStatus("error");
        setError("Couldn't save — check your connection.");
      }
    }, AUTOSAVE_DELAY_MS);
  }

  async function submit() {
    const missing = questions.length - answered;
    const msg = missing > 0
      ? `You have ${missing} unanswered question${missing === 1 ? "" : "s"}. Submit anyway? You can't change answers after submitting.`
      : "Submit your answers? You can't change them after submitting.";
    if (!confirm(msg)) return;
    clearTimeout(timer.current);
    setSubmitting(true);
    setError("");
    try {
      const res = await submitExam(assignmentId, latest.current);
      if (!res.ok) return setError(res.error);
      router.refresh();
    } catch {
      setError("Couldn't submit — check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-5 mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/95 px-5 py-3 backdrop-blur md:-mx-10 md:px-10">
        <div className="min-w-48 flex-1">
          <p className="text-sm font-medium text-slate-700">{answered} of {questions.length} answered</p>
          <div className="mt-1 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-brand-600 transition-all" style={{ width: `${(answered / questions.length) * 100}%` }} />
          </div>
        </div>
        <span className={`text-xs ${status === "error" ? "text-red-600" : "text-slate-500"}`} aria-live="polite">
          {status === "saving" ? "Saving…" : status === "saved" ? "Progress saved" : status === "error" ? error : ""}
        </span>
      </div>

      <ol className="space-y-4">
        {questions.map((q, qi) => (
          <li key={q.id} id={`q-${qi + 1}`} className="card p-5">
            <p className="mb-3 text-sm font-medium whitespace-pre-wrap text-slate-900">{qi + 1}. {q.text}</p>
            <div className="space-y-1.5">
              {q.options.map((o, oi) => (
                <label key={oi} className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-sm ${answers[q.id] === oi ? "border-brand-400 bg-brand-50/60" : "border-slate-200 hover:bg-slate-50"}`}>
                  <input type="radio" name={q.id} className="mt-0.5" checked={answers[q.id] === oi} onChange={() => choose(q.id, oi)} />
                  <span><span className="mr-1 font-medium text-slate-500">{LETTERS[oi]})</span>{o}</span>
                </label>
              ))}
            </div>
          </li>
        ))}
      </ol>

      {error && status !== "error" && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}
      <div className="mt-6 flex items-center gap-3">
        <button type="button" className="btn btn-primary" disabled={submitting} onClick={submit}>{submitting ? "Submitting…" : "Submit quiz"}</button>
        <span className="text-sm text-slate-500">An admin will review your answers and mark the quiz pass or fail.</span>
      </div>
    </div>
  );
}

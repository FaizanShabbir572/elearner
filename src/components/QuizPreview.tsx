import { cachedAssessment, MIN_QUESTIONS, MIN_SOURCE_CHARS } from "@/lib/assessment";
import { isAiEnabled } from "@/lib/ai";
import { formatDateTime } from "@/lib/activity";
import { regenerateQuiz, removeQuizQuestion } from "@/app/actions/admin-assessment";
import { ConfirmButton, SubmitButton } from "./SubmitButton";

/** Admin-only, read-only look at a lesson's auto-generated quiz. Optional: nothing requires using it. */
export async function QuizPreview({ lessonId }: { lessonId: string }) {
  const data = await cachedAssessment(lessonId);
  if (!data) return null;
  const ai = isAiEnabled();
  const row = data.row;

  return (
    <section className="card mt-8 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Auto-generated quiz <span className="text-sm font-normal text-faint">(optional preview)</span></h2>
          <p className="mt-0.5 text-sm text-muted">
            {data.sourceChars < MIN_SOURCE_CHARS
              ? `Lesson text is ${data.sourceChars} characters — at least ${MIN_SOURCE_CHARS} are needed before a quiz is generated. Add content or a transcript.`
              : !row
                ? ai ? "Not generated yet — it's created automatically the first time a student opens the Quiz tab." : "Not generated. AI is turned off (no ANTHROPIC_API_KEY)."
                : `Generated ${formatDateTime(row.generatedAt)} · ${row.questions.length} questions · ${row.challenges.length} challenges${row.stale ? " · lesson text changed, regenerates on next view" : ""}`}
          </p>
        </div>
        {ai && data.sourceChars >= MIN_SOURCE_CHARS && (
          <form action={regenerateQuiz}>
            <input type="hidden" name="lessonId" value={lessonId} />
            <SubmitButton className="btn btn-secondary btn-sm" pendingText="Generating…">{row ? "Regenerate" : "Generate now"}</SubmitButton>
          </form>
        )}
      </div>

      {row && row.questions.length > 0 && row.questions.length < MIN_QUESTIONS && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Fewer than {MIN_QUESTIONS} questions — students see &quot;Quiz not available&quot;.</p>
      )}

      {row && (
        <ol className="space-y-3">
          {row.questions.map((q, i) => (
            <li key={q.id} className="rounded-lg border border-line p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-ink">{i + 1}. {q.question}</p>
                <form action={removeQuizQuestion}>
                  <input type="hidden" name="lessonId" value={lessonId} />
                  <input type="hidden" name="questionId" value={q.id} />
                  <ConfirmButton message="Remove this question for all students?" className="btn btn-ghost btn-sm shrink-0 text-red-600 hover:bg-red-50">Remove question</ConfirmButton>
                </form>
              </div>
              <ul className="mt-2 space-y-0.5">
                {q.options.map((o, oi) => (
                  <li key={oi} className={oi === q.correctIndex ? "font-medium text-emerald-700" : "text-muted"}>{oi === q.correctIndex ? "✓ " : "· "}{o}</li>
                ))}
              </ul>
              <p className="mt-2 text-muted">{q.explanation}</p>
              <blockquote className="mt-1 border-l-2 border-line-strong pl-3 text-xs text-muted italic">“{q.sourceQuote}”</blockquote>
            </li>
          ))}
        </ol>
      )}

      {row && row.challenges.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-semibold text-ink-2">Practice challenges</h3>
          <ul className="space-y-2 text-sm">
            {row.challenges.map((c) => (
              <li key={c.id} className="rounded-lg border border-line p-3">
                <p className="font-medium text-ink">{c.title}</p>
                <p className="mt-1 text-muted">{c.instructions}</p>
                <ul className="mt-1 list-disc pl-5 text-muted">{c.checklist.map((item, i) => <li key={i}>{item}</li>)}</ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

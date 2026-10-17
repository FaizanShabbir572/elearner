import Link from "next/link";
import type { CurrentUser } from "@/lib/auth";
import { actionReminder, recallQuestions, suggestedRevision } from "@/lib/revision";
import { formatDate } from "@/lib/activity";
import { markReviewed } from "@/app/actions/revision";
import { SubmitButton } from "./SubmitButton";
import { RecallQuiz } from "./RecallQuiz";

/** "Keep it fresh": open-action reminder, lessons to revise, and quick recall. */
export async function KeepItFresh({ user, variant }: { user: CurrentUser; variant: "dashboard" | "page" }) {
  const [reminder, suggestions, recall] = await Promise.all([actionReminder(user.id), suggestedRevision(user), recallQuestions(user)]);
  const nothing = reminder.open === 0 && suggestions.length === 0 && recall.length === 0;

  if (variant === "dashboard" && nothing) return null;

  return (
    <section className={variant === "dashboard" ? "card mb-8 p-5" : "space-y-8"}>
      {variant === "dashboard" && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-semibold">Keep it fresh</h2>
          <Link href="/revision" className="text-sm font-medium text-brand-600 hover:underline">Open revision →</Link>
        </div>
      )}

      {/* Unfinished actions */}
      {reminder.open > 0 && (
        <div className={`flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm ${reminder.overdue ? "bg-red-50 text-red-800" : "bg-slate-50 text-slate-700"} ${variant === "page" ? "card" : "mb-4"}`}>
          <span>
            You have <strong>{reminder.open}</strong> open action{reminder.open === 1 ? "" : "s"}
            {reminder.overdue > 0 && <>, <strong>{reminder.overdue} overdue</strong></>}.
          </span>
          <Link href="/actions" className="btn btn-secondary btn-sm">Go to my actions</Link>
        </div>
      )}

      {/* Suggested revision */}
      {(variant === "page" || suggestions.length > 0) && (
        <div className={variant === "page" ? "card p-5" : "mb-4"}>
          <h3 className="mb-1 text-sm font-semibold text-slate-800">Suggested revision</h3>
          {suggestions.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing to revise yet. Completed lessons you haven&apos;t revisited for a week will show up here.</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100">
              {suggestions.map((s) => (
                <li key={s.lessonId} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{s.title}</p>
                    <p className="text-xs text-slate-500">
                      {s.courseTitle} · last studied {formatDate(s.lastActivity)}{s.bestQuiz !== null && ` · best quiz ${s.bestQuiz}%`}
                    </p>
                  </div>
                  <form action={markReviewed}>
                    <input type="hidden" name="lessonId" value={s.lessonId} />
                    <SubmitButton className="btn btn-primary btn-sm">Review</SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Quick recall */}
      {variant === "page" ? (
        <div className="card p-5">
          <h3 className="mb-1 text-sm font-semibold text-slate-800">Quick recall</h3>
          {recall.length === 0 ? (
            <p className="text-sm text-slate-500">No recall questions right now. Finish lessons and take their quizzes — questions come back here to keep them fresh.</p>
          ) : (
            <>
              <p className="mb-4 text-sm text-slate-500">A few questions from lessons you&apos;ve completed, starting with ones you found tricky.</p>
              <RecallQuiz items={recall} />
            </>
          )}
        </div>
      ) : (
        recall.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-brand-50/60 px-4 py-3 text-sm text-slate-700">
            <span><strong>{recall.length}</strong> quick-recall question{recall.length === 1 ? "" : "s"} ready.</span>
            <Link href="/revision" className="btn btn-primary btn-sm">Start quick recall</Link>
          </div>
        )
      )}
    </section>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { reopenAssignment, reviewAssignment } from "@/app/actions/admin-exams";
import { ConfirmButton } from "@/components/SubmitButton";
import { EXAM_STATUS_LABEL, EXAM_STATUS_STYLE } from "@/lib/constants";
import { LETTERS, parseAnswers, parseOptions, suggestedResult } from "@/lib/exams";
import { formatDateTime } from "@/lib/activity";

export const metadata = { title: "Review quiz" };

export default async function ReviewPage({ params, searchParams }: { params: Promise<{ id: string; assignmentId: string }>; searchParams: Promise<{ filter?: string }> }) {
  const { id, assignmentId } = await params;
  const { filter } = await searchParams;
  const a = await db.examAssignment.findUnique({
    where: { id: assignmentId },
    include: { user: { select: { name: true, email: true } }, exam: { include: { questions: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } } } },
  });
  if (!a || a.examId !== id) notFound();

  const answers = parseAnswers(a.answersJson);
  const rows = a.exam.questions.map((q, i) => {
    const choice = answers[q.id];
    return { q, i, options: parseOptions(q.options), choice, correct: choice === q.correctIndex };
  });
  const score = rows.filter((r) => r.correct).length;
  const s = suggestedResult(score, rows.length, a.exam.passMark);
  const shown = filter === "wrong" ? rows.filter((r) => !r.correct) : rows;
  const unanswered = rows.filter((r) => r.choice === undefined).length;

  return (
    <>
      <Link href={`/admin/exams/${a.examId}`} className="text-sm text-slate-500 hover:text-slate-800">← {a.exam.title}</Link>
      <div className="mt-1 mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{a.user.name}</h1>
          <p className="text-sm text-slate-500">{a.user.email} · submitted {a.submittedAt ? formatDateTime(a.submittedAt) : "—"}</p>
        </div>
        <span className={`badge ${EXAM_STATUS_STYLE[a.status]}`}>{EXAM_STATUS_LABEL[a.status]}</span>
      </div>

      {a.status === "ASSIGNED" ? (
        <p className="card px-5 py-6 text-sm text-slate-500">This student hasn&apos;t submitted yet.</p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <section className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Answers</h2>
              <div className="flex gap-1.5 text-sm">
                <Link href="?" className={`btn btn-sm ${filter !== "wrong" ? "bg-slate-900 text-white" : "btn-secondary"}`}>All ({rows.length})</Link>
                <Link href="?filter=wrong" className={`btn btn-sm ${filter === "wrong" ? "bg-slate-900 text-white" : "btn-secondary"}`}>Incorrect ({rows.length - score})</Link>
              </div>
            </div>
            <ol className="space-y-3">
              {shown.map(({ q, i, options, choice, correct }) => (
                <li key={q.id} className={`card p-4 ${correct ? "" : "border-l-4 border-l-red-400"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium whitespace-pre-wrap text-slate-900">{i + 1}. {q.text}</p>
                    <span className={`badge shrink-0 ${correct ? "bg-emerald-50 text-emerald-700" : choice === undefined ? "bg-slate-100 text-slate-600" : "bg-red-50 text-red-700"}`}>
                      {correct ? "✓ Correct" : choice === undefined ? "Not answered" : "✗ Incorrect"}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm">
                    {options.map((o, oi) => (
                      <li key={oi} className={`rounded px-2 py-1 ${oi === q.correctIndex ? "bg-emerald-50 text-emerald-800" : oi === choice ? "bg-red-50 text-red-800" : "text-slate-600"}`}>
                        {LETTERS[oi]}) {o}
                        {oi === choice && <span className="ml-2 text-xs font-medium">← student&apos;s answer</span>}
                        {oi === q.correctIndex && <span className="ml-2 text-xs font-medium">✓ correct</span>}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
              {shown.length === 0 && <p className="card px-5 py-6 text-sm text-slate-500">No incorrect answers.</p>}
            </ol>
          </section>

          <aside className="space-y-4 lg:sticky lg:top-8 lg:h-fit">
            <div className="card p-5">
              <p className="text-3xl font-semibold text-slate-900">{score}/{rows.length}</p>
              <p className="text-sm text-slate-500">{s.percent}% correct{unanswered > 0 && ` · ${unanswered} unanswered`}</p>
              <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${s.pass ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
                Suggested: <strong>{s.pass ? "Pass" : "Fail"}</strong> (pass mark {a.exam.passMark}%)
              </p>
            </div>
            <form action={reviewAssignment} className="card space-y-3 p-5">
              <h2 className="font-semibold">Your decision</h2>
              <input type="hidden" name="id" value={a.id} />
              <div>
                <label className="label" htmlFor="reviewNote">Note to student <span className="font-normal text-slate-400">(optional)</span></label>
                <textarea id="reviewNote" name="reviewNote" className="input min-h-20" maxLength={2000} defaultValue={a.reviewNote} />
              </div>
              <div className="flex gap-2">
                <button name="result" value="PASSED" className={`btn flex-1 ${a.status === "PASSED" ? "bg-emerald-600 text-white hover:bg-emerald-700" : "btn-secondary"}`}>Pass</button>
                <button name="result" value="FAILED" className={`btn flex-1 ${a.status === "FAILED" ? "bg-red-600 text-white hover:bg-red-700" : "btn-secondary"}`}>Fail</button>
              </div>
              {a.reviewedAt && <p className="text-xs text-slate-500">Marked {EXAM_STATUS_LABEL[a.status].toLowerCase()} on {formatDateTime(a.reviewedAt)}. You can change it.</p>}
            </form>
            <form action={reopenAssignment} className="card p-5">
              <input type="hidden" name="id" value={a.id} />
              <p className="mb-2 text-sm text-slate-600">Let the student take this quiz again. Their current answers and result will be cleared.</p>
              <ConfirmButton message={`Clear ${a.user.name}'s answers and let them retake this quiz?`} className="btn btn-secondary btn-sm">Allow retake</ConfirmButton>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { deleteExam, deleteQuestion, unassignExam, updateExam } from "@/app/actions/admin-exams";
import { AssignForm, ImportForm, QuestionForm, QuestionRow } from "@/components/ExamAdmin";
import { ConfirmButton, SubmitButton } from "@/components/SubmitButton";
import { EXAM_MAX_QUESTIONS, EXAM_MIN_QUESTIONS, EXAM_STATUS_LABEL, EXAM_STATUS_STYLE } from "@/lib/constants";
import { parseOptions, suggestedResult } from "@/lib/exams";
import { formatDateTime } from "@/lib/activity";
import { formatDue } from "@/lib/due";

export const metadata = { title: "Edit quiz" };

export default async function EditExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exam = await db.exam.findUnique({
    where: { id },
    include: {
      questions: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
      assignments: {
        orderBy: [{ submittedAt: { sort: "desc", nulls: "last" } }, { assignedAt: "desc" }],
        include: { user: { select: { name: true, email: true } } },
      },
    },
  });
  if (!exam) notFound();

  const qCount = exam.questions.length;
  const ready = qCount >= EXAM_MIN_QUESTIONS && qCount <= EXAM_MAX_QUESTIONS;
  const locked = exam.assignments.some((a) => a.status !== "ASSIGNED");
  const assignedIds = exam.assignments.map((a) => a.userId);
  const students = await db.user.findMany({
    where: { role: "STUDENT", status: "APPROVED", id: { notIn: assignedIds } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, proficiencyLevel: true },
  });
  const awaiting = exam.assignments.filter((a) => a.status === "SUBMITTED").length;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/exams" className="text-sm text-muted hover:text-ink">← All quizzes</Link>
          <h1 className="mt-1 heading-accent text-2xl font-bold tracking-tight">{exam.title}</h1>
        </div>
        <form action={deleteExam}>
          <input type="hidden" name="id" value={exam.id} />
          <ConfirmButton message={`Delete "${exam.title}"? All its questions, assignments and student answers will be removed.`}>Delete quiz</ConfirmButton>
        </form>
      </div>

      <div className={`mb-6 rounded-lg px-4 py-3 text-sm ${ready ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
        <strong>{qCount}</strong> question{qCount === 1 ? "" : "s"} (max {EXAM_MAX_QUESTIONS}).{" "}
        {ready ? "Ready to assign." : qCount < EXAM_MIN_QUESTIONS ? "Add a question before you can assign it." : `Remove ${qCount - EXAM_MAX_QUESTIONS} to assign it.`}
        {locked && " Questions are locked because students have submitted answers."}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-8">
          {/* Results */}
          <section>
            <h2 className="mb-3 font-semibold">Assigned students {awaiting > 0 && <span className="badge ml-1 bg-amber-50 text-amber-800">{awaiting} to review</span>}</h2>
            {exam.assignments.length === 0 ? (
              <p className="card px-5 py-6 text-sm text-muted">Not assigned to anyone yet.</p>
            ) : (
              <div className="card overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-line bg-surface-2/70 text-xs font-medium tracking-wide text-muted uppercase">
                    <tr><th className="px-4 py-2.5">Student</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Score</th><th className="px-4 py-2.5">Submitted</th><th className="px-4 py-2.5 text-right">Actions</th></tr>
                  </thead>
                  <tbody className="divide-y divide-line/70">
                    {exam.assignments.map((a) => {
                      const s = a.score !== null && a.total ? suggestedResult(a.score, a.total, exam.passMark) : null;
                      return (
                        <tr key={a.id} className={a.status === "SUBMITTED" ? "bg-amber-50/30" : ""}>
                          <td className="px-4 py-3"><p className="font-medium text-ink">{a.user.name}</p><p className="text-xs text-muted">{a.user.email}</p></td>
                          <td className="px-4 py-3"><span className={`badge ${EXAM_STATUS_STYLE[a.status]}`}>{EXAM_STATUS_LABEL[a.status]}</span>
                            {a.dueDate && a.status === "ASSIGNED" && <p className="mt-1 text-xs text-muted">Due {formatDue(a.dueDate)}</p>}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{s ? `${a.score}/${a.total} (${s.percent}%)` : "—"}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-muted">{a.submittedAt ? formatDateTime(a.submittedAt) : "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1.5">
                              {a.status !== "ASSIGNED" && <Link href={`/admin/exams/${exam.id}/review/${a.id}`} className="btn btn-primary btn-sm">{a.status === "SUBMITTED" ? "Review" : "View"}</Link>}
                              <form action={unassignExam}>
                                <input type="hidden" name="id" value={a.id} />
                                <ConfirmButton message={`Remove this quiz from ${a.user.name}?${a.status !== "ASSIGNED" ? " Their answers and result will be deleted." : ""}`} className="btn btn-ghost btn-sm text-red-600 hover:bg-red-50">Unassign</ConfirmButton>
                              </form>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Questions */}
          <section>
            <h2 className="mb-3 font-semibold">Questions ({qCount})</h2>
            <div className="space-y-3">
              {exam.questions.map((q, i) => (
                <QuestionRow key={q.id} examId={exam.id} index={i} locked={locked}
                  question={{ id: q.id, text: q.text, options: parseOptions(q.options), correctIndex: q.correctIndex }}
                  deleteSlot={
                    <form action={deleteQuestion}>
                      <input type="hidden" name="id" value={q.id} />
                      <ConfirmButton message={`Delete question ${i + 1}?`} className="btn btn-ghost btn-sm text-red-600 hover:bg-red-50">Delete</ConfirmButton>
                    </form>
                  } />
              ))}
              {qCount === 0 && <p className="card px-5 py-6 text-sm text-muted">No questions yet. Add them one by one, or paste many at once with “Bulk import”.</p>}
            </div>
            {!locked && qCount < EXAM_MAX_QUESTIONS && (
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="card p-5">
                  <h3 className="mb-3 text-sm font-semibold">Add a question</h3>
                  <QuestionForm examId={exam.id} />
                </div>
                <div className="card p-5">
                  <h3 className="mb-3 text-sm font-semibold">Bulk import</h3>
                  <ImportForm examId={exam.id} />
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Sidebar: settings + assign */}
        <div className="space-y-6 lg:sticky lg:top-8 lg:h-fit">
          <form action={updateExam} className="card space-y-4 p-5">
            <h2 className="font-semibold">Settings</h2>
            <input type="hidden" name="id" value={exam.id} />
            <div><label className="label" htmlFor="title">Title</label><input className="input" id="title" name="title" required defaultValue={exam.title} /></div>
            <div><label className="label" htmlFor="description">Description</label><textarea className="input min-h-20" id="description" name="description" defaultValue={exam.description} /></div>
            <div><label className="label" htmlFor="passMark">Pass mark (%)</label><input className="input w-28" id="passMark" name="passMark" type="number" min={0} max={100} defaultValue={exam.passMark} /></div>
            <SubmitButton className="btn btn-secondary w-full" pendingText="Saving…">Save settings</SubmitButton>
          </form>
          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Assign to students</h2>
            {!ready && <p className="mb-3 text-sm text-amber-700">{qCount < EXAM_MIN_QUESTIONS ? "Add a question first." : `Remove questions to get to ${EXAM_MAX_QUESTIONS} or fewer first.`}</p>}
            <AssignForm examId={exam.id} canAssign={ready} students={students.map((s) => ({ id: s.id, name: s.name, email: s.email, level: s.proficiencyLevel }))} />
          </div>
        </div>
      </div>
    </>
  );
}

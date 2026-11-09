import Link from "next/link";
import { db } from "@/lib/db";
import { createExam } from "@/app/actions/admin-exams";
import { SubmitButton } from "@/components/SubmitButton";
import { EmptyState, PageHeader } from "@/components/ui";
import { EXAM_MAX_QUESTIONS, EXAM_MIN_QUESTIONS } from "@/lib/constants";

export const metadata = { title: "Quizzes" };

export default async function ExamsPage() {
  const [exams, statusCounts] = await Promise.all([
    db.exam.findMany({ orderBy: { updatedAt: "desc" }, include: { _count: { select: { questions: true, assignments: true } } } }),
    db.examAssignment.groupBy({ by: ["examId", "status"], _count: true }),
  ]);
  const count = (examId: string, status: string) => statusCounts.find((c) => c.examId === examId && c.status === status)?._count ?? 0;

  return (
    <>
      <PageHeader title="Quizzes" subtitle={`Write quizzes of up to ${EXAM_MAX_QUESTIONS} questions, assign them to students, then review answers and mark pass or fail.`} />
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          {exams.length === 0 && <EmptyState title="No quizzes yet">Create your first quiz using the form.</EmptyState>}
          {exams.map((e) => {
            const q = e._count.questions;
            const ready = q >= EXAM_MIN_QUESTIONS && q <= EXAM_MAX_QUESTIONS;
            const awaiting = count(e.id, "SUBMITTED");
            return (
              <Link key={e.id} href={`/admin/exams/${e.id}`} className="card group block p-5 transition hover:border-brand-500/40 hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="font-semibold group-hover:text-brand-700">{e.title}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">{e.description || "No description"}</p>
                  </div>
                  {awaiting > 0 && <span className="badge shrink-0 bg-amber-50 text-amber-800 ring-1 ring-amber-200">{awaiting} to review</span>}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
                  <span className={ready ? "" : "font-medium text-amber-700"}>{q} question{q === 1 ? "" : "s"}{ready ? "" : ` (needs ${EXAM_MIN_QUESTIONS}+)`}</span>
                  <span>{e._count.assignments} assigned</span>
                  <span>{count(e.id, "PASSED")} passed · {count(e.id, "FAILED")} failed</span>
                  <span>Pass mark {e.passMark}%</span>
                </div>
              </Link>
            );
          })}
        </div>
        <form action={createExam} className="card h-fit space-y-4 p-5 lg:sticky lg:top-8">
          <h2 className="font-semibold">New quiz</h2>
          <div>
            <label className="label" htmlFor="title">Title</label>
            <input className="input" id="title" name="title" required />
          </div>
          <div>
            <label className="label" htmlFor="description">Description <span className="font-normal text-faint">(optional)</span></label>
            <textarea className="input min-h-20" id="description" name="description" />
          </div>
          <div>
            <label className="label" htmlFor="passMark">Pass mark (%)</label>
            <input className="input w-28" id="passMark" name="passMark" type="number" min={0} max={100} defaultValue={60} />
            <p className="mt-1 text-xs text-muted">Used to suggest pass/fail. You make the final decision.</p>
          </div>
          <SubmitButton className="btn btn-primary w-full" pendingText="Creating…">Create quiz</SubmitButton>
        </form>
      </div>
    </>
  );
}

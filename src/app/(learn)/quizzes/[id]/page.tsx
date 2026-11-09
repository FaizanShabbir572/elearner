import Link from "next/link";
import { notFound } from "next/navigation";
import { requireApproved } from "@/lib/auth";
import { db } from "@/lib/db";
import { EXAM_STATUS_LABEL, EXAM_STATUS_STYLE } from "@/lib/constants";
import { parseAnswers, parseOptions } from "@/lib/exams";
import { formatDateTime } from "@/lib/activity";
import { dueLabel, startOfToday } from "@/lib/due";
import { TakeExam } from "@/components/TakeExam";

export const metadata = { title: "Quiz" };

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireApproved();
  const { id } = await params;
  // Scoped to the logged-in student: another student's assignment id is simply "not found".
  const a = await db.examAssignment.findFirst({
    where: { id, userId: user.id },
    include: { exam: { include: { questions: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true, text: true, options: true } } } } },
  });
  if (!a) notFound();
  const reviewed = a.status === "PASSED" || a.status === "FAILED";

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 md:px-10 md:py-10">
      <Link href="/quizzes" className="text-sm text-muted hover:text-ink">← My quizzes</Link>
      <div className="mt-1 mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="heading-accent text-2xl font-bold tracking-tight">{a.exam.title}</h1>
          {a.exam.description && <p className="mt-1 text-sm text-muted">{a.exam.description}</p>}
        </div>
        <span className={`badge ${EXAM_STATUS_STYLE[a.status]}`}>{a.status === "ASSIGNED" ? "To do" : EXAM_STATUS_LABEL[a.status]}</span>
      </div>

      {a.status === "ASSIGNED" ? (
        <>
          <p className="mb-4 text-sm text-muted">
            {a.exam.questions.length} questions · choose one answer for each. Your answers save automatically, so you can come back later.
            {a.dueDate && <> <strong>{dueLabel(a.dueDate, startOfToday())}.</strong></>}
          </p>
          {/* Only question text and options are sent — never the correct answers. */}
          <TakeExam assignmentId={a.id} initialAnswers={parseAnswers(a.answersJson)}
            questions={a.exam.questions.map((q) => ({ id: q.id, text: q.text, options: parseOptions(q.options) }))} />
        </>
      ) : (
        <div className="card p-6">
          {reviewed ? (
            <>
              <p className={`text-xl font-semibold ${a.status === "PASSED" ? "text-emerald-700" : "text-red-700"}`}>{a.status === "PASSED" ? "🎉 You passed" : "Not passed this time"}</p>
              {a.score !== null && a.total && <p className="mt-1 text-sm text-muted">Score: {a.score} / {a.total} ({Math.round((a.score / a.total) * 100)}%)</p>}
              {a.reviewNote && <blockquote className="mt-4 border-l-2 border-line-strong pl-3 text-sm whitespace-pre-wrap text-ink-2">{a.reviewNote}</blockquote>}
              {a.reviewedAt && <p className="mt-4 text-xs text-faint">Reviewed {formatDateTime(a.reviewedAt)}</p>}
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-ink">Submitted — awaiting review</p>
              <p className="mt-1 text-sm text-muted">You submitted this quiz{a.submittedAt && ` on ${formatDateTime(a.submittedAt)}`}. Your instructor will review your answers and mark it pass or fail.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

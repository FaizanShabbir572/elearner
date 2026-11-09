import Link from "next/link";
import { requireApproved } from "@/lib/auth";
import { db } from "@/lib/db";
import { EXAM_STATUS_LABEL, EXAM_STATUS_STYLE } from "@/lib/constants";
import { dueLabel, dueState, startOfToday } from "@/lib/due";
import { formatDateTime } from "@/lib/activity";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "My quizzes" };

export default async function MyQuizzesPage() {
  const user = await requireApproved();
  const today = startOfToday();
  const assignments = await db.examAssignment.findMany({
    where: { userId: user.id },
    orderBy: [{ assignedAt: "desc" }],
    take: 200,
    include: { exam: { select: { title: true, description: true, _count: { select: { questions: true } } } } },
  });
  // Open quizzes first, then everything else newest first.
  const sorted = [...assignments].sort((a, b) => Number(b.status === "ASSIGNED") - Number(a.status === "ASSIGNED"));

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 md:px-10 md:py-10">
      <PageHeader title="My quizzes" subtitle="Quizzes assigned to you by your instructor." />
      {sorted.length === 0 ? (
        <EmptyState title="No quizzes assigned yet">When your instructor assigns you a quiz, it will appear here.</EmptyState>
      ) : (
        <div className="space-y-3">
          {sorted.map((a) => {
            const due = a.status === "ASSIGNED" ? dueState(a.dueDate, today) : null;
            return (
              <Link key={a.id} href={`/quizzes/${a.id}`} className="card group flex flex-wrap items-center justify-between gap-4 p-5 transition hover:border-brand-500/40 hover:shadow-md">
                <div className="min-w-0">
                  <h2 className="font-semibold group-hover:text-brand-700">{a.exam.title}</h2>
                  {a.exam.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{a.exam.description}</p>}
                  <p className="mt-2 text-xs text-muted">
                    {a.exam._count.questions} questions
                    {a.submittedAt && ` · submitted ${formatDateTime(a.submittedAt)}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {a.dueDate && a.status === "ASSIGNED" && (
                    <span className={`badge ${due === "overdue" ? "bg-red-50 text-red-700" : due === "soon" ? "bg-amber-50 text-amber-800" : "bg-surface-3 text-muted"}`}>{dueLabel(a.dueDate, today)}</span>
                  )}
                  <span className={`badge ${EXAM_STATUS_STYLE[a.status]}`}>{a.status === "ASSIGNED" ? "To do" : EXAM_STATUS_LABEL[a.status]}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

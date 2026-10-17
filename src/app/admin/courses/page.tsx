import Link from "next/link";
import { db } from "@/lib/db";
import { createCourse } from "@/app/actions/admin-courses";
import { CourseFields } from "@/components/CourseFields";
import { SubmitButton } from "@/components/SubmitButton";
import { EmptyState, LevelBadge, PageHeader } from "@/components/ui";

export const metadata = { title: "Course builder" };

export default async function CoursesPage() {
  const courses = await db.course.findMany({
    orderBy: { updatedAt: "desc" },
    include: { modules: { select: { _count: { select: { lessons: true } } } }, _count: { select: { modules: true, certificates: true } } },
  });

  return (
    <>
      <PageHeader title="Course builder" subtitle="Create courses, then organise them into modules and lessons." />
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          {courses.length === 0 && <EmptyState title="No courses yet">Create your first course using the form.</EmptyState>}
          {courses.map((c) => {
            const lessons = c.modules.reduce((n, m) => n + m._count.lessons, 0);
            return (
              <Link key={c.id} href={`/admin/courses/${c.id}`} className="card group block p-5 transition hover:border-brand-500/40 hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="font-semibold group-hover:text-brand-700">{c.title}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">{c.description || "No description"}</p>
                  </div>
                  <span className={`badge shrink-0 ${c.published ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {c.published ? "Published" : "Draft"}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                  <LevelBadge level={c.proficiencyLevel} />
                  <span>{c._count.modules} module{c._count.modules === 1 ? "" : "s"}</span>
                  <span>{lessons} lesson{lessons === 1 ? "" : "s"}</span>
                  <span>{c._count.certificates} completed</span>
                </div>
              </Link>
            );
          })}
        </div>
        <form action={createCourse} className="card h-fit space-y-4 p-5 lg:sticky lg:top-8">
          <h2 className="font-semibold">New course</h2>
          <CourseFields />
          <SubmitButton className="btn btn-primary w-full" pendingText="Creating…">Create course</SubmitButton>
        </form>
      </div>
    </>
  );
}

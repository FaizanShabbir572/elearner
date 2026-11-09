import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  createLesson, createModule, deleteCourse, deleteModule, moveLesson, moveModule, renameModule, updateCourse,
} from "@/app/actions/admin-courses";
import { CourseFields } from "@/components/CourseFields";
import { ConfirmButton, SubmitButton } from "@/components/SubmitButton";
import { EmptyState } from "@/components/ui";

export const metadata = { title: "Edit course" };

const Arrow = ({ up }: { up?: boolean }) => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d={up ? "m18 15-6-6-6 6" : "m6 9 6 6 6-6"} />
  </svg>
);

function MoveButtons({ id, action, first, last, label }: { id: string; action: (f: FormData) => Promise<void>; first: boolean; last: boolean; label: string }) {
  return (
    <form action={action} className="flex flex-col">
      <input type="hidden" name="id" value={id} />
      <button name="dir" value="up" disabled={first} aria-label={`Move ${label} up`} className="rounded p-0.5 text-faint hover:bg-surface-3 hover:text-ink-2 disabled:invisible"><Arrow up /></button>
      <button name="dir" value="down" disabled={last} aria-label={`Move ${label} down`} className="rounded p-0.5 text-faint hover:bg-surface-3 hover:text-ink-2 disabled:invisible"><Arrow /></button>
    </form>
  );
}

export default async function EditCoursePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const { saved } = await searchParams;
  const course = await db.course.findUnique({
    where: { id },
    include: {
      modules: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        include: { lessons: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true, title: true, videoUrl: true } } },
      },
    },
  });
  if (!course) notFound();
  const lessonCount = course.modules.reduce((n, m) => n + m.lessons.length, 0);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/courses" className="text-sm text-muted hover:text-ink">← All courses</Link>
          <h1 className="mt-1 heading-accent text-2xl font-bold tracking-tight">{course.title}</h1>
        </div>
        <Link href={`/courses/${course.id}`} className="btn btn-secondary">Preview as student</Link>
      </div>
      {saved && <p className="mb-5 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">Lesson saved.</p>}

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* Curriculum */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Curriculum</h2>
            <span className="text-sm text-muted">{course.modules.length} modules · {lessonCount} lessons</span>
          </div>

          {course.modules.length === 0 && <EmptyState title="No modules yet">Add a module below, then add lessons inside it.</EmptyState>}

          {course.modules.map((m, mi) => (
            <div key={m.id} className="card overflow-hidden">
              <div className="flex items-center gap-2 border-b border-line bg-surface-2/70 px-3 py-2.5">
                <MoveButtons id={m.id} action={moveModule} first={mi === 0} last={mi === course.modules.length - 1} label={m.title} />
                <span className="text-xs font-semibold text-faint">M{mi + 1}</span>
                <form action={renameModule} className="flex min-w-0 flex-1 items-center gap-2">
                  <input type="hidden" name="id" value={m.id} />
                  <input name="title" defaultValue={m.title} aria-label="Module title" required
                    className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 font-medium text-ink hover:border-line-strong focus:border-brand-500 focus:bg-surface focus:outline-none" />
                  <SubmitButton className="btn btn-ghost btn-sm">Rename</SubmitButton>
                </form>
                <form action={deleteModule}>
                  <input type="hidden" name="id" value={m.id} />
                  <ConfirmButton message={`Delete module "${m.title}" and all ${m.lessons.length} of its lessons?`} className="btn btn-ghost btn-sm text-red-600 hover:bg-red-50">Delete</ConfirmButton>
                </form>
              </div>

              <ul className="divide-y divide-line/70">
                {m.lessons.map((l, li) => (
                  <li key={l.id} className={`flex items-center gap-2 px-3 py-2 ${saved === l.id ? "bg-emerald-50/60" : ""}`}>
                    <MoveButtons id={l.id} action={moveLesson} first={li === 0} last={li === m.lessons.length - 1} label={l.title} />
                    <Link href={`/admin/courses/${course.id}/lessons/${l.id}`} className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 hover:bg-surface-2">
                      <span className="w-7 text-xs text-faint">{mi + 1}.{li + 1}</span>
                      <span className="truncate text-sm text-ink">{l.title}</span>
                      {l.videoUrl && <span className="badge bg-surface-3 text-muted">Video</span>}
                    </Link>
                    <Link href={`/admin/courses/${course.id}/lessons/${l.id}`} className="btn btn-ghost btn-sm">Edit</Link>
                  </li>
                ))}
                <li className="px-3 py-2.5">
                  <form action={createLesson} className="flex gap-2 pl-7">
                    <input type="hidden" name="moduleId" value={m.id} />
                    <input name="title" required placeholder="New lesson title" className="input py-1.5" aria-label={`New lesson in ${m.title}`} />
                    <SubmitButton className="btn btn-secondary btn-sm shrink-0">+ Add lesson</SubmitButton>
                  </form>
                </li>
              </ul>
            </div>
          ))}

          <form action={createModule} className="card flex gap-2 border-dashed p-3">
            <input type="hidden" name="courseId" value={course.id} />
            <input name="title" required placeholder="New module title" className="input" aria-label="New module title" />
            <SubmitButton className="btn btn-primary shrink-0">+ Add module</SubmitButton>
          </form>
        </section>

        {/* Course settings */}
        <aside className="space-y-4">
          <form action={updateCourse} className="card space-y-4 p-5">
            <h2 className="font-semibold">Course details</h2>
            <input type="hidden" name="id" value={course.id} />
            <CourseFields course={course} />
            <label className="flex items-start gap-3 rounded-lg border border-line p-3">
              <input type="checkbox" name="published" defaultChecked={course.published} className="mt-0.5 h-4 w-4 accent-brand-600" />
              <span>
                <span className="block text-sm font-medium text-ink">Published</span>
                <span className="block text-xs text-muted">Visible to approved students at this level.</span>
              </span>
            </label>
            <SubmitButton className="btn btn-primary w-full" pendingText="Saving…">Save details</SubmitButton>
          </form>
          <form action={deleteCourse} className="card flex items-center justify-between gap-3 p-4">
            <input type="hidden" name="id" value={course.id} />
            <p className="text-xs text-muted">Deleting removes all modules, lessons, progress and certificates.</p>
            <ConfirmButton message={`Delete "${course.title}" permanently?`}>Delete course</ConfirmButton>
          </form>
        </aside>
      </div>
    </>
  );
}

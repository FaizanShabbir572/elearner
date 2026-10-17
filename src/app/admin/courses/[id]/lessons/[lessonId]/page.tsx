import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { deleteLesson } from "@/app/actions/admin-courses";
import { LessonEditor } from "@/components/LessonEditor";
import { ConfirmButton } from "@/components/SubmitButton";

export const metadata = { title: "Edit lesson" };

export default async function EditLessonPage({ params }: { params: Promise<{ id: string; lessonId: string }> }) {
  const { id, lessonId } = await params;
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, include: { module: { include: { course: true } } } });
  if (!lesson || lesson.module.courseId !== id) notFound();

  return (
    <div className="max-w-3xl">
      <Link href={`/admin/courses/${id}`} className="text-sm text-slate-500 hover:text-slate-800">← {lesson.module.course.title}</Link>
      <div className="mt-1 mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">{lesson.module.title}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Edit lesson</h1>
        </div>
        <form action={deleteLesson}>
          <input type="hidden" name="id" value={lesson.id} />
          <ConfirmButton message={`Delete lesson "${lesson.title}"?`}>Delete lesson</ConfirmButton>
        </form>
      </div>
      <LessonEditor lesson={lesson} />
    </div>
  );
}

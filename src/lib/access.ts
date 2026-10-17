import "server-only";
import { db } from "./db";
import { canAccessCourse } from "./courses";
import type { CurrentUser } from "./auth";

/** The lesson (with its course id) if the user may open it, otherwise null. */
export async function accessibleLesson(user: CurrentUser, lessonId: unknown) {
  if (typeof lessonId !== "string" || !lessonId) return null;
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, title: true, content: true, module: { select: { courseId: true, course: { select: { published: true, proficiencyLevel: true } } } } },
  });
  if (!lesson || !canAccessCourse(user, lesson.module.course)) return null;
  return { id: lesson.id, title: lesson.title, content: lesson.content, courseId: lesson.module.courseId };
}

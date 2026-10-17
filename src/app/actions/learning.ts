"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireApproved } from "@/lib/auth";
import { issueCertificateIfComplete } from "@/lib/progress";
import { canAccessCourse } from "@/lib/courses";

export async function setLessonComplete(form: FormData) {
  const user = await requireApproved();
  const lessonId = String(form.get("lessonId"));
  const completed = form.get("completed") === "true";

  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, include: { module: { include: { course: true } } } });
  if (!lesson || !canAccessCourse(user, lesson.module.course)) throw new Error("Lesson not available");

  await db.progress.upsert({
    where: { userId_lessonId: { userId: user.id, lessonId } },
    create: { userId: user.id, lessonId, completed },
    update: { completed },
  });

  const courseId = lesson.module.courseId;
  if (completed) await issueCertificateIfComplete(user.id, courseId);

  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/dashboard");
}

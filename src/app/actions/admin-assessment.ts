"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { regenerateAssessment, type Question } from "@/lib/assessment";

async function pathFor(lessonId: string) {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { module: { select: { courseId: true } } } });
  return lesson ? `/admin/courses/${lesson.module.courseId}/lessons/${lessonId}` : null;
}

export async function regenerateQuiz(form: FormData) {
  await requireAdmin();
  const lessonId = String(form.get("lessonId") ?? "");
  await regenerateAssessment(lessonId);
  const path = await pathFor(lessonId);
  if (path) revalidatePath(path);
}

export async function removeQuizQuestion(form: FormData) {
  await requireAdmin();
  const lessonId = String(form.get("lessonId") ?? "");
  const questionId = String(form.get("questionId") ?? "");
  const row = await db.lessonAssessment.findUnique({ where: { lessonId } });
  if (!row) return;
  let questions: Question[] = [];
  try {
    questions = JSON.parse(row.questionsJson);
  } catch {}
  await db.lessonAssessment.update({
    where: { lessonId },
    data: { questionsJson: JSON.stringify(questions.filter((q) => q.id !== questionId)) },
  });
  const path = await pathFor(lessonId);
  if (path) revalidatePath(path);
}

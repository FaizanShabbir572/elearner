"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireApproved } from "@/lib/auth";
import { parseAnswers } from "@/lib/exams";

type Result = { ok: true } | { ok: false; error: string };

/** The current student's own assignment, only while it can still be answered. */
async function openAssignment(userId: string, assignmentId: unknown) {
  if (typeof assignmentId !== "string") return null;
  const a = await db.examAssignment.findFirst({ where: { id: assignmentId, userId }, select: { id: true, examId: true, status: true } });
  return a && a.status === "ASSIGNED" ? a : null;
}

/** Keep only answers to questions that belong to this quiz. */
async function cleanAnswers(examId: string, raw: unknown) {
  const ids = new Set((await db.examQuestion.findMany({ where: { examId }, select: { id: true } })).map((q) => q.id));
  return Object.fromEntries(Object.entries(parseAnswers(raw)).filter(([qid]) => ids.has(qid)));
}

/** Autosave progress while taking the quiz. */
export async function saveExamAnswers(assignmentId: string, answers: Record<string, number>): Promise<Result> {
  const user = await requireApproved();
  const a = await openAssignment(user.id, assignmentId);
  if (!a) return { ok: false, error: "This quiz is no longer open." };
  await db.examAssignment.update({ where: { id: a.id }, data: { answersJson: JSON.stringify(await cleanAnswers(a.examId, answers)) } });
  return { ok: true };
}

/** Submit for review. The score is computed here; an admin then marks it pass or fail. */
export async function submitExam(assignmentId: string, answers: Record<string, number>): Promise<Result> {
  const user = await requireApproved();
  const a = await openAssignment(user.id, assignmentId);
  if (!a) return { ok: false, error: "This quiz has already been submitted." };
  const clean = await cleanAnswers(a.examId, answers);
  const questions = await db.examQuestion.findMany({ where: { examId: a.examId }, select: { id: true, correctIndex: true } });
  const score = questions.filter((q) => clean[q.id] === q.correctIndex).length;
  // updateMany with the status guard makes a double submit a no-op.
  await db.examAssignment.updateMany({
    where: { id: a.id, userId: user.id, status: "ASSIGNED" },
    data: { status: "SUBMITTED", answersJson: JSON.stringify(clean), score, total: questions.length, submittedAt: new Date() },
  });
  revalidatePath("/quizzes");
  revalidatePath(`/quizzes/${a.id}`);
  revalidatePath(`/admin/exams/${a.examId}`);
  return { ok: true };
}

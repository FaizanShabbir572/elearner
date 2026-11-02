"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { parseDueDate } from "@/lib/due";
import { EXAM_MAX_QUESTIONS, EXAM_MIN_QUESTIONS } from "@/lib/constants";
import { cleanQuestion, examLocked, parseImport } from "@/lib/exams";

export type FormResult = { error?: string; ok?: string } | undefined;

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function refresh(examId: string) {
  revalidatePath("/admin/exams");
  revalidatePath(`/admin/exams/${examId}`);
  revalidatePath("/quizzes");
}

function cleanPassMark(v: string) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 60;
}

/* ----------------------------- Quizzes ----------------------------- */

export async function createExam(form: FormData) {
  await requireAdmin();
  const title = str(form, "title");
  if (!title) return;
  const exam = await db.exam.create({ data: { title, description: str(form, "description"), passMark: cleanPassMark(str(form, "passMark")) } });
  revalidatePath("/admin/exams");
  redirect(`/admin/exams/${exam.id}`);
}

export async function updateExam(form: FormData) {
  await requireAdmin();
  const id = str(form, "id");
  const title = str(form, "title");
  if (!title) return;
  await db.exam.update({ where: { id }, data: { title, description: str(form, "description"), passMark: cleanPassMark(str(form, "passMark")) } });
  refresh(id);
}

export async function deleteExam(form: FormData) {
  await requireAdmin();
  await db.exam.delete({ where: { id: str(form, "id") } });
  revalidatePath("/admin/exams");
  revalidatePath("/quizzes");
  redirect("/admin/exams");
}

/* ----------------------------- Questions ----------------------------- */

const LOCKED = "Questions are locked because students have already submitted this quiz.";

export async function addQuestion(_: FormResult, form: FormData): Promise<FormResult> {
  await requireAdmin();
  const examId = str(form, "examId");
  if (await examLocked(examId)) return { error: LOCKED };
  const count = await db.examQuestion.count({ where: { examId } });
  if (count >= EXAM_MAX_QUESTIONS) return { error: `A quiz can have at most ${EXAM_MAX_QUESTIONS} questions.` };
  const q = cleanQuestion(form.get("text"), ["A", "B", "C", "D"].map((l) => form.get(`option${l}`)), form.get("correct"));
  if (typeof q === "string") return { error: q };
  await db.examQuestion.create({ data: { examId, text: q.text, options: JSON.stringify(q.options), correctIndex: q.correctIndex, order: count } });
  refresh(examId);
  return { ok: `Question ${count + 1} added.` };
}

export async function updateQuestion(_: FormResult, form: FormData): Promise<FormResult> {
  await requireAdmin();
  const id = str(form, "id");
  const existing = await db.examQuestion.findUnique({ where: { id }, select: { examId: true } });
  if (!existing) return { error: "Question not found." };
  if (await examLocked(existing.examId)) return { error: LOCKED };
  const q = cleanQuestion(form.get("text"), ["A", "B", "C", "D"].map((l) => form.get(`option${l}`)), form.get("correct"));
  if (typeof q === "string") return { error: q };
  await db.examQuestion.update({ where: { id }, data: { text: q.text, options: JSON.stringify(q.options), correctIndex: q.correctIndex } });
  refresh(existing.examId);
  return { ok: "Saved." };
}

export async function deleteQuestion(form: FormData) {
  await requireAdmin();
  const q = await db.examQuestion.findUnique({ where: { id: str(form, "id") }, select: { id: true, examId: true } });
  if (!q || (await examLocked(q.examId))) return;
  await db.examQuestion.delete({ where: { id: q.id } });
  // Renumber so order stays 0..n-1.
  const rest = await db.examQuestion.findMany({ where: { examId: q.examId }, orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true } });
  await db.$transaction(rest.map((r, i) => db.examQuestion.update({ where: { id: r.id }, data: { order: i } })));
  refresh(q.examId);
}

export async function importQuestions(_: FormResult, form: FormData): Promise<FormResult> {
  await requireAdmin();
  const examId = str(form, "examId");
  if (await examLocked(examId)) return { error: LOCKED };
  const { questions, errors } = parseImport(String(form.get("text") ?? ""));
  if (errors.length) return { error: `Nothing was imported. Fix these and try again:\n${errors.slice(0, 10).join("\n")}${errors.length > 10 ? `\n…and ${errors.length - 10} more` : ""}` };
  if (questions.length === 0) return { error: "No questions found. Check the format shown below the box." };
  const count = await db.examQuestion.count({ where: { examId } });
  if (count + questions.length > EXAM_MAX_QUESTIONS) {
    return { error: `This would make ${count + questions.length} questions; the maximum is ${EXAM_MAX_QUESTIONS}. Nothing was imported.` };
  }
  await db.examQuestion.createMany({
    data: questions.map((q, i) => ({ examId, text: q.text, options: JSON.stringify(q.options), correctIndex: q.correctIndex, order: count + i })),
  });
  refresh(examId);
  return { ok: `Imported ${questions.length} question${questions.length === 1 ? "" : "s"}.` };
}

/* ----------------------------- Assigning ----------------------------- */

export async function assignExam(_: FormResult, form: FormData): Promise<FormResult> {
  await requireAdmin();
  const examId = str(form, "examId");
  const count = await db.examQuestion.count({ where: { examId } });
  if (count < EXAM_MIN_QUESTIONS || count > EXAM_MAX_QUESTIONS) {
    return { error: `A quiz needs 1–${EXAM_MAX_QUESTIONS} questions before it can be assigned (it has ${count}).` };
  }
  const requested = form.getAll("userIds").map(String);
  if (requested.length === 0) return { error: "Select at least one student." };
  // Only approved students can be assigned; skip anyone who already has it.
  const students = await db.user.findMany({ where: { id: { in: requested }, role: "STUDENT", status: "APPROVED" }, select: { id: true } });
  const already = new Set((await db.examAssignment.findMany({ where: { examId, userId: { in: students.map((s) => s.id) } }, select: { userId: true } })).map((a) => a.userId));
  const dueDate = parseDueDate(str(form, "dueDate"));
  const fresh = students.filter((s) => !already.has(s.id));
  if (fresh.length) await db.examAssignment.createMany({ data: fresh.map((s) => ({ examId, userId: s.id, dueDate })) });
  refresh(examId);
  return { ok: `Assigned to ${fresh.length} student${fresh.length === 1 ? "" : "s"}${already.size ? ` (${already.size} already had it)` : ""}.` };
}

export async function unassignExam(form: FormData) {
  await requireAdmin();
  const a = await db.examAssignment.findUnique({ where: { id: str(form, "id") }, select: { id: true, examId: true } });
  if (!a) return;
  await db.examAssignment.delete({ where: { id: a.id } });
  refresh(a.examId);
}

/* ----------------------------- Reviewing ----------------------------- */

export async function reviewAssignment(form: FormData) {
  await requireAdmin();
  const id = str(form, "id");
  const result = str(form, "result");
  if (result !== "PASSED" && result !== "FAILED") return;
  const a = await db.examAssignment.findUnique({ where: { id }, select: { examId: true, status: true } });
  if (!a || a.status === "ASSIGNED") return; // can only mark a submitted quiz
  await db.examAssignment.update({ where: { id }, data: { status: result, reviewNote: str(form, "reviewNote").slice(0, 2000), reviewedAt: new Date() } });
  refresh(a.examId);
  revalidatePath(`/admin/exams/${a.examId}/review/${id}`);
}

/** Let the student take it again: clears their answers, score and result. */
export async function reopenAssignment(form: FormData) {
  await requireAdmin();
  const id = str(form, "id");
  const a = await db.examAssignment.findUnique({ where: { id }, select: { examId: true } });
  if (!a) return;
  await db.examAssignment.update({
    where: { id },
    data: { status: "ASSIGNED", answersJson: "{}", score: null, total: null, submittedAt: null, reviewedAt: null, reviewNote: "" },
  });
  refresh(a.examId);
  redirect(`/admin/exams/${a.examId}`);
}

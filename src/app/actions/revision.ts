"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireApproved } from "@/lib/auth";
import { accessibleLesson } from "@/lib/access";
import type { Question } from "@/lib/assessment";

const MAX_VIDEO_SEC = 24 * 60 * 60;
const WATCHED_RATIO = 0.8;

/** Called by the player every ~20 s while a video plays. */
export async function recordWatchProgress(lessonId: string, positionSec: number, durationSec: number | null) {
  const user = await requireApproved();
  if (!(await accessibleLesson(user, lessonId))) return;
  const valid = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= MAX_VIDEO_SEC;
  if (!valid(positionSec)) return;
  const duration = valid(durationSec) && durationSec > 0 ? Math.round(durationSec) : null;
  const position = Math.round(duration ? Math.min(positionSec, duration) : positionSec);

  const where = { userId_lessonId: { userId: user.id, lessonId } };
  const existing = await db.lessonView.findUnique({ where, select: { maxPositionSec: true, durationSec: true, watched: true } });
  const max = Math.max(existing?.maxPositionSec ?? 0, position);
  const dur = duration ?? existing?.durationSec ?? null;
  const watched = (existing?.watched ?? false) || (dur !== null && max >= dur * WATCHED_RATIO);
  const now = new Date();
  await db.lessonView.upsert({
    where,
    create: { userId: user.id, lessonId, maxPositionSec: max, durationSec: dur, watched, firstWatchedAt: now, lastWatchedAt: now },
    update: { maxPositionSec: max, durationSec: dur, watched, lastWatchedAt: now },
  });
}

/** "Review" on a revision suggestion: note the review, then open the lesson. */
export async function markReviewed(form: FormData) {
  const user = await requireApproved();
  const lesson = await accessibleLesson(user, String(form.get("lessonId") ?? ""));
  if (!lesson) redirect("/revision");
  const now = new Date();
  await db.lessonView.upsert({
    where: { userId_lessonId: { userId: user.id, lessonId: lesson.id } },
    create: { userId: user.id, lessonId: lesson.id, lastReviewedAt: now, firstWatchedAt: now, lastWatchedAt: now },
    update: { lastReviewedAt: now },
  });
  revalidatePath("/revision");
  revalidatePath("/dashboard");
  redirect(`/courses/${lesson.courseId}?lesson=${lesson.id}`);
}

export type RecallAnswer = { lessonId: string; questionId: string; choice: number };
export type RecallResult = { lessonId: string; questionId: string; choice: number | null; correct: boolean; correctIndex: number; explanation: string; sourceQuote: string };

/** Grade a quick-recall round on the server; saved as RECALL attempts (one per lesson). */
export async function submitRecall(answers: RecallAnswer[]): Promise<{ ok: true; results: RecallResult[] } | { ok: false; error: string }> {
  const user = await requireApproved();
  const list = (Array.isArray(answers) ? answers : []).slice(0, 10).filter((a) => a && typeof a.lessonId === "string" && typeof a.questionId === "string");
  if (list.length === 0) return { ok: false, error: "No answers to grade." };

  const lessonIds = [...new Set(list.map((a) => a.lessonId))];
  const allowed = new Set<string>();
  for (const id of lessonIds) if (await accessibleLesson(user, id)) allowed.add(id);
  const assessments = await db.lessonAssessment.findMany({ where: { lessonId: { in: [...allowed] } }, select: { lessonId: true, questionsJson: true } });
  const questionBy = new Map<string, Question>();
  for (const a of assessments) {
    let qs: Question[] = [];
    try {
      qs = JSON.parse(a.questionsJson);
    } catch {}
    for (const q of qs) questionBy.set(`${a.lessonId}:${q.id}`, q);
  }

  const results: RecallResult[] = [];
  for (const a of list) {
    const q = questionBy.get(`${a.lessonId}:${a.questionId}`);
    if (!q) continue;
    const choice = Number.isInteger(a.choice) && a.choice >= 0 && a.choice < q.options.length ? a.choice : null;
    results.push({ lessonId: a.lessonId, questionId: q.id, choice, correct: choice === q.correctIndex, correctIndex: q.correctIndex, explanation: q.explanation, sourceQuote: q.sourceQuote });
  }
  if (results.length === 0) return { ok: false, error: "These questions have changed — please reload the page." };

  const byLesson = new Map<string, RecallResult[]>();
  for (const r of results) byLesson.set(r.lessonId, [...(byLesson.get(r.lessonId) ?? []), r]);
  await db.quizAttempt.createMany({
    data: [...byLesson].map(([lessonId, rs]) => {
      const score = rs.filter((r) => r.correct).length;
      return {
        userId: user.id,
        lessonId,
        kind: "RECALL",
        score,
        total: rs.length,
        percent: Math.round((score / rs.length) * 100),
        answersJson: JSON.stringify(Object.fromEntries(rs.map((r) => [r.questionId, { choice: r.choice, correct: r.correct }]))),
      };
    }),
  });
  return { ok: true, results };
}

import "server-only";
import { db } from "./db";
import { visibleCoursesWhere } from "./courses";
import { startOfToday } from "./due";
import { MIN_QUESTIONS, toPublic, type PublicQuestion, type Question } from "./assessment";
import type { CurrentUser } from "./auth";

/**
 * Automatic revision, computed on the fly from the student's own history — no cron jobs.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
export const REVISE_AFTER_DAYS = 7;
export const RECALL_SPACING_DAYS = 3;
const RECALL_MAX = 5;
const HISTORY_LIMIT = 1000;

type Student = Pick<CurrentUser, "id" | "role" | "proficiencyLevel">;

export async function actionReminder(userId: string) {
  const [open, overdue] = await Promise.all([
    db.action.count({ where: { userId, status: { not: "DONE" } } }),
    db.action.count({ where: { userId, status: { not: "DONE" }, dueDate: { lt: startOfToday() } } }),
  ]);
  return { open, overdue };
}

/** Completed lessons the student can still open, with when they last touched each one. */
async function completedLessons(user: Student) {
  const rows = await db.progress.findMany({
    where: { userId: user.id, completed: true, lesson: { module: { course: visibleCoursesWhere(user) } } },
    select: { lessonId: true, updatedAt: true, lesson: { select: { title: true, module: { select: { courseId: true, course: { select: { title: true } } } } } } },
  });
  const views = rows.length
    ? await db.lessonView.findMany({
        where: { userId: user.id, lessonId: { in: rows.map((r) => r.lessonId) } },
        select: { lessonId: true, lastWatchedAt: true, lastReviewedAt: true },
      })
    : [];
  const viewBy = new Map(views.map((v) => [v.lessonId, v]));
  return rows.map((r) => {
    const v = viewBy.get(r.lessonId);
    const times = [r.updatedAt, v?.lastWatchedAt, v?.lastReviewedAt].filter((d): d is Date => !!d).map((d) => d.getTime());
    return {
      lessonId: r.lessonId,
      title: r.lesson.title,
      courseId: r.lesson.module.courseId,
      courseTitle: r.lesson.module.course.title,
      lastActivity: new Date(Math.max(...times)),
    };
  });
}

/** Best full-quiz percentage per lesson (one grouped query). */
async function bestQuizPercent(userId: string, lessonIds: string[]) {
  if (lessonIds.length === 0) return new Map<string, number>();
  const groups = await db.quizAttempt.groupBy({
    by: ["lessonId"],
    where: { userId, kind: "QUIZ", isRetry: false, lessonId: { in: lessonIds } },
    _max: { percent: true },
  });
  return new Map(groups.map((g) => [g.lessonId, g._max.percent ?? 0]));
}

export type RevisionSuggestion = { lessonId: string; title: string; courseId: string; courseTitle: string; lastActivity: Date; bestQuiz: number | null };

/** Up to 3 completed lessons untouched for 7+ days, weakest quiz results first. */
export async function suggestedRevision(user: Student): Promise<RevisionSuggestion[]> {
  const lessons = await completedLessons(user);
  const cutoff = Date.now() - REVISE_AFTER_DAYS * DAY_MS;
  const stale = lessons.filter((l) => l.lastActivity.getTime() < cutoff);
  const best = await bestQuizPercent(user.id, stale.map((l) => l.lessonId));
  // No quiz taken yet counts as a middling score: below a good result, above a poor one.
  const rank = (id: string) => best.get(id) ?? 70;
  return stale
    .map((l) => ({ ...l, bestQuiz: best.get(l.lessonId) ?? null }))
    .sort((a, b) => rank(a.lessonId) - rank(b.lessonId) || a.lastActivity.getTime() - b.lastActivity.getTime())
    .slice(0, 3);
}

export type RecallItem = { lessonId: string; lessonTitle: string; question: PublicQuestion };

function parseQuestions(json: string): Question[] {
  try {
    const q = JSON.parse(json);
    return Array.isArray(q) ? q : [];
  } catch {
    return [];
  }
}

/**
 * 3–5 questions from quizzes of completed lessons: previously-wrong first, then lessons
 * least recently reviewed. A question answered correctly in recall rests for 3 days.
 */
export async function recallQuestions(user: Student): Promise<RecallItem[]> {
  const lessons = await completedLessons(user);
  if (lessons.length === 0) return [];
  const lessonIds = lessons.map((l) => l.lessonId);
  const [assessments, history] = await Promise.all([
    db.lessonAssessment.findMany({ where: { lessonId: { in: lessonIds } }, select: { lessonId: true, questionsJson: true } }),
    db.quizAttempt.findMany({
      where: { userId: user.id, lessonId: { in: lessonIds } },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
      select: { lessonId: true, kind: true, answersJson: true, createdAt: true },
    }),
  ]);

  // Most recent outcome per question, and when it was last answered correctly in recall.
  const lastCorrect = new Map<string, boolean>();
  const restingUntil = new Map<string, number>();
  for (const a of history) {
    let answers: Record<string, { correct?: boolean }> = {};
    try {
      answers = JSON.parse(a.answersJson);
    } catch {}
    for (const [qid, r] of Object.entries(answers)) {
      const key = `${a.lessonId}:${qid}`;
      if (!lastCorrect.has(key)) lastCorrect.set(key, !!r?.correct);
      if (a.kind === "RECALL" && r?.correct && !restingUntil.has(key)) restingUntil.set(key, a.createdAt.getTime() + RECALL_SPACING_DAYS * DAY_MS);
    }
  }

  const lessonBy = new Map(lessons.map((l) => [l.lessonId, l]));
  const now = Date.now();
  const candidates: (RecallItem & { wrongBefore: boolean; reviewedAt: number })[] = [];
  for (const a of assessments) {
    const questions = parseQuestions(a.questionsJson);
    if (questions.length < MIN_QUESTIONS) continue;
    const lesson = lessonBy.get(a.lessonId)!;
    for (const q of questions) {
      const key = `${a.lessonId}:${q.id}`;
      if ((restingUntil.get(key) ?? 0) > now) continue;
      candidates.push({
        lessonId: a.lessonId,
        lessonTitle: lesson.title,
        question: toPublic(q),
        wrongBefore: lastCorrect.get(key) === false,
        reviewedAt: lesson.lastActivity.getTime(),
      });
    }
  }
  candidates.sort((x, y) => Number(y.wrongBefore) - Number(x.wrongBefore) || x.reviewedAt - y.reviewedAt || x.question.id.localeCompare(y.question.id));
  return candidates.slice(0, RECALL_MAX).map(({ lessonId, lessonTitle, question }) => ({ lessonId, lessonTitle, question }));
}

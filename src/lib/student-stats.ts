import "server-only";
import { db } from "./db";
import { visibleCoursesWhere } from "./courses";
import type { CurrentUser } from "./auth";

export type CourseStats = { videosWatched: number; videosTotal: number; avgQuiz: number | null };
export type StudentStats = {
  videos: { watched: number; total: number };
  notes: number;
  actions: { done: number; total: number };
  avgQuiz: number | null;
  challengesCompleted: number;
  perCourse: Map<string, CourseStats>;
};

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

/**
 * Progress numbers for one student, from counts and grouped queries scoped to that student
 * (plus the catalogue of video lessons they can see). Used by the dashboard and the admin view.
 */
export async function getStudentStats(student: Pick<CurrentUser, "id" | "role" | "proficiencyLevel">): Promise<StudentStats> {
  const userId = student.id;
  const visible = { module: { course: visibleCoursesWhere(student) } };

  const [videoLessons, watchedViews, notes, actionGroups, quizBest, challengesCompleted] = await Promise.all([
    db.lesson.findMany({ where: { ...visible, videoUrl: { not: null } }, select: { id: true, module: { select: { courseId: true } } } }),
    db.lessonView.findMany({ where: { userId, watched: true, lesson: visible }, select: { lessonId: true } }),
    db.lessonNote.count({ where: { userId } }),
    db.action.groupBy({ by: ["status"], where: { userId }, _count: true }),
    db.quizAttempt.groupBy({ by: ["lessonId"], where: { userId, kind: "QUIZ", isRetry: false, lesson: visible }, _max: { percent: true } }),
    db.challengeResponse.count({ where: { userId, completedAt: { not: null } } }),
  ]);

  // Course of each quiz lesson (only the lessons this student has attempted).
  const quizLessons = quizBest.length
    ? await db.lesson.findMany({ where: { id: { in: quizBest.map((q) => q.lessonId) } }, select: { id: true, module: { select: { courseId: true } } } })
    : [];
  const courseOf = new Map([...videoLessons, ...quizLessons].map((l) => [l.id, l.module.courseId]));
  const watched = new Set(watchedViews.map((v) => v.lessonId));

  const perCourse = new Map<string, CourseStats & { quiz: number[] }>();
  const entry = (courseId: string) => {
    let e = perCourse.get(courseId);
    if (!e) perCourse.set(courseId, (e = { videosWatched: 0, videosTotal: 0, avgQuiz: null, quiz: [] }));
    return e;
  };
  for (const l of videoLessons) {
    const e = entry(l.module.courseId);
    e.videosTotal++;
    if (watched.has(l.id)) e.videosWatched++;
  }
  for (const q of quizBest) {
    const c = courseOf.get(q.lessonId);
    if (c) entry(c).quiz.push(q._max.percent ?? 0);
  }
  for (const e of perCourse.values()) e.avgQuiz = avg(e.quiz);

  const countOf = (s: string) => actionGroups.find((g) => g.status === s)?._count ?? 0;
  return {
    videos: { watched: videoLessons.filter((l) => watched.has(l.id)).length, total: videoLessons.length },
    notes,
    actions: { done: countOf("DONE"), total: actionGroups.reduce((a, g) => a + g._count, 0) },
    avgQuiz: avg(quizBest.map((q) => q._max.percent ?? 0)),
    challengesCompleted,
    perCourse: new Map([...perCourse].map(([k, { videosWatched, videosTotal, avgQuiz }]) => [k, { videosWatched, videosTotal, avgQuiz }])),
  };
}

/** The five headline numbers, ready for stat cards. */
export function statCards(s: StudentStats): [string, string][] {
  return [
    ["Videos watched", `${s.videos.watched} / ${s.videos.total}`],
    ["Notes created", String(s.notes)],
    ["Actions completed", `${s.actions.done} / ${s.actions.total}`],
    ["Average best quiz score", s.avgQuiz === null ? "—" : `${s.avgQuiz}%`],
    ["Challenges completed", String(s.challengesCompleted)],
  ];
}

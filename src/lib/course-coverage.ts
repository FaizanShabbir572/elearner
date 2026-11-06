import "server-only";
import { db } from "./db";
import { canAccessCourse } from "./courses";
import type { CurrentUser } from "./auth";

export type CourseCoverage = { id: string; title: string; total: number; done: number; percent: number; finished: boolean };
export type Coverage = { courses: CourseCoverage[]; total: number; done: number; percent: number };

const percentOf = (done: number, total: number) => (total ? Math.round((done / total) * 100) : 0);

/**
 * How much of their track each approved student has covered, counting only the courses they can
 * open today. Courses without lessons are skipped, and a certificate counts as finished even if it
 * was issued by an admin before the lessons were done. Other students get no entry.
 */
export async function getCourseCoverage(students: Pick<CurrentUser, "id" | "role" | "status" | "proficiencyLevel">[]) {
  const learners = students.filter((s) => s.role === "STUDENT" && s.status === "APPROVED");
  const coverage = new Map<string, Coverage>();
  if (learners.length === 0) return coverage;

  const ids = learners.map((s) => s.id);
  const [catalogue, progress, certificates] = await Promise.all([
    db.course.findMany({
      where: { published: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true, published: true, proficiencyLevel: true, modules: { select: { lessons: { select: { id: true } } } } },
    }),
    db.progress.findMany({ where: { userId: { in: ids }, completed: true }, select: { userId: true, lessonId: true } }),
    db.certificate.findMany({ where: { userId: { in: ids } }, select: { userId: true, courseId: true } }),
  ]);

  const doneKeys = new Set(progress.map((p) => `${p.userId}:${p.lessonId}`));
  const certKeys = new Set(certificates.map((c) => `${c.userId}:${c.courseId}`));

  for (const student of learners) {
    const courses: CourseCoverage[] = [];
    for (const course of catalogue) {
      if (!canAccessCourse(student, course)) continue;
      const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
      if (lessonIds.length === 0) continue;
      const done = lessonIds.filter((id) => doneKeys.has(`${student.id}:${id}`)).length;
      courses.push({
        id: course.id,
        title: course.title,
        total: lessonIds.length,
        done,
        percent: percentOf(done, lessonIds.length),
        finished: done >= lessonIds.length || certKeys.has(`${student.id}:${course.id}`),
      });
    }
    const total = courses.reduce((sum, c) => sum + c.total, 0);
    const done = courses.reduce((sum, c) => sum + c.done, 0);
    coverage.set(student.id, { courses, total, done, percent: percentOf(done, total) });
  }
  return coverage;
}

/** Unfinished courses, closest to completion first: the first one is what a quick reminder is about. */
export function unfinishedCourses(coverage: Coverage | undefined) {
  return (coverage?.courses ?? []).filter((c) => !c.finished).sort((a, b) => b.percent - a.percent);
}

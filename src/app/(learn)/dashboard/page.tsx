import Link from "next/link";
import { requireApproved } from "@/lib/auth";
import { db } from "@/lib/db";
import { LEVEL_LABEL } from "@/lib/constants";
import { visibleCoursesWhere } from "@/lib/courses";
import { EmptyState, LevelBadge, ProgressBar } from "@/components/ui";

export const metadata = { title: "My courses" };

export default async function DashboardPage() {
  const user = await requireApproved();
  const isAdmin = user.role === "ADMIN";

  const [courses, done, certs] = await Promise.all([
    db.course.findMany({
      where: visibleCoursesWhere(user),
      orderBy: { createdAt: "asc" },
      include: { modules: { select: { lessons: { select: { id: true } } } } },
    }),
    db.progress.findMany({ where: { userId: user.id, completed: true }, select: { lessonId: true } }),
    db.certificate.findMany({ where: { userId: user.id }, include: { course: { select: { title: true } } }, orderBy: { issuedAt: "desc" } }),
  ]);
  const doneSet = new Set(done.map((d) => d.lessonId));
  const certByCourse = new Map(certs.map((c) => [c.courseId, c]));

  const cards = courses.map((c) => {
    const ids = c.modules.flatMap((m) => m.lessons.map((l) => l.id));
    const completed = ids.filter((id) => doneSet.has(id)).length;
    return { ...c, total: ids.length, completed, percent: ids.length ? Math.round((completed / ids.length) * 100) : 0 };
  });
  const inProgress = cards.filter((c) => c.completed > 0 && c.percent < 100).length;

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-10 md:py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">{isAdmin ? "Student view" : `Welcome back, ${user.name.split(" ")[0]}`}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isAdmin
            ? "As an admin you can preview every course, including drafts."
            : <>Your learning track: <strong className="text-slate-700">{LEVEL_LABEL[user.proficiencyLevel ?? ""] ?? "Unassigned"}</strong></>}
        </p>
      </div>

      <div className="mb-8 grid grid-cols-3 gap-3 sm:gap-4">
        {[
          ["Available courses", cards.length],
          ["In progress", inProgress],
          ["Certificates earned", certs.length],
        ].map(([label, value]) => (
          <div key={label} className="card p-4 sm:p-5">
            <p className="text-2xl font-semibold text-slate-900">{value}</p>
            <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{label}</p>
          </div>
        ))}
      </div>

      {cards.length === 0 ? (
        <EmptyState title="No courses for your level yet">New courses for your track will show up here as soon as they're published.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => {
            const cert = certByCourse.get(c.id);
            return (
              <div key={c.id} className="card flex flex-col p-5">
                <div className="mb-3 flex items-center gap-2">
                  <LevelBadge level={c.proficiencyLevel} />
                  {isAdmin && !c.published && <span className="badge bg-slate-100 text-slate-600">Draft</span>}
                  {cert && <span className="badge bg-emerald-50 text-emerald-700">Completed</span>}
                </div>
                <h2 className="font-semibold">{c.title}</h2>
                <p className="mt-1 line-clamp-3 flex-1 text-sm text-slate-500">{c.description}</p>
                <div className="mt-5">
                  <div className="mb-1.5 flex justify-between text-xs text-slate-500">
                    <span>{c.completed} of {c.total} lessons</span>
                    <span className="font-medium text-slate-700">{c.percent}%</span>
                  </div>
                  <ProgressBar percent={c.percent} />
                </div>
                <div className="mt-5 flex gap-2">
                  <Link href={`/courses/${c.id}`} className="btn btn-primary flex-1">
                    {c.percent === 100 ? "Review course" : c.completed > 0 ? "Continue" : "Start course"}
                  </Link>
                  {cert && <a href={`/certificates/${cert.id}`} className="btn btn-secondary">Certificate</a>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {certs.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 font-semibold">My certificates</h2>
          <div className="card divide-y divide-slate-100">
            {certs.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium text-slate-900">{c.course.title}</p>
                  <p className="text-xs text-slate-500">
                    {c.certificateNumber} · Issued {c.issuedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                <a href={`/certificates/${c.id}`} className="btn btn-secondary btn-sm">Download PDF</a>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

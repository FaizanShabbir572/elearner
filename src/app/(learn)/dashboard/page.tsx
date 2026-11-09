import Link from "next/link";
import { requireApproved } from "@/lib/auth";
import { db } from "@/lib/db";
import { LEVEL_LABEL } from "@/lib/constants";
import { visibleCoursesWhere } from "@/lib/courses";
import { DraftBadge, EmptyState, IconTile, LevelBadge, PageHeader, ProgressBar, SectionTitle, StatCard } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { CourseArt } from "@/components/art";
import { startOfToday } from "@/lib/due";
import { ACTION_CARD_SELECT, URGENCY_ORDER, toCardData } from "@/lib/student-actions";
import { getStudentStats, statCards } from "@/lib/student-stats";
import { KeepItFresh } from "@/components/KeepItFresh";

export const metadata = { title: "My courses" };

const STAT_ICON: Record<string, IconName> = {
  "Videos watched": "playCircle",
  "Notes created": "notes",
  "Actions completed": "circleCheck",
  "Average best quiz score": "barChart",
  "Challenges completed": "trophy",
};

export default async function DashboardPage() {
  const user = await requireApproved();
  const isAdmin = user.role === "ADMIN";

  const today = startOfToday();
  const [courses, done, certs, openActionCount, urgentActions, stats] = await Promise.all([
    db.course.findMany({
      where: visibleCoursesWhere(user),
      orderBy: { createdAt: "asc" },
      include: { modules: { select: { lessons: { select: { id: true } } } } },
    }),
    db.progress.findMany({ where: { userId: user.id, completed: true }, select: { lessonId: true } }),
    db.certificate.findMany({ where: { userId: user.id }, include: { course: { select: { title: true } } }, orderBy: { issuedAt: "desc" } }),
    db.action.count({ where: { userId: user.id, status: { not: "DONE" } } }),
    db.action.findMany({ where: { userId: user.id, status: { not: "DONE" } }, orderBy: URGENCY_ORDER, take: 3, select: ACTION_CARD_SELECT }),
    getStudentStats(user),
  ]);
  const urgent = urgentActions.map((a) => toCardData(a, today));
  const doneSet = new Set(done.map((d) => d.lessonId));
  const certByCourse = new Map(certs.map((c) => [c.courseId, c]));

  const cards = courses.map((c) => {
    const ids = c.modules.flatMap((m) => m.lessons.map((l) => l.id));
    const completed = ids.filter((id) => doneSet.has(id)).length;
    return { ...c, total: ids.length, completed, percent: ids.length ? Math.round((completed / ids.length) * 100) : 0 };
  });
  const inProgress = cards.filter((c) => c.completed > 0 && c.percent < 100).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 md:px-10 md:py-10">
      <PageHeader
        title={isAdmin ? "Student View" : `Welcome back, ${user.name.split(" ")[0]}`}
        subtitle={isAdmin
          ? "As an admin you can preview every course, including drafts."
          : <>Your learning track: <strong className="text-ink-2">{LEVEL_LABEL[user.proficiencyLevel ?? ""] ?? "Unassigned"}</strong></>}
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-3 sm:gap-4 lg:gap-6">
        <StatCard icon="cap" value={cards.length} label="Available courses" />
        <StatCard icon="pulse" value={inProgress} label="In progress" />
        <StatCard icon="award" value={certs.length} label="Certificates earned" />
      </div>

      <section className="mb-8" aria-labelledby="progress-heading">
        <SectionTitle><span id="progress-heading">Your progress</span></SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {statCards(stats).map(([label, value]) => (
            <StatCard key={label} size="sm" icon={STAT_ICON[label] ?? "barChart"} value={value} label={label} />
          ))}
        </div>
      </section>

      <KeepItFresh user={user} variant="dashboard" />

      <section className="card card-glow mb-8 p-4 sm:p-5" aria-labelledby="actions-heading">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <IconTile name="clipboard" />
            <div className="min-w-0">
              <h2 id="actions-heading" className="font-semibold">Your open actions</h2>
              <p className="text-sm text-muted">
                {openActionCount === 0 ? "No open actions. Turn what you learn into practice tasks." : `${openActionCount} open action${openActionCount === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>
          <Link href="/actions" className="btn btn-secondary max-sm:w-full">
            {openActionCount === 0 ? <>Create an action <Icon name="plus" /></> : <>View all actions <Icon name="arrowRight" /></>}
          </Link>
        </div>
        {urgent.length > 0 && (
          <ul className="mt-4 divide-y divide-line/70 border-t border-line/70">
            {urgent.map((a) => (
              <li key={a.id}>
                <Link href={`/actions?highlight=${a.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-brand-400">
                  <span className="min-w-0 truncate text-ink">{a.title}</span>
                  {a.dueText && (
                    <span className={`badge shrink-0 ${a.dueState === "overdue" ? "bg-red-50 text-red-700" : a.dueState === "soon" ? "bg-amber-50 text-amber-800" : "bg-surface-3 text-muted"}`}>{a.dueText}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {cards.length === 0 ? (
        <EmptyState icon="cap" title="No courses for your level yet">New courses for your track will show up here as soon as they&apos;re published.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:gap-5 xl:grid-cols-3">
          {cards.map((c) => {
            const cert = certByCourse.get(c.id);
            const cs = stats.perCourse.get(c.id);
            return (
              <article key={c.id} className="card card-glow card-hover relative flex flex-col overflow-hidden p-5">
                <CourseArt id={c.id} title={c.title} />
                <div className="relative flex flex-1 flex-col">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <LevelBadge level={c.proficiencyLevel} />
                    {isAdmin && !c.published && <DraftBadge />}
                    {cert && <span className="badge-pill border-emerald-300 bg-emerald-50 text-emerald-700">Completed</span>}
                  </div>
                  <h2 className="pr-10 text-lg leading-snug font-bold">{c.title}</h2>
                  <p className="mt-1 line-clamp-3 flex-1 text-sm text-muted">{c.description}</p>
                  <div className="mt-5">
                    <div className="mb-2 flex justify-between text-sm text-ink-2">
                      <span>{c.completed} of {c.total} lesson{c.total === 1 ? "" : "s"}</span>
                      <span className="font-semibold text-ink">{c.percent}%</span>
                    </div>
                    <ProgressBar percent={c.percent} />
                    {cs && (cs.videosTotal > 0 || cs.avgQuiz !== null) && (
                      <p className="mt-2 text-xs text-muted">
                        {cs.videosTotal > 0 && <>{cs.videosWatched}/{cs.videosTotal} videos watched</>}
                        {cs.videosTotal > 0 && cs.avgQuiz !== null && " · "}
                        {cs.avgQuiz !== null && <>Quiz avg {cs.avgQuiz}%</>}
                      </p>
                    )}
                  </div>
                  <div className="mt-5 flex gap-2">
                    <Link href={`/courses/${c.id}`} className="btn btn-primary flex-1 py-2.5">
                      <Icon name="play" />
                      {c.percent === 100 ? "Review course" : c.completed > 0 ? "Continue" : "Start course"}
                    </Link>
                    {cert && <a href={`/certificates/${cert.id}`} className="btn btn-secondary">Certificate</a>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {certs.length > 0 && (
        <section className="mt-12" aria-labelledby="certs-heading">
          <SectionTitle><span id="certs-heading">My certificates</span></SectionTitle>
          <div className="card divide-y divide-line/70">
            {certs.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <IconTile name="award" size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{c.course.title}</p>
                    <p className="text-xs text-muted">
                      {c.certificateNumber} · Issued {c.issuedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
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

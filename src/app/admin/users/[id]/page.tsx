import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { END_REASON_LABEL, formatDate, formatDateTime, formatDuration, isActiveNow, sessionDurationMs } from "@/lib/activity";
import { issueCertificate, revokeCertificate } from "@/app/actions/admin-users";
import { EmptyState, LevelBadge, PageHeader, ProgressBar, StatusBadge } from "@/components/ui";
import { ConfirmButton, SubmitButton } from "@/components/SubmitButton";
import { getStudentStats, statCards } from "@/lib/student-stats";

export const metadata = { title: "Student details" };

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await db.user.findUnique({ where: { id } });
  if (!user) notFound();

  const [sessions, progress, certs, allCourses, learning] = await Promise.all([
    db.loginSession.findMany({ where: { userId: id }, orderBy: { startedAt: "desc" } }),
    db.progress.findMany({
      where: { userId: id },
      select: { lessonId: true, completed: true, updatedAt: true, lesson: { select: { module: { select: { courseId: true } } } } },
    }),
    db.certificate.findMany({ where: { userId: id } }),
    db.course.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, title: true, published: true } }),
    getStudentStats(user),
  ]);

  // Courses to show: published ones on the user's track, plus anything they've touched or been certified for.
  const touchedIds = [...new Set([...progress.map((p) => p.lesson.module.courseId), ...certs.map((c) => c.courseId)])];
  const courses = await db.course.findMany({
    where: {
      OR: [
        ...(user.proficiencyLevel ? [{ published: true, proficiencyLevel: user.proficiencyLevel }] : []),
        { id: { in: touchedIds } },
      ],
    },
    orderBy: { createdAt: "asc" },
    include: { modules: { select: { lessons: { select: { id: true } } } } },
  });

  const certByCourse = new Map(certs.map((c) => [c.courseId, c]));
  const rows = courses.map((c) => {
    const lessonIds = new Set(c.modules.flatMap((m) => m.lessons.map((l) => l.id)));
    const mine = progress.filter((p) => lessonIds.has(p.lessonId));
    const completed = mine.filter((p) => p.completed).length;
    const lastActivity = mine.reduce<Date | null>((max, p) => (!max || p.updatedAt > max ? p.updatedAt : max), null);
    const total = lessonIds.size;
    return { ...c, total, completed, percent: total ? Math.round((completed / total) * 100) : 0, lastActivity, cert: certByCourse.get(c.id) };
  });

  const totalMs = sessions.reduce((sum, s) => sum + sessionDurationMs(s), 0);
  const lastLogin = sessions[0]?.startedAt;
  const online = sessions.some(isActiveNow);
  const uncertified = allCourses.filter((c) => !certByCourse.has(c.id));

  return (
    <>
      <Link href="/admin/users" className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-700">← All users</Link>
      <PageHeader title={user.name} subtitle={user.email}>
        {online && (
          <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
            <span className="mr-1.5 h-2 w-2 rounded-full bg-emerald-500" />Online
          </span>
        )}
      </PageHeader>

      <div className="card mb-6 flex flex-wrap gap-x-10 gap-y-4 p-5 text-sm">
        <div><p className="text-xs text-slate-500">Status</p><div className="mt-1"><StatusBadge status={user.status} /></div></div>
        <div><p className="text-xs text-slate-500">Level</p><div className="mt-1"><LevelBadge level={user.proficiencyLevel} /></div></div>
        <div><p className="text-xs text-slate-500">Joined</p><p className="mt-1 text-slate-700">{formatDate(user.createdAt)}</p></div>
        {user.telegramId && <div><p className="text-xs text-slate-500">Telegram ID</p><p className="mt-1 text-slate-700">{user.telegramId}</p></div>}
        {user.uid && <div><p className="text-xs text-slate-500">UID</p><p className="mt-1 text-slate-700">{user.uid}</p></div>}
      </div>

      <div className="mb-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[
          ["Total logged time", formatDuration(totalMs)],
          ["Sessions", sessions.length],
          ["Last login", lastLogin ? formatDateTime(lastLogin) : "Never"],
          ["Certificates earned", certs.length],
        ].map(([label, value]) => (
          <div key={label} className="card p-4 sm:p-5">
            <p className="text-lg font-semibold text-slate-900 sm:text-2xl">{value}</p>
            <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{label}</p>
          </div>
        ))}
      </div>

      <section className="mb-10" aria-label="Learning progress">
        <h2 className="mb-1 font-semibold">Learning progress</h2>
        <p className="mb-4 text-sm text-slate-500">Counts only — the content of the student&apos;s notes and answers stays private.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {statCards(learning).map(([label, value]) => (
            <div key={label} className="card p-4">
              <p className="text-xl font-semibold text-slate-900">{value}</p>
              <p className="mt-0.5 text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 font-semibold">Course progress</h2>
        {rows.length === 0 ? (
          <EmptyState title="No courses yet">There are no published courses for this user's level and they haven't started any course.</EmptyState>
        ) : (
          <div className="card divide-y divide-slate-100">
            {rows.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
                <div className="min-w-[220px] flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">{c.title}</p>
                    <LevelBadge level={c.proficiencyLevel} />
                    {!c.published && <span className="badge bg-slate-100 text-slate-600">Draft</span>}
                  </div>
                  <div className="mb-1.5 flex justify-between text-xs text-slate-500">
                    <span>{c.completed} of {c.total} lessons</span>
                    <span className="font-medium text-slate-700">{c.percent}%</span>
                  </div>
                  <ProgressBar percent={c.percent} />
                  <p className="mt-1.5 text-xs text-slate-500">
                    {c.lastActivity ? `Last activity ${formatDateTime(c.lastActivity)}` : "Not started"}
                    {(() => {
                      const cs = learning.perCourse.get(c.id);
                      if (!cs) return null;
                      return <>{cs.videosTotal > 0 && ` · ${cs.videosWatched}/${cs.videosTotal} videos watched`}{cs.avgQuiz !== null && ` · Quiz avg ${cs.avgQuiz}%`}</>;
                    })()}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  {c.cert ? (
                    <>
                      <span className={`badge ${c.cert.manual ? "bg-violet-50 text-violet-700" : "bg-emerald-50 text-emerald-700"}`}>
                        {c.cert.manual ? "Issued by admin" : "Auto"} · {formatDate(c.cert.issuedAt)}
                      </span>
                      <a href={`/certificates/${c.cert.id}`} className="btn btn-secondary btn-sm">Download PDF</a>
                      <form action={revokeCertificate}>
                        <input type="hidden" name="certificateId" value={c.cert.id} />
                        <ConfirmButton message={`Revoke ${user.name}'s certificate for "${c.title}"?`}>Revoke</ConfirmButton>
                      </form>
                    </>
                  ) : (
                    <form action={issueCertificate} className="flex items-center gap-3">
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="courseId" value={c.id} />
                      <label className="flex items-center gap-1.5 text-xs text-slate-600">
                        <input type="checkbox" name="sendEmail" defaultChecked className="rounded border-slate-300" />
                        Email the student
                      </label>
                      {c.total > 0 && c.completed >= c.total ? (
                        <SubmitButton className="btn btn-primary btn-sm" pendingText="Issuing…">Issue certificate</SubmitButton>
                      ) : (
                        <ConfirmButton className="btn btn-primary btn-sm"
                          message={`${user.name} has completed ${c.completed} of ${c.total} lessons in "${c.title}". Issue a certificate anyway?`}>
                          Issue certificate
                        </ConfirmButton>
                      )}
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {uncertified.length > 0 && (
          <form action={issueCertificate} className="card mt-4 flex flex-wrap items-end gap-3 p-5">
            <input type="hidden" name="userId" value={user.id} />
            <div className="min-w-[220px] flex-1">
              <label className="label" htmlFor="courseId">Issue certificate for another course</label>
              <select id="courseId" name="courseId" className="input" required>
                {uncertified.map((c) => <option key={c.id} value={c.id}>{c.title}{c.published ? "" : " (draft)"}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-1.5 pb-2.5 text-xs text-slate-600">
              <input type="checkbox" name="sendEmail" defaultChecked className="rounded border-slate-300" />
              Email the student
            </label>
            <ConfirmButton className="btn btn-primary" message={`Issue a certificate to ${user.name} for the selected course?`}>Issue certificate</ConfirmButton>
          </form>
        )}
      </section>

      <section>
        <h2 className="mb-4 font-semibold">Login history <span className="text-sm font-normal text-slate-500">(last 50)</span></h2>
        {sessions.length === 0 ? (
          <EmptyState title="No logins recorded">Sessions are recorded from the next time this user logs in.</EmptyState>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-5 py-3">Start</th>
                  <th className="px-5 py-3">End</th>
                  <th className="px-5 py-3">Duration</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.slice(0, 50).map((s) => {
                  const active = isActiveNow(s);
                  return (
                    <tr key={s.id}>
                      <td className="px-5 py-3 whitespace-nowrap text-slate-700">{formatDateTime(s.startedAt)}</td>
                      <td className="px-5 py-3 whitespace-nowrap text-slate-500">{s.endedAt ? formatDateTime(s.endedAt) : "—"}</td>
                      <td className="px-5 py-3 whitespace-nowrap text-slate-700">{formatDuration(sessionDurationMs(s))}</td>
                      <td className="px-5 py-3">
                        {active ? (
                          <span className="badge bg-emerald-50 text-emerald-700">Active now</span>
                        ) : (
                          <span className="badge bg-slate-100 text-slate-600">{END_REASON_LABEL[s.endReason ?? ""] ?? "Timed out"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

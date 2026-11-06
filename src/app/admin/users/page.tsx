import Link from "next/link";
import { db } from "@/lib/db";
import { LEVELS, LEVEL_LABEL, STATUSES } from "@/lib/constants";
import { approveUser, deleteUser, rejectUser } from "@/app/actions/admin-users";
import { EmptyState, LevelBadge, PageHeader, ProgressBar, StatusBadge } from "@/components/ui";
import { ConfirmButton, SubmitButton } from "@/components/SubmitButton";
import { RemindButton } from "@/components/ReminderForms";
import { formatDate, formatDateTime, formatDuration, isActiveNow, sessionDurationMs } from "@/lib/activity";
import { getCourseCoverage, unfinishedCourses } from "@/lib/course-coverage";
import { emailConfigured } from "@/lib/email";

export const metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter = (STATUSES as readonly string[]).includes(status ?? "") ? status : undefined;

  const [users, counts] = await Promise.all([
    db.user.findMany({
      where: { role: "STUDENT", ...(filter ? { status: filter } : {}) },
      orderBy: [{ createdAt: "desc" }],
      include: { _count: { select: { certificates: true } } },
    }),
    db.user.groupBy({ by: ["status"], where: { role: "STUDENT" }, _count: true }),
  ]);
  const userIds = users.map((u) => u.id);
  const [sessions, coverage, reminders] = await Promise.all([
    db.loginSession.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, startedAt: true, lastSeenAt: true, endedAt: true },
    }),
    getCourseCoverage(users),
    db.notification.groupBy({ by: ["userId"], where: { userId: { in: userIds } }, _max: { createdAt: true } }),
  ]);
  const lastReminder = new Map(reminders.map((r) => [r.userId, r._max.createdAt]));
  const activity = new Map<string, { lastLogin: Date | null; totalMs: number; online: boolean }>();
  for (const s of sessions) {
    const a = activity.get(s.userId) ?? { lastLogin: null, totalMs: 0, online: false };
    if (!a.lastLogin || s.startedAt > a.lastLogin) a.lastLogin = s.startedAt;
    a.totalMs += sessionDurationMs(s);
    a.online ||= isActiveNow(s);
    activity.set(s.userId, a);
  }
  const countOf =(s?: string) => (s ? counts.find((c) => c.status === s)?._count ?? 0 : counts.reduce((a, c) => a + c._count, 0));

  const tabs = [{ key: undefined, label: "All" }, ...STATUSES.map((s) => ({ key: s, label: s.charAt(0) + s.slice(1).toLowerCase() }))];

  return (
    <>
      <PageHeader title="Users" subtitle="Approve new registrations, assign a proficiency track, and see how much of their courses each student has covered." />

      <div className="mb-5 flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <Link key={t.label} href={t.key ? `/admin/users?status=${t.key}` : "/admin/users"}
            className={`btn btn-sm ${filter === t.key ? "bg-slate-900 text-white" : "btn-secondary"}`}>
            {t.label}
            <span className={`rounded-full px-1.5 text-[11px] ${filter === t.key ? "bg-white/20" : t.key === "PENDING" && countOf(t.key) > 0 ? "bg-amber-100 text-amber-800" : "bg-slate-100"}`}>{countOf(t.key)}</span>
          </Link>
        ))}
      </div>

      {users.length === 0 ? (
        <EmptyState title={filter ? `No ${filter.toLowerCase()} users` : "No students yet"}>New registrations will appear here.</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-5 py-3">Student</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Level</th>
                <th className="min-w-64 px-5 py-3">Course progress</th>
                <th className="px-5 py-3">Joined</th>
                <th className="px-5 py-3">Activity</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const act = activity.get(u.id);
                const cov = coverage.get(u.id);
                const nextCourse = unfinishedCourses(cov)[0];
                const reminded = lastReminder.get(u.id);
                return (
                <tr key={u.id} className={u.status === "PENDING" ? "bg-amber-50/30" : ""}>
                  <td className="px-5 py-3.5">
                    <Link href={`/admin/users/${u.id}`} className="font-medium text-slate-900 hover:text-brand-600 hover:underline">{u.name}</Link>
                    <p className="text-xs text-slate-500">{u.email}{u._count.certificates > 0 && ` · ${u._count.certificates} certificate${u._count.certificates > 1 ? "s" : ""}`}</p>
                  </td>
                  <td className="px-5 py-3.5"><StatusBadge status={u.status} /></td>
                  <td className="px-5 py-3.5"><LevelBadge level={u.proficiencyLevel} /></td>
                  <td className="px-5 py-3.5">
                    {!cov ? (
                      <span className="text-xs text-slate-400">—</span>
                    ) : cov.total === 0 ? (
                      <span className="text-xs text-slate-500">No courses on this track</span>
                    ) : (
                      <>
                        <div className="mb-1 flex justify-between gap-3 text-xs text-slate-500">
                          <span className="whitespace-nowrap">{cov.done} of {cov.total} lessons</span>
                          <span className="font-medium text-slate-700">{cov.percent}%</span>
                        </div>
                        <ProgressBar percent={cov.percent} />
                        {nextCourse ? (
                          <div className="mt-2 space-y-1">
                            <RemindButton userId={u.id} studentName={u.name} course={{ id: nextCourse.id, title: nextCourse.title }} emailReady={emailConfigured()} />
                            {reminded && <p className="text-xs text-slate-500">Last reminded {formatDate(reminded)}</p>}
                          </div>
                        ) : (
                          <p className="mt-1.5 text-xs text-emerald-700">All courses finished</p>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap text-slate-500">{u.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    {act?.lastLogin ? (
                      <>
                        <p className="flex items-center gap-1.5 text-slate-700">
                          {act.online && <span className="h-2 w-2 rounded-full bg-emerald-500" title="Online" aria-label="Online" />}
                          {formatDateTime(act.lastLogin)}
                        </p>
                        <p className="text-xs text-slate-500">{formatDuration(act.totalMs)} total{act.online && " · Online"}</p>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">Never</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <form action={approveUser} className="flex items-center gap-1.5">
                        <input type="hidden" name="id" value={u.id} />
                        <select name="level" defaultValue={u.proficiencyLevel ?? "BEGINNER"} className="input w-auto py-1.5 text-xs" aria-label={`Level for ${u.name}`}>
                          {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
                        </select>
                        <SubmitButton className="btn btn-primary btn-sm">{u.status === "APPROVED" ? "Update" : "Approve"}</SubmitButton>
                      </form>
                      {u.status !== "REJECTED" && (
                        <form action={rejectUser}>
                          <input type="hidden" name="id" value={u.id} />
                          <SubmitButton className="btn btn-secondary btn-sm">Reject</SubmitButton>
                        </form>
                      )}
                      <form action={deleteUser}>
                        <input type="hidden" name="id" value={u.id} />
                        <ConfirmButton message={`Permanently delete ${u.name}? Their progress and certificates will be removed.`}>Delete</ConfirmButton>
                      </form>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

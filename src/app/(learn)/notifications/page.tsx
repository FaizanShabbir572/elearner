import { requireApproved } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/activity";
import { markAllNotificationsRead, markNotificationRead, openNotification } from "@/app/actions/notifications";
import { EmptyState, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireApproved();
  const notifications = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const hasUnread = notifications.some((n) => !n.readAt);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 md:px-10 md:py-10">
      <PageHeader title="Notifications" subtitle="Messages and reminders from your instructor.">
        {hasUnread && (
          <form action={markAllNotificationsRead}>
            <SubmitButton className="btn btn-secondary btn-sm">Mark all as read</SubmitButton>
          </form>
        )}
      </PageHeader>

      {notifications.length === 0 ? (
        <EmptyState title="No notifications yet">Reminders from your instructor will appear here.</EmptyState>
      ) : (
        <ul className="card divide-y divide-slate-100">
          {notifications.map((n) => (
            <li key={n.id} className={`px-5 py-4 ${n.readAt ? "" : "bg-brand-50/50"}`}>
              <div className="flex items-start gap-2.5">
                {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" title="Unread" aria-label="Unread" />}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{n.title}</p>
                  <p className="mt-1 text-sm whitespace-pre-wrap text-slate-600">{n.message}</p>
                  <p className="mt-1.5 text-xs text-slate-500">{formatDateTime(n.createdAt)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {n.courseId && (
                      <form action={openNotification}>
                        <input type="hidden" name="id" value={n.id} />
                        <SubmitButton className="btn btn-primary btn-sm">Continue course</SubmitButton>
                      </form>
                    )}
                    {!n.readAt && (
                      <form action={markNotificationRead}>
                        <input type="hidden" name="id" value={n.id} />
                        <SubmitButton className="btn btn-ghost btn-sm">Mark as read</SubmitButton>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

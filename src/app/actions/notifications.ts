"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireApproved } from "@/lib/auth";

// The unread count sits in the shared app shell, so refresh the whole layout.
const refreshShell = () => revalidatePath("/", "layout");

export async function markNotificationRead(form: FormData) {
  const user = await requireApproved();
  const id = String(form.get("id"));
  await db.notification.updateMany({ where: { id, userId: user.id, readAt: null }, data: { readAt: new Date() } });
  refreshShell();
}

export async function markAllNotificationsRead() {
  const user = await requireApproved();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  refreshShell();
}

/** "Continue course": mark the notification read, then go to its course. */
export async function openNotification(form: FormData) {
  const user = await requireApproved();
  const id = String(form.get("id"));
  const notification = await db.notification.findFirst({ where: { id, userId: user.id }, select: { courseId: true } });
  if (!notification) return;
  await db.notification.updateMany({ where: { id, userId: user.id, readAt: null }, data: { readAt: new Date() } });
  refreshShell();
  redirect(notification.courseId ? `/courses/${notification.courseId}` : "/notifications");
}

"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getCourseCoverage } from "@/lib/course-coverage";
import { reminderEmail } from "@/lib/email";

export type ReminderResult = { tone: "success" | "warning" | "error"; message: string };

const MAX_MESSAGE = 1000;

/**
 * Reminds a student to finish a course: always in the app, and by email if asked. The in-app
 * notification is saved first, so a failed email can't lose it, and the admin is told what happened.
 */
export async function sendReminder(_prev: ReminderResult | null, form: FormData): Promise<ReminderResult> {
  await requireAdmin();
  const userId = String(form.get("userId"));
  const courseId = String(form.get("courseId"));
  const customMessage = String(form.get("message") ?? "").trim();
  const withEmail = form.get("email") === "on";

  if (customMessage.length > MAX_MESSAGE) return { tone: "error", message: `Keep the message under ${MAX_MESSAGE} characters.` };

  const student = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, status: true, proficiencyLevel: true },
  });
  if (!student || student.role !== "STUDENT" || student.status !== "APPROVED") {
    return { tone: "error", message: "Only approved students can be sent reminders." };
  }
  const coverage = await getCourseCoverage([student]);
  const course = coverage.get(student.id)?.courses.find((c) => c.id === courseId);
  if (!course) return { tone: "error", message: "This student can't open that course." };
  if (course.finished) return { tone: "error", message: `${student.name} has already finished ${course.title}.` };

  const title = `Reminder: finish ${course.title}`;
  const message =
    customMessage ||
    `You've completed ${course.done} of ${course.total} lessons (${course.percent}%) in ${course.title}. Please try to finish the course as soon as you can.`;

  const notification = await db.notification.create({ data: { userId, courseId, title, message } });

  let result: ReminderResult = { tone: "success", message: "Sent in the app." };
  if (withEmail) {
    const emailStatus = await reminderEmail(student, { title, message, courseId });
    await db.notification.update({ where: { id: notification.id }, data: { emailStatus } });
    result =
      emailStatus === "SENT"
        ? { tone: "success", message: "Sent in the app and by email." }
        : emailStatus === "FAILED"
          ? { tone: "warning", message: "Sent in the app, but the email failed. Check the server log." }
          : { tone: "warning", message: "Sent in the app. Email was not sent: no email provider is set up." };
  }

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return result;
}

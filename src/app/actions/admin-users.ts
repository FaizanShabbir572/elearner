"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { approvalEmail } from "@/lib/email";
import { LEVEL_LABEL, isLevel } from "@/lib/constants";
import { createCertificate } from "@/lib/progress";

export async function approveUser(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id"));
  const level = form.get("level");
  if (!isLevel(level)) throw new Error("Choose a proficiency level");

  const before = await db.user.findUnique({ where: { id } });
  if (!before || before.role === "ADMIN") return;

  const user = await db.user.update({ where: { id }, data: { status: "APPROVED", proficiencyLevel: level } });
  // Only email on the transition into APPROVED, not when just changing the level.
  if (before.status !== "APPROVED") await approvalEmail(user, LEVEL_LABEL[level]);
  revalidatePath("/admin/users");
}

export async function rejectUser(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id"));
  await db.user.updateMany({ where: { id, role: { not: "ADMIN" } }, data: { status: "REJECTED" } });
  revalidatePath("/admin/users");
}

export async function deleteUser(form: FormData) {
  const admin = await requireAdmin();
  const id = String(form.get("id"));
  if (id === admin.id) return; // never delete yourself
  await db.user.deleteMany({ where: { id, role: { not: "ADMIN" } } });
  revalidatePath("/admin/users");
}

export async function issueCertificate(form: FormData) {
  await requireAdmin();
  const userId = String(form.get("userId"));
  const courseId = String(form.get("courseId"));
  const sendEmail = form.get("sendEmail") === "on";

  const [user, course] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.course.findUnique({ where: { id: courseId } }),
  ]);
  if (!user || !course) throw new Error("User or course not found");

  await createCertificate(userId, courseId, { manual: true, sendEmail });
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
}

export async function revokeCertificate(form: FormData) {
  await requireAdmin();
  const id = String(form.get("certificateId"));
  const cert = await db.certificate.findUnique({ where: { id } });
  if (!cert) return;
  await db.certificate.delete({ where: { id } });
  revalidatePath(`/admin/users/${cert.userId}`);
  revalidatePath("/admin/users");
}

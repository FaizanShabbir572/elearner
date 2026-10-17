import "server-only";
import { randomBytes } from "crypto";
import { db } from "./db";
import { completionEmail } from "./email";

/** Completed / total lesson counts for one user across one course. */
export async function getCourseProgress(userId: string, courseId: string) {
  const [total, done] = await Promise.all([
    db.lesson.count({ where: { module: { courseId } } }),
    db.progress.count({ where: { userId, completed: true, lesson: { module: { courseId } } } }),
  ]);
  return { total, done, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

function newCertificateNumber() {
  const year = new Date().getFullYear();
  return `CERT-${year}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/**
 * If the user has finished every lesson in the course and has no certificate yet,
 * issue one and send the completion email. Returns the certificate if one exists.
 */
export async function issueCertificateIfComplete(userId: string, courseId: string) {
  const existing = await db.certificate.findUnique({ where: { userId_courseId: { userId, courseId } } });
  if (existing) return existing;

  const { total, done } = await getCourseProgress(userId, courseId);
  if (total === 0 || done < total) return null;

  return createCertificate(userId, courseId, { manual: false, sendEmail: true });
}

/**
 * Issue a certificate regardless of progress. Returns the existing one if the
 * user already has a certificate for this course (no email in that case).
 */
export async function createCertificate(userId: string, courseId: string, { manual, sendEmail }: { manual: boolean; sendEmail: boolean }) {
  let cert;
  try {
    cert = await db.certificate.create({
      data: { userId, courseId, manual, certificateNumber: newCertificateNumber() },
      include: { user: true, course: true },
    });
  } catch {
    // Unique constraint race (double click) — the other request issued it.
    return db.certificate.findUnique({ where: { userId_courseId: { userId, courseId } } });
  }
  if (sendEmail) await completionEmail(cert.user, cert.course.title, cert.id);
  return cert;
}

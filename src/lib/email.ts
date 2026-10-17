import "server-only";
import nodemailer from "nodemailer";

type Mail = { to: string; subject: string; html: string };

const from = () => process.env.EMAIL_FROM || "E-Learning <no-reply@example.com>";
export const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

/**
 * Sends an email via Resend (if RESEND_API_KEY is set), otherwise SMTP (if SMTP_HOST is set),
 * otherwise logs it to the console. Never throws — a failed email must not break the user's action.
 */
export async function sendEmail(mail: Mail): Promise<void> {
  try {
    if (process.env.RESEND_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: from(), to: [mail.to], subject: mail.subject, html: mail.html }),
      });
      if (!res.ok) console.error("[email] Resend error", res.status, await res.text());
      return;
    }
    if (process.env.SMTP_HOST) {
      const port = Number(process.env.SMTP_PORT || 587);
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      });
      await transport.sendMail({ from: from(), ...mail });
      return;
    }
    console.log(`\n[email:console] To: ${mail.to}\nSubject: ${mail.subject}\n${mail.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}\n`);
  } catch (err) {
    console.error("[email] failed to send", err);
  }
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, body: string, cta?: { href: string; label: string }) {
  const button = cta
    ? `<p style="margin:28px 0"><a href="${cta.href}" style="background:#4338ca;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${esc(cta.label)}</a></p>`
    : "";
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
<h2 style="color:#111827;margin:0 0 16px">${esc(title)}</h2>${body}${button}
<p style="color:#9ca3af;font-size:12px;margin-top:32px">Sent by ${esc(appUrl())}</p></div>`;
}

export function newRegistrationEmail(user: { name: string; email: string }) {
  return sendEmail({
    to: process.env.ADMIN_EMAIL || "admin@example.com",
    subject: `New registration awaiting approval: ${user.name}`,
    html: layout(
      "New user registered",
      `<p><strong>${esc(user.name)}</strong> (${esc(user.email)}) just signed up and is waiting for approval.</p>`,
      { href: `${appUrl()}/admin/users`, label: "Review pending users" }
    ),
  });
}

export function approvalEmail(user: { name: string; email: string }, levelLabel: string) {
  return sendEmail({
    to: user.email,
    subject: "Your account has been approved",
    html: layout(
      `Welcome aboard, ${user.name}!`,
      `<p>Your account has been approved and assigned to the <strong>${esc(levelLabel)}</strong> track. Your courses are ready.</p>`,
      { href: `${appUrl()}/dashboard`, label: "Start learning" }
    ),
  });
}

export function completionEmail(
  user: { name: string; email: string },
  courseTitle: string,
  certificateId: string
) {
  return sendEmail({
    to: user.email,
    subject: `Congratulations — you completed ${courseTitle}`,
    html: layout(
      "Course completed 🎉",
      `<p>Well done, ${esc(user.name)}! You've completed every lesson in <strong>${esc(courseTitle)}</strong>.</p><p>Your certificate is ready to download.</p>`,
      { href: `${appUrl()}/certificates/${certificateId}`, label: "Download certificate (PDF)" }
    ),
  });
}

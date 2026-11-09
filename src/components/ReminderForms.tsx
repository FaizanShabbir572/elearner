"use client";
import { useActionState } from "react";
import { sendReminder, type ReminderResult } from "@/app/actions/admin-notifications";
import { ConfirmButton, SubmitButton } from "./SubmitButton";

const TONE: Record<ReminderResult["tone"], string> = {
  success: "text-emerald-700",
  warning: "text-amber-700",
  error: "text-red-700",
};

function Result({ result }: { result: ReminderResult | null }) {
  if (!result) return null;
  return <p role="status" className={`text-xs whitespace-normal ${TONE[result.tone]}`}>{result.message}</p>;
}

/** One-click reminder for the users table, about the course closest to completion. Also emails once email is set up. */
export function RemindButton({ userId, studentName, course, emailReady }: { userId: string; studentName: string; course: { id: string; title: string }; emailReady: boolean }) {
  const [result, action] = useActionState(sendReminder, null);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="courseId" value={course.id} />
      {emailReady && <input type="hidden" name="email" value="on" />}
      <ConfirmButton className="btn btn-secondary btn-sm whitespace-nowrap" message={`Send ${studentName} a reminder to finish "${course.title}"${emailReady ? ", in the app and by email" : ""}?`}>
        Send reminder
      </ConfirmButton>
      <Result result={result} />
    </form>
  );
}

/** Full reminder form for the student page: choose the course and write a message. Offers email once it is set up. */
export function ReminderComposer({ userId, courses, emailReady }: { userId: string; courses: { id: string; title: string; percent: number }[]; emailReady: boolean }) {
  const [result, action] = useActionState(sendReminder, null);
  return (
    <form action={action} className="card space-y-4 p-5">
      <input type="hidden" name="userId" value={userId} />
      <div>
        <label className="label" htmlFor="reminder-course">Course</label>
        <select id="reminder-course" name="courseId" className="input">
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.percent}% complete)</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="reminder-message">Message <span className="font-normal text-muted">(optional)</span></label>
        <textarea id="reminder-message" name="message" rows={3} maxLength={1000} className="input"
          placeholder="Leave blank to send the standard reminder with their current progress." />
      </div>
      {emailReady && (
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" name="email" defaultChecked className="rounded border-line-strong" />
          Also send by email
        </label>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Sending…">Send reminder</SubmitButton>
        <Result result={result} />
      </div>
    </form>
  );
}

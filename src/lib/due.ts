import "server-only";
import { appTimeZone } from "./activity";

// Target dates are calendar days. They're stored as UTC midnight of that day and compared
// against "today" in APP_TIMEZONE, so a date never shifts by one depending on the server.

const DAY_MS = 24 * 60 * 60 * 1000;
export const DUE_SOON_DAYS = 3;

/** "2026-10-20" → Date at UTC midnight, or null for empty/invalid input. */
export function parseDueDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date → "2026-10-20" (for <input type="date">). */
export function dueInputValue(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "";
}

/** Today's calendar day in APP_TIMEZONE, as UTC midnight. */
export function startOfToday() {
  const key = new Intl.DateTimeFormat("en-CA", { timeZone: appTimeZone(), year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return new Date(`${key}T00:00:00Z`);
}

export type DueState = "overdue" | "soon" | "later";

export function dueState(due: Date | null, today = startOfToday()): DueState | null {
  if (!due) return null;
  const days = Math.round((due.getTime() - today.getTime()) / DAY_MS);
  if (days < 0) return "overdue";
  if (days <= DUE_SOON_DAYS) return "soon";
  return "later";
}

/** "Oct 20, 2026" (the stored calendar day, no timezone shift). */
export function formatDue(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** "Overdue by 2 days" / "Due today" / "Due tomorrow" / "Due Oct 20, 2026" */
export function dueLabel(due: Date, today = startOfToday()) {
  const days = Math.round((due.getTime() - today.getTime()) / DAY_MS);
  if (days < 0) return `Overdue by ${-days} day${days === -1 ? "" : "s"}`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due ${formatDue(due)}`;
}

import "server-only";
import { db } from "./db";

/** A session with no activity for this long is considered over. */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
/** Don't write lastSeenAt more often than this. */
const TOUCH_INTERVAL_MS = 60 * 1000;

export const END_REASON_LABEL: Record<string, string> = {
  LOGOUT: "Logged out",
  TIMEOUT: "Timed out",
  NEW_LOGIN: "New login elsewhere",
};

/** Close every open session for the user, ending each at the moment it was last seen. */
async function closeOpenSessions(userId: string, endReason: string) {
  const open = await db.loginSession.findMany({ where: { userId, endedAt: null }, select: { id: true, lastSeenAt: true } });
  await Promise.all(
    open.map((s) => db.loginSession.update({ where: { id: s.id }, data: { endedAt: s.lastSeenAt, endReason } }))
  );
}

export async function startLoginSession(userId: string) {
  await closeOpenSessions(userId, "NEW_LOGIN");
  return db.loginSession.create({ data: { userId } });
}

export async function endLoginSession(userId: string) {
  await db.loginSession.updateMany({ where: { userId, endedAt: null }, data: { endedAt: new Date(), endReason: "LOGOUT" } });
}

/** Record activity for a logged-in user; rolls over to a new session after a long idle gap. */
export async function touchSession(userId: string) {
  const now = Date.now();
  const latest = await db.loginSession.findFirst({ where: { userId, endedAt: null }, orderBy: { startedAt: "desc" } });
  // No open session: the user was logged in before tracking existed, or their session was closed elsewhere.
  if (!latest) return startLoginSession(userId);

  const idle = now - latest.lastSeenAt.getTime();
  if (idle > IDLE_TIMEOUT_MS) {
    await db.loginSession.update({ where: { id: latest.id }, data: { endedAt: latest.lastSeenAt, endReason: "TIMEOUT" } });
    return startLoginSession(userId);
  }
  if (idle > TOUCH_INTERVAL_MS) {
    await db.loginSession.update({ where: { id: latest.id }, data: { lastSeenAt: new Date(now) } });
  }
}

type SessionTimes = { startedAt: Date; lastSeenAt: Date; endedAt: Date | null };

export function sessionDurationMs(s: SessionTimes) {
  return Math.max(0, (s.endedAt ?? s.lastSeenAt).getTime() - s.startedAt.getTime());
}

export function isActiveNow(s: SessionTimes) {
  return s.endedAt === null && Date.now() - s.lastSeenAt.getTime() <= IDLE_TIMEOUT_MS;
}

/** "1h 23m" / "45m" */
export function formatDuration(ms: number) {
  const totalMinutes = Math.floor(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function appTimeZone() {
  const tz = process.env.APP_TIMEZONE;
  if (!tz) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return undefined; // invalid zone name: fall back to the server's zone
  }
}

/** "Oct 14, 2026, 3:05 PM" in APP_TIMEZONE. */
export function formatDateTime(d: Date) {
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: appTimeZone(),
  });
}

export function formatDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: appTimeZone() });
}

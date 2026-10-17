import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { touchSession } from "./activity";
import { SESSION_COOKIE, sessionCookieOptions, signSession, verifySession } from "./session";

/** The logged-in user, always read fresh from the DB (so approvals take effect immediately). */
export const getCurrentUser = cache(async () => {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true, status: true, proficiencyLevel: true },
  });
  if (user) {
    try {
      await touchSession(user.id);
    } catch (err) {
      // Activity tracking must never break a page.
      console.error("touchSession failed", err);
    }
  }
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function createSession(userId: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession({ userId }), sessionCookieOptions);
}

/** User id from the session cookie, without touching the DB. */
export async function getSessionUserId() {
  const store = await cookies();
  return (await verifySession(store.get(SESSION_COOKIE)?.value))?.userId ?? null;
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Where a user belongs after login, based on role + status. */
export function homeFor(user: { role: string; status: string }) {
  if (user.role === "ADMIN") return "/admin/users";
  if (user.status === "APPROVED") return "/dashboard";
  return "/pending";
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Students must be APPROVED; admins always pass. Everyone else goes to the holding page. */
export async function requireApproved() {
  const user = await requireUser();
  if (user.role !== "ADMIN" && user.status !== "APPROVED") redirect("/pending");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect(homeFor(user));
  return user;
}

"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, destroySession, getSessionUserId, homeFor } from "@/lib/auth";
import { endLoginSession, startLoginSession } from "@/lib/activity";
import { newRegistrationEmail } from "@/lib/email";

export type FormState = { error?: string } | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeNext(next: FormDataEntryValue | null) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : null;
}

export async function register(_: FormState, form: FormData): Promise<FormState> {
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const telegramId = String(form.get("telegramId") ?? "").trim().toLowerCase();
  const uid = String(form.get("uid") ?? "").trim();
  const password = String(form.get("password") ?? "");

  if (name.length < 2) return { error: "Please enter your full name." };
  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address." };
  if (!EMAIL_RE.test(telegramId)) return { error: "Please enter a valid Telegram ID (email format)." };
  if (!uid) return { error: "Please enter your UID." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (await db.user.findUnique({ where: { email } })) {
    return { error: "An account with that email already exists." };
  }

  const user = await db.user.create({
    data: { name, email, telegramId, uid, password: await bcrypt.hash(password, 10), status: "PENDING", role: "STUDENT" },
  });
  await newRegistrationEmail(user);
  await createSession(user.id);
  await startLoginSession(user.id);
  redirect("/pending");
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return { error: "Incorrect email or password." };
  }
  await createSession(user.id);
  await startLoginSession(user.id);
  const next = safeNext(form.get("next"));
  const home = homeFor(user);
  // Only honour ?next= when the user is allowed past the pending gate.
  redirect(next && home !== "/pending" ? next : home);
}

export async function logout() {
  const userId = await getSessionUserId();
  if (userId) await endLoginSession(userId);
  await destroySession();
  redirect("/login");
}

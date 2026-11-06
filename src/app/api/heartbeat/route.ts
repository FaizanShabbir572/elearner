import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

// getCurrentUser() records the activity via touchSession().
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const unread = user.role === "ADMIN" ? 0 : await db.notification.count({ where: { userId: user.id, readAt: null } });
  return NextResponse.json({ ok: true, unread });
}

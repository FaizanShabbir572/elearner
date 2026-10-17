import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

// getCurrentUser() records the activity via touchSession().
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true });
}

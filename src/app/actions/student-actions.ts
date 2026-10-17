"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireApproved, type CurrentUser } from "@/lib/auth";
import { accessibleLesson } from "@/lib/access";
import { parseDueDate } from "@/lib/due";
import { ACTION_DESCRIPTION_MAX, ACTION_TITLE_MAX, isActionStatus } from "@/lib/constants";

export type ActionFields = { title: string; description?: string; dueDate?: string };
export type ActionDTO = { id: string; title: string; status: string; noteId: string | null };
export type ActionResult = { ok: true; action: ActionDTO } | { ok: false; error: string };

const DTO_SELECT = { id: true, title: true, status: true, noteId: true } as const;

function refresh() {
  revalidatePath("/actions");
  revalidatePath("/dashboard");
}

function cleanFields(input: ActionFields): { title: string; description: string; dueDate: Date | null } | { error: string } {
  const title = typeof input?.title === "string" ? input.title.trim() : "";
  const description = typeof input?.description === "string" ? input.description.trim() : "";
  if (!title) return { error: "Please give the action a title." };
  if (title.length > ACTION_TITLE_MAX) return { error: `Title can be at most ${ACTION_TITLE_MAX} characters.` };
  if (description.length > ACTION_DESCRIPTION_MAX) return { error: `Description can be at most ${ACTION_DESCRIPTION_MAX.toLocaleString()} characters.` };
  return { title, description, dueDate: parseDueDate(input.dueDate) };
}

/** Resolve the lesson/note an action links to, ensuring both belong to (or are accessible by) the user. */
async function resolveLinks(user: CurrentUser, lessonId: unknown, noteId: unknown) {
  if (typeof noteId === "string" && noteId) {
    const note = await db.lessonNote.findFirst({ where: { id: noteId, userId: user.id }, select: { id: true, lessonId: true } });
    if (!note || !(await accessibleLesson(user, note.lessonId))) return null;
    return { noteId: note.id, lessonId: note.lessonId };
  }
  if (typeof lessonId === "string" && lessonId) {
    const lesson = await accessibleLesson(user, lessonId);
    return lesson ? { noteId: null, lessonId: lesson.id } : null;
  }
  return { noteId: null, lessonId: null };
}

export async function createAction(input: ActionFields & { lessonId?: string | null; noteId?: string | null }): Promise<ActionResult> {
  const user = await requireApproved();
  const fields = cleanFields(input);
  if ("error" in fields) return { ok: false, error: fields.error };
  const links = await resolveLinks(user, input?.lessonId, input?.noteId);
  if (!links) return { ok: false, error: "That lesson or note isn't available." };

  const action = await db.action.create({ data: { userId: user.id, ...fields, ...links, fromNote: links.noteId !== null }, select: DTO_SELECT });
  refresh();
  return { ok: true, action };
}

export async function updateAction(id: string, input: ActionFields): Promise<ActionResult> {
  const user = await requireApproved();
  const fields = cleanFields(input);
  if ("error" in fields) return { ok: false, error: fields.error };
  if (typeof id !== "string") return { ok: false, error: "Action not found." };

  const { count } = await db.action.updateMany({ where: { id, userId: user.id }, data: fields });
  const action = count > 0 ? await db.action.findUnique({ where: { id }, select: DTO_SELECT }) : null;
  if (!action) return { ok: false, error: "Action not found." };
  refresh();
  return { ok: true, action };
}

export async function setActionStatus(form: FormData) {
  const user = await requireApproved();
  const id = String(form.get("id") ?? "");
  const status = form.get("status");
  if (!isActionStatus(status)) return;
  await db.action.updateMany({
    where: { id, userId: user.id },
    data: { status, completedAt: status === "DONE" ? new Date() : null },
  });
  refresh();
}

export async function deleteAction(form: FormData) {
  const user = await requireApproved();
  await db.action.deleteMany({ where: { id: String(form.get("id") ?? ""), userId: user.id } });
  refresh();
}

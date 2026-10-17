"use server";

import { db } from "@/lib/db";
import { requireApproved, type CurrentUser } from "@/lib/auth";
import { canAccessCourse } from "@/lib/courses";
import { NOTE_MAX_LENGTH } from "@/lib/constants";

export type NoteDTO = { id: string; lessonId: string; timestampSec: number | null; content: string; createdAt: Date; updatedAt: Date };
export type NoteResult = { ok: true; note: NoteDTO } | { ok: false; error: string };

const NOTE_SELECT = { id: true, lessonId: true, timestampSec: true, content: true, createdAt: true, updatedAt: true } as const;

function cleanContent(content: unknown): string | { error: string } {
  if (typeof content !== "string" || !content.trim()) return { error: "Note is empty." };
  if (content.length > NOTE_MAX_LENGTH) return { error: `Notes can be at most ${NOTE_MAX_LENGTH.toLocaleString()} characters.` };
  return content;
}

async function lessonAccessible(user: CurrentUser, lessonId: string) {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { module: { select: { course: { select: { published: true, proficiencyLevel: true } } } } } });
  return !!lesson && canAccessCourse(user, lesson.module.course);
}

/** The current user's note, only if its lesson is still accessible to them. */
async function ownNote(user: CurrentUser, noteId: unknown) {
  if (typeof noteId !== "string") return null;
  const note = await db.lessonNote.findFirst({ where: { id: noteId, userId: user.id }, select: { lessonId: true } });
  return note && (await lessonAccessible(user, note.lessonId)) ? note : null;
}

export async function createNote(lessonId: string, timestampSec: number | null, content: string): Promise<NoteResult> {
  const user = await requireApproved();
  const text = cleanContent(content);
  if (typeof text !== "string") return { ok: false, ...text };
  if (typeof lessonId !== "string" || !(await lessonAccessible(user, lessonId))) return { ok: false, error: "Lesson not available." };
  const ts = typeof timestampSec === "number" && Number.isFinite(timestampSec) && timestampSec >= 0 ? Math.floor(timestampSec) : null;

  const note = await db.lessonNote.create({ data: { userId: user.id, lessonId, timestampSec: ts, content: text }, select: NOTE_SELECT });
  return { ok: true, note };
}

export async function updateNote(noteId: string, content: string): Promise<NoteResult> {
  const user = await requireApproved();
  const text = cleanContent(content);
  if (typeof text !== "string") return { ok: false, ...text };
  if (!(await ownNote(user, noteId))) return { ok: false, error: "Note not found." };

  const { count } = await db.lessonNote.updateMany({ where: { id: noteId, userId: user.id }, data: { content: text } });
  const note = count > 0 ? await db.lessonNote.findUnique({ where: { id: noteId }, select: NOTE_SELECT }) : null;
  return note ? { ok: true, note } : { ok: false, error: "Note not found." };
}

export async function deleteNote(noteId: string): Promise<{ ok: boolean }> {
  const user = await requireApproved();
  if (typeof noteId !== "string") return { ok: false };
  // Students may always delete their own notes, even if the course is no longer available to them.
  const { count } = await db.lessonNote.deleteMany({ where: { id: noteId, userId: user.id } });
  return { ok: count > 0 };
}

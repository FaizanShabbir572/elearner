"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireApproved, type CurrentUser } from "@/lib/auth";
import { accessibleLesson } from "@/lib/access";
import { parseDueDate } from "@/lib/due";
import { ACTION_DESCRIPTION_MAX, ACTION_TITLE_MAX, AI_SUGGESTIONS_PER_DAY, isActionStatus } from "@/lib/constants";
import { clip, consumeAiQuota, generateJson, isAiEnabled } from "@/lib/ai";

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

export async function createAction(input: ActionFields & { lessonId?: string | null; noteId?: string | null; source?: "MANUAL" | "AI" }): Promise<ActionResult> {
  const user = await requireApproved();
  const fields = cleanFields(input);
  if ("error" in fields) return { ok: false, error: fields.error };
  const links = await resolveLinks(user, input?.lessonId, input?.noteId);
  if (!links) return { ok: false, error: "That lesson or note isn't available." };

  const action = await db.action.create({ data: { userId: user.id, ...fields, ...links, fromNote: links.noteId !== null, source: input?.source === "AI" ? "AI" : "MANUAL" }, select: DTO_SELECT });
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

/* ----------------------------- AI suggestions ----------------------------- */

export type Suggestion = { title: string; description: string };
export type SuggestResult = { ok: true; suggestions: Suggestion[] } | { ok: false; error: string };

const UNAVAILABLE = "AI suggestions are unavailable right now — you can still create your own action.";

const SUGGEST_SYSTEM = `You help students of a trading education course turn their own lesson notes into practice tasks.
Suggest 1 to 3 short, concrete tasks the student can do on their own, based ONLY on the student's note and the lesson text provided.
Every task must be a study or practice activity, for example: review part of the lesson, practise identifying a pattern on historical charts, write a journal entry, practise on a demo account, or paper trade.
Never tell the student to place real trades or risk real money. Never give buy/sell signals or price predictions. Never introduce trading rules, numbers or strategies that are not in the lesson text.
Each title is an imperative of at most 80 characters. Each description is at most 300 characters and says exactly what to do.`;

const SUGGEST_SCHEMA = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: { title: { type: "string" }, description: { type: "string" } },
        required: ["title", "description"],
        additionalProperties: false,
      },
    },
  },
  required: ["suggestions"],
  additionalProperties: false,
};

/** 1–3 AI-suggested practice tasks for one of the user's notes. Nothing is saved. */
export async function suggestActions(noteId: string): Promise<SuggestResult> {
  const user = await requireApproved();
  if (!isAiEnabled()) return { ok: false, error: UNAVAILABLE };
  if (typeof noteId !== "string") return { ok: false, error: "Note not found." };
  const note = await db.lessonNote.findFirst({ where: { id: noteId, userId: user.id }, select: { content: true, lessonId: true } });
  const lesson = note ? await accessibleLesson(user, note.lessonId) : null;
  if (!note || !lesson) return { ok: false, error: "Note not found." };

  if (!(await consumeAiQuota(user.id, "SUGGEST_ACTIONS", AI_SUGGESTIONS_PER_DAY))) {
    return { ok: false, error: `You've used today's ${AI_SUGGESTIONS_PER_DAY} AI suggestions. Try again tomorrow — or create your own action below.` };
  }

  const prompt = [
    `<lesson_title>${lesson.title}</lesson_title>`,
    `<lesson_text>\n${lesson.content.slice(0, 3000)}\n</lesson_text>`,
    `<student_note>\n${note.content}\n</student_note>`,
    "Suggest 1 to 3 practice tasks for this student.",
  ].join("\n\n");
  const raw = await generateJson({ system: SUGGEST_SYSTEM, prompt, schema: SUGGEST_SCHEMA, maxTokens: 2000, effort: "low" });

  const list = raw && typeof raw === "object" && Array.isArray((raw as { suggestions?: unknown }).suggestions)
    ? (raw as { suggestions: unknown[] }).suggestions
    : null;
  const suggestions = (list ?? [])
    .filter((s): s is Suggestion => !!s && typeof (s as Suggestion).title === "string" && typeof (s as Suggestion).description === "string")
    .map((s) => ({ title: clip(s.title, 80), description: clip(s.description, 300) }))
    .filter((s) => s.title)
    .slice(0, 3);
  return suggestions.length ? { ok: true, suggestions } : { ok: false, error: UNAVAILABLE };
}

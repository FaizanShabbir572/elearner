import "server-only";
import type { Prisma } from "@prisma/client";
import { dueInputValue, dueLabel, dueState, formatDue } from "./due";
import { formatDateTime } from "./activity";
import { formatTimestamp } from "./video";

/** Prisma select for everything an action card needs. */
export const ACTION_CARD_SELECT = {
  id: true, title: true, description: true, status: true, source: true, dueDate: true, completedAt: true,
  lessonId: true, noteId: true, fromNote: true,
  lesson: { select: { title: true, module: { select: { courseId: true } } } },
  note: { select: { timestampSec: true } },
} satisfies Prisma.ActionSelect;

/** Open actions, most urgent first: earliest target date first, undated last. */
export const URGENCY_ORDER: Prisma.ActionOrderByWithRelationInput[] = [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }];

type ActionRow = Prisma.ActionGetPayload<{ select: typeof ACTION_CARD_SELECT }>;

/** Plain, serialisable data for the <ActionCard> client component. */
export type ActionCardData = {
  id: string;
  title: string;
  description: string;
  status: string;
  source: string;
  dueInput: string;
  dueText: string | null;
  dueState: "overdue" | "soon" | "later" | null;
  completedText: string | null;
  from: { href: string; label: string } | null;
  /** Created from a note that has since been deleted. */
  noteDeleted: boolean;
};

export function toCardData(a: ActionRow, today: Date): ActionCardData {
  const open = a.status !== "DONE";
  let from: ActionCardData["from"] = null;
  if (a.lesson && a.lessonId) {
    const ts = a.note?.timestampSec;
    const href = `/courses/${a.lesson.module.courseId}?lesson=${a.lessonId}${ts != null ? `&t=${ts}` : ""}`;
    const label = a.note
      ? ts != null ? `note at ${formatTimestamp(ts)} in ${a.lesson.title}` : `note in ${a.lesson.title}`
      : a.lesson.title;
    from = { href, label };
  }
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    status: a.status,
    source: a.source,
    dueInput: dueInputValue(a.dueDate),
    dueText: a.dueDate ? (open ? dueLabel(a.dueDate, today) : `Target ${formatDue(a.dueDate)}`) : null,
    dueState: open ? dueState(a.dueDate, today) : null,
    completedText: a.completedAt ? `Completed ${formatDateTime(a.completedAt)}` : null,
    from,
    noteDeleted: a.fromNote && a.noteId === null,
  };
}

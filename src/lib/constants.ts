export const ROLES = ["ADMIN", "STUDENT"] as const;
export const STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export const LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;

export type Role = (typeof ROLES)[number];
export type Status = (typeof STATUSES)[number];
export type Level = (typeof LEVELS)[number];

export const LEVEL_LABEL: Record<string, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

export function isLevel(v: unknown): v is Level {
  return typeof v === "string" && (LEVELS as readonly string[]).includes(v);
}

/** Maximum length of a lesson note. */
export const NOTE_MAX_LENGTH = 5000;

export const ACTION_STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];
export const ACTION_STATUS_LABEL: Record<string, string> = { TODO: "To do", IN_PROGRESS: "In progress", DONE: "Completed" };
export const ACTION_SOURCES = ["MANUAL", "AI"] as const;
export type ActionSource = (typeof ACTION_SOURCES)[number];
export const ACTION_TITLE_MAX = 200;
export const ACTION_DESCRIPTION_MAX = 5000;
/** AI action suggestions each student may request per rolling 24 hours. */
export const AI_SUGGESTIONS_PER_DAY = 30;

export function isActionStatus(v: unknown): v is ActionStatus {
  return typeof v === "string" && (ACTION_STATUSES as readonly string[]).includes(v);
}

/** Admin-authored quizzes (Exam models). */
export const EXAM_MIN_QUESTIONS = 1;
export const EXAM_MAX_QUESTIONS = 100;
export const EXAM_STATUSES = ["ASSIGNED", "SUBMITTED", "PASSED", "FAILED"] as const;
export const EXAM_STATUS_LABEL: Record<string, string> = { ASSIGNED: "Not submitted", SUBMITTED: "Awaiting review", PASSED: "Passed", FAILED: "Failed" };
export const EXAM_STATUS_STYLE: Record<string, string> = {
  ASSIGNED: "bg-surface-3 text-ink-2 ring-1 ring-line-strong",
  SUBMITTED: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  PASSED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  FAILED: "bg-red-50 text-red-700 ring-1 ring-red-200",
};

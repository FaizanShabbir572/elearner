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

export function isActionStatus(v: unknown): v is ActionStatus {
  return typeof v === "string" && (ACTION_STATUSES as readonly string[]).includes(v);
}

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

import "server-only";
import { db } from "./db";

/** Helpers for admin-authored quizzes (Exam models). */

export const LETTERS = ["A", "B", "C", "D"] as const;
export const QUESTION_MAX = 1000;
export const OPTION_MAX = 300;

export function parseOptions(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

/** { questionId: optionIndex } with anything malformed dropped. */
export function parseAnswers(json: string | unknown): Record<string, number> {
  let v: unknown = json;
  if (typeof json === "string") {
    try {
      v = JSON.parse(json);
    } catch {
      return {};
    }
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v)) if (Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 3) out[k] = n as number;
  return out;
}

export type DraftQuestion = { text: string; options: string[]; correctIndex: number };

/** Validate one question from form fields; returns an error message or the clean question. */
export function cleanQuestion(text: unknown, options: unknown[], correct: unknown): DraftQuestion | string {
  const t = typeof text === "string" ? text.trim() : "";
  const opts = options.map((o) => (typeof o === "string" ? o.trim() : ""));
  const idx = typeof correct === "string" ? LETTERS.indexOf(correct.toUpperCase() as (typeof LETTERS)[number]) : -1;
  if (!t) return "Question text is required.";
  if (t.length > QUESTION_MAX) return `Question text can be at most ${QUESTION_MAX} characters.`;
  if (opts.length !== 4 || opts.some((o) => !o)) return "All four options are required.";
  if (opts.some((o) => o.length > OPTION_MAX)) return `Options can be at most ${OPTION_MAX} characters.`;
  if (new Set(opts.map((o) => o.toLowerCase())).size !== 4) return "The four options must be different.";
  if (idx < 0) return "Choose the correct option.";
  return { text: t, options: opts, correctIndex: idx };
}

/**
 * Bulk import format — one question per block, blocks separated by a blank line:
 *
 *   1. What is a support level?
 *   A) An area where price has stopped falling before
 *   B) ...
 *   C) ...
 *   D) ...
 *   Answer: A
 */
export function parseImport(text: string): { questions: DraftQuestion[]; errors: string[] } {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const questions: DraftQuestion[] = [];
  const errors: string[] = [];
  blocks.forEach((block, i) => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const answerLine = lines.find((l) => /^(answer|correct|ans)\s*[:\-–]/i.test(l));
    const optionLines = lines.filter((l) => /^[A-D]\s*[).:\-]\s*/i.test(l));
    const questionLines = lines.filter((l) => l !== answerLine && !optionLines.includes(l));
    const label = `Question ${i + 1}`;
    if (questionLines.length === 0) return errors.push(`${label}: missing question text.`);
    if (optionLines.length !== 4) return errors.push(`${label}: needs exactly 4 options (A–D), found ${optionLines.length}.`);
    const letter = answerLine?.replace(/^(answer|correct|ans)\s*[:\-–]\s*/i, "").trim().charAt(0) ?? "";
    const q = cleanQuestion(
      questionLines.join(" ").replace(/^(q(uestion)?\s*)?\d+\s*[).:\-]\s*/i, ""),
      optionLines.map((l) => l.replace(/^[A-D]\s*[).:\-]\s*/i, "")),
      letter
    );
    if (typeof q === "string") errors.push(`${label}: ${letter ? q : "missing an “Answer: A/B/C/D” line."}`);
    else questions.push(q);
  });
  return { questions, errors };
}

/** Questions can't change once anyone has submitted, so reviews always match what was answered. */
export async function examLocked(examId: string) {
  return (await db.examAssignment.count({ where: { examId, status: { not: "ASSIGNED" } } })) > 0;
}

export function suggestedResult(score: number, total: number, passMark: number) {
  const percent = total ? Math.round((score / total) * 100) : 0;
  return { percent, pass: percent >= passMark };
}

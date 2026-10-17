"use server";

import { db } from "@/lib/db";
import { requireApproved } from "@/lib/auth";
import { accessibleLesson } from "@/lib/access";
import { MIN_QUESTIONS, getAssessment, toPublic, type Challenge, type PublicQuestion } from "@/lib/assessment";

const ANSWER_MAX = 10_000;
const REFLECTION_MAX = 5_000;

export type QuizStats = { bestScore: number; bestTotal: number; attempts: number } | null;
export type ChallengeWithResponse = Challenge & { answer: string; reflection: string; checked: boolean[]; completed: boolean };
export type PracticeData =
  | { status: "ready"; questions: PublicQuestion[] | null; stats: QuizStats; challenges: ChallengeWithResponse[] }
  | { status: "too_short" | "unavailable" };

export type QuestionResult = { questionId: string; choice: number | null; correct: boolean; correctIndex: number; explanation: string; sourceQuote: string };
export type QuizResult = { ok: true; score: number; total: number; results: QuestionResult[]; stats: QuizStats } | { ok: false; error: string };

async function quizStats(userId: string, lessonId: string): Promise<QuizStats> {
  // Best score counts full attempts only; "retry incorrect" rounds are practice.
  const attempts = await db.quizAttempt.findMany({ where: { userId, lessonId, kind: "QUIZ", isRetry: false }, select: { score: true, total: true } });
  if (attempts.length === 0) return null;
  const best = attempts.reduce((a, b) => (b.score / b.total > a.score / a.total ? b : a));
  return { bestScore: best.score, bestTotal: best.total, attempts: attempts.length };
}

function parseChecklist(json: string, length: number) {
  let arr: unknown = [];
  try {
    arr = JSON.parse(json);
  } catch {}
  return Array.from({ length }, (_, i) => Array.isArray(arr) && arr[i] === true);
}

/** Quiz (without answers) + challenges with the student's saved responses. Generates on first open. */
export async function loadPractice(lessonId: string): Promise<PracticeData> {
  const user = await requireApproved();
  if (!(await accessibleLesson(user, lessonId))) return { status: "unavailable" };

  const state = await getAssessment(lessonId, { generate: true });
  if (state.status !== "ready") return { status: state.status };

  const [stats, responses] = await Promise.all([
    quizStats(user.id, lessonId),
    db.challengeResponse.findMany({ where: { userId: user.id, lessonId } }),
  ]);
  const byId = new Map(responses.map((r) => [r.challengeId, r]));
  return {
    status: "ready",
    questions: state.questions.length >= MIN_QUESTIONS ? state.questions.map(toPublic) : null,
    stats,
    challenges: state.challenges.map((c) => {
      const r = byId.get(c.id);
      return { ...c, answer: r?.answer ?? "", reflection: r?.reflection ?? "", checked: parseChecklist(r?.checklistJson ?? "[]", c.checklist.length), completed: !!r?.completedAt };
    }),
  };
}

/**
 * Grade on the server. `answers` maps question id → chosen option index (in the original order).
 * A full attempt grades every question (unanswered = wrong); a retry grades only the ones sent.
 */
export async function submitQuiz(lessonId: string, answers: Record<string, number>, isRetry: boolean): Promise<QuizResult> {
  const user = await requireApproved();
  if (!(await accessibleLesson(user, lessonId))) return { ok: false, error: "Lesson not available." };
  const state = await getAssessment(lessonId, { generate: false });
  if (state.status !== "ready" || state.questions.length < MIN_QUESTIONS) return { ok: false, error: "This quiz has changed — please reload the page." };

  const given = answers && typeof answers === "object" ? answers : {};
  const asked = isRetry ? state.questions.filter((q) => Object.hasOwn(given, q.id)) : state.questions;
  if (asked.length === 0) return { ok: false, error: "No answers to grade." };

  const results: QuestionResult[] = asked.map((q) => {
    const raw = given[q.id];
    const choice = Number.isInteger(raw) && raw >= 0 && raw < q.options.length ? raw : null;
    return { questionId: q.id, choice, correct: choice === q.correctIndex, correctIndex: q.correctIndex, explanation: q.explanation, sourceQuote: q.sourceQuote };
  });
  const score = results.filter((r) => r.correct).length;

  await db.quizAttempt.create({
    data: {
      userId: user.id,
      lessonId,
      score,
      total: results.length,
      percent: Math.round((score / results.length) * 100),
      kind: "QUIZ",
      isRetry: !!isRetry,
      answersJson: JSON.stringify(Object.fromEntries(results.map((r) => [r.questionId, { choice: r.choice, correct: r.correct }]))),
    },
  });
  return { ok: true, score, total: results.length, results, stats: await quizStats(user.id, lessonId) };
}

/** Autosave one practice challenge. Completed = non-empty answer and every checklist item ticked. */
export async function saveChallengeResponse(
  lessonId: string,
  challengeId: string,
  input: { answer: string; reflection: string; checked: boolean[] }
): Promise<{ ok: true; completed: boolean } | { ok: false; error: string }> {
  const user = await requireApproved();
  if (!(await accessibleLesson(user, lessonId))) return { ok: false, error: "Lesson not available." };
  const state = await getAssessment(lessonId, { generate: false });
  const challenge = state.status === "ready" ? state.challenges.find((c) => c.id === challengeId) : undefined;
  if (!challenge) return { ok: false, error: "This challenge has changed — please reload the page." };

  const answer = typeof input?.answer === "string" ? input.answer : "";
  const reflection = typeof input?.reflection === "string" ? input.reflection : "";
  if (answer.length > ANSWER_MAX || reflection.length > REFLECTION_MAX) return { ok: false, error: "That answer is too long." };
  const checked = Array.from({ length: challenge.checklist.length }, (_, i) => Array.isArray(input?.checked) && input.checked[i] === true);
  const completed = answer.trim().length > 0 && checked.every(Boolean);

  const existing = await db.challengeResponse.findUnique({
    where: { userId_lessonId_challengeId: { userId: user.id, lessonId, challengeId } },
    select: { completedAt: true },
  });
  const data = { answer, reflection, checklistJson: JSON.stringify(checked), completedAt: completed ? (existing?.completedAt ?? new Date()) : null };
  await db.challengeResponse.upsert({
    where: { userId_lessonId_challengeId: { userId: user.id, lessonId, challengeId } },
    create: { userId: user.id, lessonId, challengeId, ...data },
    update: data,
  });
  return { ok: true, completed };
}

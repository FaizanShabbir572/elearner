import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";

/**
 * Optional AI features. Everything here degrades to "unavailable" (null) when
 * ANTHROPIC_API_KEY isn't set or a call fails — callers must always have a non-AI path.
 */

const DEFAULT_MODEL = "claude-haiku-5-5";
const TIMEOUT_MS = 20_000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isAiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

function aiModel() {
  return process.env.AI_MODEL?.trim() || DEFAULT_MODEL;
}

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/**
 * Ask the model for JSON matching `schema` (structured outputs). Returns the parsed
 * value, or null on any problem: no key, timeout, API error, refusal, truncation or bad JSON.
 * Callers still validate the shape themselves.
 */
export async function generateJson({ system, prompt, schema, maxTokens = 4000, effort = "low" }: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
}): Promise<unknown | null> {
  if (!isAiEnabled()) return null;
  try {
    const response = await getClient().messages.create(
      {
        model: aiModel(),
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: prompt }],
        output_config: { effort, format: { type: "json_schema", schema } },
      },
      { timeout: TIMEOUT_MS, maxRetries: 0 }
    );
    if (response.stop_reason !== "end_turn") {
      console.warn(`[ai] unusable response: stop_reason=${response.stop_reason}`);
      return null;
    }
    const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return JSON.parse(text);
  } catch (err) {
    if (err instanceof Anthropic.APIError) console.warn(`[ai] API error ${err.status ?? ""}: ${err.message}`);
    else console.warn("[ai] call failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Per-user rolling 24-hour limit for an AI feature. Records one use and returns true
 * if the user is under `limit`; returns false (and records nothing) once they reach it.
 */
export async function consumeAiQuota(userId: string, kind: string, limit: number) {
  const since = new Date(Date.now() - DAY_MS);
  const used = await db.aiUsage.count({ where: { userId, kind, createdAt: { gte: since } } });
  if (used >= limit) return false;
  await db.aiUsage.create({ data: { userId, kind } });
  return true;
}

/** Trim to `max` characters, adding an ellipsis if cut. */
export function clip(s: string, max: number) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

"use client";
import Link from "next/link";
import { useState } from "react";
import { createAction, suggestActions, type ActionDTO, type Suggestion } from "@/app/actions/student-actions";
import { ACTION_STATUS_LABEL } from "@/lib/constants";
import { ActionFieldsForm } from "./ActionCard";

const CHIP_STYLE: Record<string, string> = {
  TODO: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-sky-50 text-sky-700",
  DONE: "bg-emerald-50 text-emerald-700",
};

/** First ~80 characters of a note, cut at a word boundary. */
export function titleFromNote(content: string, max = 80) {
  const flat = content.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** NoteActionsRow that keeps its own list (for pages without a parent holding the actions). */
export function StatefulNoteActionsRow({ note, initialActions, aiEnabled }: { note: { id: string; content: string }; initialActions: ActionDTO[]; aiEnabled: boolean }) {
  const [actions, setActions] = useState(initialActions);
  return <NoteActionsRow note={note} actions={actions} aiEnabled={aiEnabled} onCreated={(a) => setActions((list) => [...list, a])} />;
}

/** Under a note: its linked actions as chips, plus a "Create action" button with an inline form. */
export function NoteActionsRow({ note, actions, aiEnabled, onCreated }: {
  note: { id: string; content: string }; actions: ActionDTO[]; aiEnabled: boolean; onCreated: (a: ActionDTO) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {actions.map((a) => (
          <Link key={a.id} href={`/actions?highlight=${a.id}`} title={a.title}
            className={`badge max-w-60 gap-1 hover:ring-1 hover:ring-slate-300 ${CHIP_STYLE[a.status] ?? CHIP_STYLE.TODO}`}>
            <span className="truncate">{a.title}</span>
            <span className="shrink-0 opacity-70">· {ACTION_STATUS_LABEL[a.status] ?? a.status}</span>
          </Link>
        ))}
        {!open && (
          <button type="button" className="badge border border-dashed border-slate-300 text-slate-600 hover:border-brand-400 hover:text-brand-700"
            onClick={() => setOpen(true)}>
            + Create action
          </button>
        )}
      </div>
      {open && (
        <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3">
          {aiEnabled && <AiSuggestions noteId={note.id} onAccepted={onCreated} />}
          <ActionFieldsForm
            initial={{ title: titleFromNote(note.content), description: note.content }}
            submitLabel="Create action"
            onSubmit={(fields) => createAction({ ...fields, noteId: note.id })}
            onDone={(res) => {
              onCreated(res.action);
              setOpen(false);
            }}
            onCancel={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

type SuggestionItem = Suggestion & { key: number; state: "idle" | "editing" | "saving" };

/** "Suggest with AI" → 1–3 suggestion cards with Accept / Edit / Discard. Accepted ones are saved with source "AI". */
function AiSuggestions({ noteId, onAccepted }: { noteId: string; onAccepted: (a: ActionDTO) => void }) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const [items, setItems] = useState<SuggestionItem[]>([]);

  async function suggest() {
    setStatus("loading");
    setMessage("");
    try {
      const res = await suggestActions(noteId);
      if (!res.ok) {
        setStatus("error");
        setMessage(res.error);
        return;
      }
      setItems(res.suggestions.map((s, i) => ({ ...s, key: Date.now() + i, state: "idle" })));
      setStatus("idle");
    } catch {
      setStatus("error");
      setMessage("AI suggestions are unavailable right now — you can still create your own action.");
    }
  }

  const update = (key: number, patch: Partial<SuggestionItem>) => setItems((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const discard = (key: number) => setItems((list) => list.filter((s) => s.key !== key));

  async function accept(item: SuggestionItem) {
    update(item.key, { state: "saving" });
    const res = await createAction({ title: item.title, description: item.description, noteId, source: "AI" });
    if (res.ok) {
      onAccepted(res.action);
      discard(item.key);
    } else {
      update(item.key, { state: "idle" });
      setMessage(res.error);
    }
  }

  return (
    <div className="mb-4 border-b border-slate-100 pb-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-secondary btn-sm" onClick={suggest} disabled={status === "loading"}>
          {status === "loading" ? "Thinking…" : items.length ? "✨ Suggest again" : "✨ Suggest with AI"}
        </button>
        <span className="text-xs text-slate-400">Practice ideas based on your note and this lesson. Not financial advice.</span>
      </div>
      {message && <p className={`mt-2 text-sm ${status === "error" ? "text-amber-800" : "text-red-700"}`} role="status">{message}</p>}
      {items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {items.map((s) => (
            <li key={s.key} className="rounded-lg border border-violet-200 bg-violet-50/40 p-3">
              {s.state === "editing" ? (
                <ActionFieldsForm
                  initial={{ title: s.title, description: s.description }}
                  submitLabel="Save action"
                  onSubmit={(fields) => createAction({ ...fields, noteId, source: "AI" })}
                  onDone={(res) => { onAccepted(res.action); discard(s.key); }}
                  onCancel={() => update(s.key, { state: "idle" })}
                />
              ) : (
                <>
                  <p className="text-sm font-medium text-slate-900">{s.title}</p>
                  {s.description && <p className="mt-0.5 text-sm text-slate-600">{s.description}</p>}
                  <div className="mt-2 flex gap-1.5">
                    <button type="button" className="btn btn-primary btn-sm" disabled={s.state === "saving"} onClick={() => accept(s)}>
                      {s.state === "saving" ? "Saving…" : "Accept"}
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => update(s.key, { state: "editing" })}>Edit</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => discard(s.key)}>Discard</button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

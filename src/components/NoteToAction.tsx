"use client";
import Link from "next/link";
import { useState } from "react";
import { createAction, type ActionDTO } from "@/app/actions/student-actions";
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
export function StatefulNoteActionsRow({ note, initialActions }: { note: { id: string; content: string }; initialActions: ActionDTO[] }) {
  const [actions, setActions] = useState(initialActions);
  return <NoteActionsRow note={note} actions={actions} onCreated={(a) => setActions((list) => [...list, a])} />;
}

/** Under a note: its linked actions as chips, plus a "Create action" button with an inline form. */
export function NoteActionsRow({ note, actions, onCreated }: { note: { id: string; content: string }; actions: ActionDTO[]; onCreated: (a: ActionDTO) => void }) {
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

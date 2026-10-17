"use client";
import Link from "next/link";
import { useId, useState } from "react";
import { createAction, deleteAction, setActionStatus, updateAction, type ActionFields, type ActionResult } from "@/app/actions/student-actions";
import { ACTION_DESCRIPTION_MAX, ACTION_TITLE_MAX } from "@/lib/constants";
import type { ActionCardData } from "@/lib/student-actions";
import { ConfirmButton, SubmitButton } from "./SubmitButton";

const DUE_STYLE = {
  overdue: "bg-red-50 text-red-700 ring-1 ring-red-200",
  soon: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  later: "bg-slate-100 text-slate-600",
} as const;

const CARD_ACCENT = { overdue: "border-l-4 border-l-red-500", soon: "border-l-4 border-l-amber-400", later: "" } as const;

function StatusButton({ id, status, children, primary }: { id: string; status: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <form action={setActionStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton className={`btn btn-sm ${primary ? "btn-primary" : "btn-secondary"}`}>{children}</SubmitButton>
    </form>
  );
}

export function ActionCard({ action, highlighted = false }: { action: ActionCardData; highlighted?: boolean }) {
  const [editing, setEditing] = useState(false);
  const a = action;

  if (editing) {
    return (
      <div className="card p-4">
        <ActionFieldsForm
          initial={{ title: a.title, description: a.description, dueDate: a.dueInput }}
          submitLabel="Save changes"
          onSubmit={(fields) => updateAction(a.id, fields)}
          onDone={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <article id={`action-${a.id}`}
      className={`card scroll-mt-6 p-4 ${a.dueState ? CARD_ACCENT[a.dueState] : ""} ${highlighted ? "ring-2 ring-brand-500" : ""} ${a.status === "DONE" ? "bg-slate-50/60" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className={`min-w-0 flex-1 font-medium break-words ${a.status === "DONE" ? "text-slate-500 line-through" : "text-slate-900"}`}>{a.title}</h3>
        <div className="flex flex-wrap gap-1.5">
          {a.source === "AI" && <span className="badge bg-violet-50 text-violet-700">AI suggested</span>}
          {a.status === "IN_PROGRESS" && <span className="badge bg-sky-50 text-sky-700">In progress</span>}
          {a.dueText && <span className={`badge ${a.dueState ? DUE_STYLE[a.dueState] : "bg-slate-100 text-slate-600"}`}>{a.dueText}</span>}
        </div>
      </div>
      {a.description && <p className="mt-1.5 text-sm break-words whitespace-pre-wrap text-slate-600">{a.description}</p>}
      {(a.from || a.noteDeleted) && (
        <p className="mt-2 text-xs text-slate-500">
          {a.from && <>From <Link href={a.from.href} className="font-medium text-brand-600 hover:underline">{a.from.label}</Link></>}
          {a.from && a.noteDeleted && " · "}
          {a.noteDeleted && <span className="italic">Source note deleted</span>}
        </p>
      )}
      {a.completedText && <p className="mt-2 text-xs text-slate-400">{a.completedText}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {a.status === "TODO" && <StatusButton id={a.id} status="IN_PROGRESS">Start</StatusButton>}
        {a.status !== "DONE" && <StatusButton id={a.id} status="DONE" primary>Mark complete</StatusButton>}
        {a.status === "DONE" && <StatusButton id={a.id} status="TODO">Reopen</StatusButton>}
        <span className="flex-1" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Edit</button>
        <form action={deleteAction}>
          <input type="hidden" name="id" value={a.id} />
          <ConfirmButton message={`Delete "${a.title}"?`} className="btn btn-ghost btn-sm text-red-600 hover:bg-red-50">Delete</ConfirmButton>
        </form>
      </div>
    </article>
  );
}

/** Title / description / target date fields, shared by "New action", "Edit" and note → action. */
export function ActionFieldsForm({ initial, submitLabel, onSubmit, onDone, onCancel, children }: {
  initial?: { title?: string; description?: string; dueDate?: string };
  submitLabel: string;
  onSubmit: (fields: ActionFields) => Promise<ActionResult>;
  onDone?: (result: Extract<ActionResult, { ok: true }>) => void;
  onCancel?: () => void;
  children?: React.ReactNode;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const id = useId();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      const res = await onSubmit({ title, description, dueDate });
      if (!res.ok) return setError(res.error);
      onDone?.(res);
    } catch {
      setError("Couldn't save — please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
      {children}
      <div>
        <label className="label" htmlFor={`${id}-title`}>Title</label>
        <input id={`${id}-title`} className="input" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={ACTION_TITLE_MAX} placeholder="e.g. Practise marking support levels on 3 charts" />
      </div>
      <div>
        <label className="label" htmlFor={`${id}-desc`}>Description <span className="font-normal text-slate-400">(optional)</span></label>
        <textarea id={`${id}-desc`} className="input min-h-20 resize-y" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={ACTION_DESCRIPTION_MAX} />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor={`${id}-due`}>Target date <span className="font-normal text-slate-400">(optional)</span></label>
          <div className="flex items-center gap-2">
            <input id={`${id}-due`} type="date" className="input w-auto" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            {dueDate && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDueDate("")}>Clear</button>}
          </div>
        </div>
        <span className="flex-1" />
        {onCancel && <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>}
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
      </div>
    </form>
  );
}

export function NewActionForm() {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  if (!open) {
    return <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>+ New action</button>;
  }
  return (
    <div className="card w-full p-5">
      <h2 className="mb-3 font-semibold">New action</h2>
      <ActionFieldsForm key={formKey} submitLabel="Create action"
        onSubmit={(fields) => createAction(fields)}
        onDone={() => { setFormKey((k) => k + 1); setOpen(false); }}
        onCancel={() => setOpen(false)} />
    </div>
  );
}

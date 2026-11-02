"use client";
import { useActionState, useMemo, useState } from "react";
import { addQuestion, assignExam, importQuestions, updateQuestion, type FormResult } from "@/app/actions/admin-exams";
import { LEVEL_LABEL } from "@/lib/constants";
import { SubmitButton } from "./SubmitButton";

const LETTERS = ["A", "B", "C", "D"] as const;

function Message({ state }: { state: FormResult }) {
  if (state?.error) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm whitespace-pre-line text-red-700" role="alert">{state.error}</p>;
  if (state?.ok) return <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">{state.ok}</p>;
  return null;
}

/** Add a question (no `question`) or edit one. */
export function QuestionForm({ examId, question, onDone }: {
  examId: string;
  question?: { id: string; text: string; options: string[]; correctIndex: number };
  onDone?: () => void;
}) {
  const [state, action] = useActionState(async (prev: FormResult, form: FormData) => {
    const res = await (question ? updateQuestion(prev, form) : addQuestion(prev, form));
    if (res?.ok && question) onDone?.();
    if (res?.ok && !question) setFormKey((k) => k + 1); // clear the form for the next question
    return res;
  }, undefined);
  const [formKey, setFormKey] = useState(0);
  const prefix = question?.id ?? "new";

  return (
    <form key={formKey} action={action} className="space-y-3">
      {question ? <input type="hidden" name="id" value={question.id} /> : <input type="hidden" name="examId" value={examId} />}
      <Message state={state} />
      <div>
        <label className="label" htmlFor={`${prefix}-text`}>Question</label>
        <textarea id={`${prefix}-text`} name="text" required maxLength={1000} className="input min-h-16 resize-y" defaultValue={question?.text} />
      </div>
      <fieldset className="space-y-2">
        <legend className="label">Options <span className="font-normal text-slate-400">— select the correct one</span></legend>
        {LETTERS.map((l, i) => (
          <div key={l} className="flex items-center gap-2">
            <input type="radio" name="correct" value={l} required defaultChecked={question?.correctIndex === i} aria-label={`Option ${l} is correct`} />
            <span className="w-4 text-sm font-medium text-slate-500">{l}</span>
            <input name={`option${l}`} required maxLength={300} className="input" defaultValue={question?.options[i]} aria-label={`Option ${l}`} />
          </div>
        ))}
      </fieldset>
      <div className="flex gap-2">
        <SubmitButton className="btn btn-primary btn-sm" pendingText="Saving…">{question ? "Save question" : "Add question"}</SubmitButton>
        {onDone && <button type="button" className="btn btn-secondary btn-sm" onClick={onDone}>Cancel</button>}
      </div>
    </form>
  );
}

/** A question row in the admin list, with inline editing. */
export function QuestionRow({ examId, index, question, locked, deleteSlot }: {
  examId: string; index: number; question: { id: string; text: string; options: string[]; correctIndex: number }; locked: boolean; deleteSlot: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return <div className="rounded-lg border border-brand-200 bg-brand-50/30 p-4"><QuestionForm examId={examId} question={question} onDone={() => setEditing(false)} /></div>;
  }
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium whitespace-pre-wrap text-slate-900">{index + 1}. {question.text}</p>
        {!locked && (
          <div className="flex shrink-0 gap-1">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Edit</button>
            {deleteSlot}
          </div>
        )}
      </div>
      <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
        {question.options.map((o, i) => (
          <li key={i} className={i === question.correctIndex ? "font-medium text-emerald-700" : "text-slate-600"}>
            {LETTERS[i]}) {o} {i === question.correctIndex && "✓"}
          </li>
        ))}
      </ul>
    </div>
  );
}

const SAMPLE = `1. What is a support level?
A) A price area where falling price has repeatedly stopped
B) The highest price of the day
C) A type of order
D) A moving average
Answer: A

2. Next question…
A) …
B) …
C) …
D) …
Answer: C`;

export function ImportForm({ examId }: { examId: string }) {
  const [state, action] = useActionState(importQuestions, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="examId" value={examId} />
      <Message state={state} />
      <textarea name="text" className="input min-h-56 font-mono text-[13px]" placeholder={SAMPLE} required />
      <p className="text-xs text-slate-500">One question per block, separated by a blank line: the question, four lines starting A) B) C) D), then <code>Answer: A</code>. If any block has a problem, nothing is imported.</p>
      <SubmitButton className="btn btn-primary btn-sm" pendingText="Importing…">Import questions</SubmitButton>
    </form>
  );
}

type Student = { id: string; name: string; email: string; level: string | null };

export function AssignForm({ examId, students, canAssign }: { examId: string; students: Student[]; canAssign: boolean }) {
  const [state, action] = useActionState(assignExam, undefined);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => (!level || s.level === level) && (!q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)));
  }, [students, query, level]);
  const allShownSelected = shown.length > 0 && shown.every((s) => selected.has(s.id));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const s of shown) allShownSelected ? next.delete(s.id) : next.add(s.id);
      return next;
    });
  }

  if (students.length === 0) return <p className="text-sm text-slate-500">Every approved student already has this quiz.</p>;

  return (
    <form action={async (form) => { await action(form); setSelected(new Set()); }} className="space-y-3">
      <input type="hidden" name="examId" value={examId} />
      <Message state={state} />
      <div className="flex flex-wrap gap-2">
        <input type="search" className="input min-w-40 flex-1" placeholder="Search name or email…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search students" />
        <select className="input w-auto" value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Filter by level">
          <option value="">All levels</option>
          {Object.entries(LEVEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
        <label className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={allShownSelected} onChange={toggleAll} /> Select all shown ({shown.length})
        </label>
        {shown.map((s) => (
          <label key={s.id} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50">
            <input type="checkbox" name="userIds" value={s.id} checked={selected.has(s.id)}
              onChange={(e) => setSelected((prev) => { const n = new Set(prev); if (e.target.checked) n.add(s.id); else n.delete(s.id); return n; })} />
            <span className="text-slate-900">{s.name}</span>
            <span className="truncate text-xs text-slate-500">{s.email}</span>
            {s.level && <span className="ml-auto shrink-0 text-xs text-slate-400">{LEVEL_LABEL[s.level] ?? s.level}</span>}
          </label>
        ))}
        {shown.length === 0 && <p className="px-3 py-3 text-sm text-slate-500">No students match.</p>}
      </div>
      {/* Selected students hidden by the current filter are still submitted. */}
      {[...selected].filter((id) => !shown.some((s) => s.id === id)).map((id) => <input key={id} type="hidden" name="userIds" value={id} />)}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="assign-due">Due date <span className="font-normal text-slate-400">(optional)</span></label>
          <input id="assign-due" type="date" name="dueDate" className="input w-auto" />
        </div>
        <SubmitButton className="btn btn-primary" pendingText="Assigning…" disabled={!canAssign || selected.size === 0}>
          Assign to {selected.size} student{selected.size === 1 ? "" : "s"}
        </SubmitButton>
      </div>
    </form>
  );
}

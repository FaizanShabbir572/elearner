"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createNote, deleteNote, updateNote, type NoteDTO } from "@/app/actions/notes";
import { NOTE_MAX_LENGTH } from "@/lib/constants";
import { formatTimestamp } from "@/lib/video";
import { useVideoPlayer } from "./LessonVideoPlayer";
import { ConfirmButton } from "./SubmitButton";
import { NoteActionsRow } from "./NoteToAction";
import type { ActionDTO } from "@/app/actions/student-actions";

const AUTOSAVE_DELAY_MS = 800;

/** Notes with a timestamp in video order, then untimed notes oldest first. */
function sortNotes(notes: NoteDTO[]) {
  return [...notes].sort((a, b) => {
    if (a.timestampSec !== b.timestampSec) {
      if (a.timestampSec === null) return 1;
      if (b.timestampSec === null) return -1;
      return a.timestampSec - b.timestampSec;
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

// createdId: id of a new note once its first autosave lands (hidden from the list while still being edited).
type Draft = { key: string; noteId: string | null; createdId?: string; timestampSec: number | null; content: string };

export function NotesPanel({ courseId, lessonId, hasVideo, initialNotes, initialActions, aiEnabled }: {
  courseId: string; lessonId: string; hasVideo: boolean; initialNotes: NoteDTO[]; initialActions: ActionDTO[]; aiEnabled: boolean;
}) {
  const player = useVideoPlayer();
  const router = useRouter();
  const [notes, setNotes] = useState(() => sortNotes(initialNotes));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [actions, setActions] = useState(initialActions);

  const upsert = useCallback((note: NoteDTO) => {
    setNotes((list) => sortNotes([...list.filter((n) => n.id !== note.id), note]));
  }, []);

  async function addNote() {
    let timestampSec: number | null = null;
    if (hasVideo) {
      player.pause();
      timestampSec = await player.getCurrentTime();
    }
    setDraft({ key: `new-${Date.now()}`, noteId: null, timestampSec, content: "" });
  }

  function jumpTo(sec: number) {
    if (player.ready) {
      player.seekTo(sec);
      player.play();
      player.scrollIntoView();
    } else {
      // Plain-iframe fallback: reload the lesson starting at that time.
      router.push(`/courses/${courseId}?lesson=${lessonId}&t=${sec}`, { scroll: false });
    }
  }

  async function remove(id: string) {
    const res = await deleteNote(id);
    if (res.ok) setNotes((list) => list.filter((n) => n.id !== id));
  }

  return (
    <section className="card mb-8 p-5" aria-label="My notes">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-semibold">My notes {notes.length > 0 && <span className="text-sm font-normal text-muted">({notes.length})</span>}</h3>
        {!draft && (
          <button type="button" className="btn btn-primary btn-sm" onClick={addNote}>
            + Add note{hasVideo && player.ready ? " at current time" : ""}
          </button>
        )}
      </div>

      {draft && !draft.noteId && (
        <NoteEditor key={draft.key} lessonId={lessonId} noteId={null} timestampSec={draft.timestampSec} initialContent=""
          onSaved={(note) => {
            upsert(note);
            setDraft((d) => (d && !d.noteId ? { ...d, createdId: note.id } : d));
          }}
          onDone={() => setDraft(null)} />
      )}

      {notes.length === 0 && !draft ? (
        <p className="text-sm text-muted">
          {hasVideo ? "Pause anywhere and add a note — it's stamped with the video time so you can jump back later." : "Jot down key points from this lesson."}
        </p>
      ) : (
        <ul className="divide-y divide-line/70">
          {notes.filter((n) => n.id !== draft?.createdId).map((n) => (
            <li key={n.id} className="py-3 first:pt-0 last:pb-0">
              {draft?.noteId === n.id ? (
                <NoteEditor key={draft.key} lessonId={lessonId} noteId={n.id} timestampSec={n.timestampSec} initialContent={n.content}
                  onSaved={upsert} onDone={() => setDraft(null)} />
              ) : (
                <div className="flex gap-3">
                  {n.timestampSec !== null ? (
                    <button type="button" onClick={() => jumpTo(n.timestampSec!)} title="Jump to this moment"
                      className="badge h-fit shrink-0 bg-brand-50 font-mono text-brand-700 hover:bg-brand-100">
                      ▶ {formatTimestamp(n.timestampSec)}
                    </button>
                  ) : (
                    <span className="badge h-fit shrink-0 bg-surface-3 text-muted">Note</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm break-words whitespace-pre-wrap text-ink-2">{n.content}</p>
                    <NoteActionsRow note={n} actions={actions.filter((a) => a.noteId === n.id)} aiEnabled={aiEnabled}
                      onCreated={(a) => setActions((list) => [...list, a])} />
                  </div>
                  <div className="flex h-fit shrink-0 gap-1">
                    <button type="button" className="btn btn-ghost btn-sm" disabled={!!draft}
                      onClick={() => setDraft({ key: `edit-${n.id}`, noteId: n.id, timestampSec: n.timestampSec, content: n.content })}>Edit</button>
                    <form action={() => remove(n.id)}>
                      <ConfirmButton message="Delete this note?" className="btn btn-ghost btn-sm text-red-600 hover:bg-red-50">Delete</ConfirmButton>
                    </form>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Textarea that saves itself: ~800 ms after typing stops, on blur, and when closed. */
function NoteEditor({ lessonId, noteId, timestampSec, initialContent, onSaved, onDone }: {
  lessonId: string; noteId: string | null; timestampSec: number | null; initialContent: string;
  onSaved: (note: NoteDTO) => void; onDone: () => void;
}) {
  const [text, setText] = useState(initialContent);
  const [status, setStatus] = useState<"idle" | "pending" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const textRef = useRef(initialContent);
  const savedRef = useRef(initialContent);
  const idRef = useRef(noteId);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Saves run one after another so a new note is created exactly once.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  const save = useCallback(() => {
    clearTimeout(timer.current);
    queue.current = queue.current.then(async () => {
      const content = textRef.current;
      if (content === savedRef.current || !content.trim()) {
        setStatus((s) => (s === "pending" ? "idle" : s));
        return;
      }
      setStatus("saving");
      try {
        const res = idRef.current ? await updateNote(idRef.current, content) : await createNote(lessonId, timestampSec, content);
        if (!res.ok) {
          setStatus("error");
          setError(res.error);
          return;
        }
        idRef.current = res.note.id;
        savedRef.current = content;
        onSavedRef.current(res.note);
        setStatus(textRef.current === content ? "saved" : "pending");
      } catch {
        setStatus("error");
        setError("Couldn't save — check your connection.");
      }
    });
    return queue.current;
  }, [lessonId, timestampSec]);

  // Flush unsaved text if the editor disappears (e.g. navigating to another lesson).
  useEffect(() => () => void save(), [save]);

  async function done() {
    await save();
    onDone();
  }

  return (
    <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50/40 p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-medium text-muted">
          {timestampSec !== null ? <>At <span className="font-mono">{formatTimestamp(timestampSec)}</span></> : "No timestamp"}
        </span>
        <span className={status === "error" ? "text-red-600" : "text-muted"} aria-live="polite">
          {status === "pending" || status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? error : ""}
        </span>
      </div>
      <textarea
        className="input min-h-24 resize-y"
        autoFocus
        maxLength={NOTE_MAX_LENGTH}
        placeholder="Write your note…"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          textRef.current = e.target.value;
          setStatus("pending");
          clearTimeout(timer.current);
          timer.current = setTimeout(save, AUTOSAVE_DELAY_MS);
        }}
        onBlur={() => void save()}
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-faint">{text.length.toLocaleString()} / {NOTE_MAX_LENGTH.toLocaleString()}</span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={done}>Done</button>
      </div>
    </div>
  );
}

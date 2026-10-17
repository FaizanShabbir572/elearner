"use client";
import { useActionState, useState } from "react";
import { updateLesson } from "@/app/actions/admin-courses";
import { toEmbedUrl } from "@/lib/video";
import { SubmitButton } from "./SubmitButton";

type Lesson = { id: string; title: string; content: string; videoUrl: string | null; transcript: string };

export function LessonEditor({ lesson }: { lesson: Lesson }) {
  const [state, action] = useActionState(updateLesson, undefined);
  const [video, setVideo] = useState(lesson.videoUrl ?? "");
  const embed = toEmbedUrl(video);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={lesson.id} />
      {state?.error && <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700" role="alert">{state.error}</p>}
      <div className="card space-y-5 p-5">
        <div>
          <label className="label" htmlFor="title">Lesson title</label>
          <input className="input" id="title" name="title" required defaultValue={lesson.title} />
        </div>
        <div>
          <label className="label" htmlFor="videoUrl">Video link <span className="font-normal text-slate-400">(optional)</span></label>
          <input className="input" id="videoUrl" name="videoUrl" value={video} onChange={(e) => setVideo(e.target.value)} placeholder="https://www.youtube.com/watch?v=… or https://vimeo.com/…" />
          {video && !embed && <p className="mt-1 text-xs text-amber-700">Not recognised as a YouTube or Vimeo link yet.</p>}
          {embed && (
            <div className="mt-3 aspect-video overflow-hidden rounded-lg bg-slate-900">
              <iframe src={embed} className="h-full w-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title="Video preview" />
            </div>
          )}
        </div>
        <div>
          <label className="label" htmlFor="content">Lesson content</label>
          <textarea className="input min-h-80 font-mono text-[13px] leading-relaxed" id="content" name="content" defaultValue={lesson.content}
            placeholder={"## Introduction\n\nWrite your lesson here. **Markdown** is supported: headings, lists, links, `code` and code blocks."} />
          <p className="mt-1 text-xs text-slate-500">Markdown supported — headings, **bold**, lists, links, `code` and fenced code blocks.</p>
        </div>
        <div>
          <label className="label" htmlFor="transcript">Video transcript / key points <span className="font-normal text-slate-400">(optional — improves quizzes)</span></label>
          <textarea className="input min-h-40 text-[13px] leading-relaxed" id="transcript" name="transcript" defaultValue={lesson.transcript}
            placeholder="Paste the video transcript (YouTube: … → Show transcript) or the key points covered in the video." />
          <p className="mt-1 text-xs text-slate-500">Not shown to students. Quizzes and practice challenges are generated only from the lesson content and this text.</p>
        </div>
      </div>
      <SubmitButton className="btn btn-primary" pendingText="Saving…">Save lesson</SubmitButton>
    </form>
  );
}

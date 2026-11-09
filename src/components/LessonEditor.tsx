"use client";
import { useActionState, useRef, useState } from "react";
import { updateLesson } from "@/app/actions/admin-courses";
import { isUploadedVideo, toEmbedUrl } from "@/lib/video";
import { SubmitButton } from "./SubmitButton";

type Lesson = { id: string; title: string; content: string; videoUrl: string | null; transcript: string };

const ACCEPT = ".mp4,.webm,.mov,.m4v,.ogv,video/mp4,video/webm,video/quicktime,video/ogg";

/** Sends the file as the raw request body; XHR (not fetch) so we get upload progress. */
function uploadVideo(file: File, onProgress: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/videos");
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let body: { url?: string; error?: string } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status === 200 && body.url) resolve(body.url);
      else reject(new Error(body.error ?? `Upload failed (HTTP ${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(file);
  });
}

export function LessonEditor({ lesson }: { lesson: Lesson }) {
  const [state, action] = useActionState(updateLesson, undefined);
  const [video, setVideo] = useState(lesson.videoUrl ?? "");
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const embed = toEmbedUrl(video);
  const uploaded = isUploadedVideo(video);
  const uploading = progress !== null;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploadError(null);
    setProgress(0);
    try {
      setVideo(await uploadVideo(file, setProgress));
      setUploadName(file.name);
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setProgress(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

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
          <label className="label" htmlFor="videoUrl">Video <span className="font-normal text-faint">(optional)</span></label>
          <input ref={fileInput} type="file" accept={ACCEPT} className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          {uploaded ? (
            <>
              <input type="hidden" name="videoUrl" value={video} />
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-ink-2">{uploadName ?? "Uploaded video"}</span>
                <button type="button" className="btn btn-secondary btn-sm" disabled={uploading} onClick={() => fileInput.current?.click()}>Replace</button>
                <button type="button" className="btn btn-secondary btn-sm" disabled={uploading} onClick={() => { setVideo(""); setUploadName(null); }}>Remove</button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              <input className="input min-w-0 flex-1" id="videoUrl" name="videoUrl" value={video} onChange={(e) => setVideo(e.target.value)}
                disabled={uploading} placeholder="Paste a YouTube or Vimeo link…" />
              <button type="button" className="btn btn-secondary" disabled={uploading} onClick={() => fileInput.current?.click()}>Upload video file</button>
            </div>
          )}
          {uploading && (
            <div className="mt-2" role="status">
              <div className="h-2 overflow-hidden rounded-full bg-line">
                <div className="h-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted">Uploading… {progress}% (keep this page open)</p>
            </div>
          )}
          {uploadError && <p className="mt-1 text-xs text-red-700" role="alert">{uploadError}</p>}
          {!uploaded && video && !embed && <p className="mt-1 text-xs text-amber-700">Not recognised as a YouTube or Vimeo link yet.</p>}
          {!uploading && <p className="mt-1 text-xs text-muted">Upload an MP4 (recommended), WebM or MOV file, or link a YouTube/Vimeo video. Remember to save the lesson after uploading.</p>}
          {embed && (
            <div className="mt-3 aspect-video overflow-hidden rounded-lg bg-black">
              {uploaded
                ? <video key={embed} src={embed} className="h-full w-full" controls preload="metadata" />
                : <iframe src={embed} className="h-full w-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title="Video preview" />}
            </div>
          )}
        </div>
        <div>
          <label className="label" htmlFor="content">Lesson content</label>
          <textarea className="input min-h-80 font-mono text-[13px] leading-relaxed" id="content" name="content" defaultValue={lesson.content}
            placeholder={"## Introduction\n\nWrite your lesson here. **Markdown** is supported: headings, lists, links, `code` and code blocks."} />
          <p className="mt-1 text-xs text-muted">Markdown supported — headings, **bold**, lists, links, `code` and fenced code blocks.</p>
        </div>
        <div>
          <label className="label" htmlFor="transcript">Video transcript / key points <span className="font-normal text-faint">(optional — improves quizzes)</span></label>
          <textarea className="input min-h-40 text-[13px] leading-relaxed" id="transcript" name="transcript" defaultValue={lesson.transcript}
            placeholder="Paste the video transcript (YouTube: … → Show transcript) or the key points covered in the video." />
          <p className="mt-1 text-xs text-muted">Not shown to students. Quizzes and practice challenges are generated only from the lesson content and this text.</p>
        </div>
      </div>
      <SubmitButton className="btn btn-primary" pendingText="Saving…">Save lesson</SubmitButton>
    </form>
  );
}

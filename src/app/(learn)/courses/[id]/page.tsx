import Link from "next/link";
import { notFound } from "next/navigation";
import { requireApproved } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessCourse } from "@/lib/courses";
import { renderMarkdown } from "@/lib/markdown";
import { toEmbedUrl } from "@/lib/video";
import { setLessonComplete } from "@/app/actions/learning";
import { SubmitButton } from "@/components/SubmitButton";
import { ProgressBar } from "@/components/ui";
import { LessonVideoPlayer, VideoPlayerProvider } from "@/components/LessonVideoPlayer";
import { NotesPanel } from "@/components/NotesPanel";
import { isAiEnabled } from "@/lib/ai";
import { practiceAvailability } from "@/lib/assessment";
import { LessonPractice } from "@/components/LessonPractice";
import { WatchTracker } from "@/components/WatchTracker";

export default async function CoursePlayer({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lesson?: string; t?: string }> }) {
  const user = await requireApproved();
  const { id } = await params;
  const { lesson: lessonParam, t } = await searchParams;

  const course = await db.course.findUnique({
    where: { id },
    include: {
      modules: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        include: { lessons: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } },
      },
    },
  });
  if (!course || !canAccessCourse(user, course)) notFound();

  const lessons = course.modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleTitle: m.title })));
  const [progress, cert] = await Promise.all([
    db.progress.findMany({ where: { userId: user.id, completed: true, lessonId: { in: lessons.map((l) => l.id) } }, select: { lessonId: true } }),
    db.certificate.findUnique({ where: { userId_courseId: { userId: user.id, courseId: course.id } } }),
  ]);
  const done = new Set(progress.map((p) => p.lessonId));
  const percent = lessons.length ? Math.round((done.size / lessons.length) * 100) : 0;

  // Default to the first unfinished lesson so "Continue" picks up where the student left off.
  const index = Math.max(0, lessonParam ? lessons.findIndex((l) => l.id === lessonParam) : lessons.findIndex((l) => !done.has(l.id)));
  const current = lessons[index];
  const prev = lessons[index - 1];
  const next = lessons[index + 1];
  const embed = toEmbedUrl(current?.videoUrl);
  const isDone = current ? done.has(current.id) : false;
  // ?t=<seconds> (from a note link) starts the video at that moment.
  const startAt = current && lessonParam === current.id && t && /^\d+$/.test(t) ? Number(t) : null;
  const [notes, noteActions] = current
    ? await Promise.all([
        db.lessonNote.findMany({
          where: { userId: user.id, lessonId: current.id },
          select: { id: true, lessonId: true, timestampSec: true, content: true, createdAt: true, updatedAt: true },
        }),
        db.action.findMany({
          where: { userId: user.id, lessonId: current.id, noteId: { not: null } },
          orderBy: { createdAt: "asc" },
          select: { id: true, title: true, status: true, noteId: true },
        }),
      ])
    : [[], []];
  const practice = current ? await practiceAvailability(current) : "hidden";

  return (
    <div className="lg:flex lg:min-h-screen">
      {/* Curriculum sidebar */}
      <aside className="border-b border-line bg-surface lg:sticky lg:top-0 lg:h-screen lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-b-0">
        <div className="border-b border-line p-5">
          <Link href="/dashboard" className="text-xs text-muted hover:text-ink">← My courses</Link>
          <h1 className="mt-1.5 font-semibold leading-snug">{course.title}</h1>
          <div className="mt-3 mb-1.5 flex justify-between text-xs text-muted">
            <span>{done.size}/{lessons.length} lessons</span>
            <span className="font-medium text-ink-2">{percent}% complete</span>
          </div>
          <ProgressBar percent={percent} />
        </div>
        <nav className="max-h-72 overflow-y-auto p-3 lg:max-h-none">
          {course.modules.map((m, mi) => (
            <div key={m.id} className="mb-3">
              <p className="px-2 py-1.5 text-xs font-semibold tracking-wide text-faint uppercase">Module {mi + 1} · {m.title}</p>
              {m.lessons.map((l) => {
                const active = l.id === current?.id;
                const complete = done.has(l.id);
                return (
                  <Link key={l.id} href={`/courses/${course.id}?lesson=${l.id}`}
                    className={`flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm ${active ? "bg-brand-50 font-medium text-brand-700" : "text-ink-2 hover:bg-surface-2"}`}>
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${complete ? "border-emerald-500 bg-emerald-500 text-white" : active ? "border-brand-500" : "border-line-strong"}`}>
                      {complete && <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="m5 12 5 5L20 7" /></svg>}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{l.title}</span>
                    {l.videoUrl && <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-faint" fill="currentColor" aria-label="Video"><path d="M8 5v14l11-7z" /></svg>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* Lesson */}
      <section className="min-w-0 flex-1 px-5 py-8 md:px-10">
        <div className="mx-auto max-w-3xl">
          {cert && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
              <div>
                <p className="font-semibold text-emerald-900">🎉 Course complete!</p>
                <p className="text-sm text-emerald-800">Your certificate {cert.certificateNumber} is ready.</p>
              </div>
              <a href={`/certificates/${cert.id}`} className="btn btn-success">Download certificate</a>
            </div>
          )}

          {!current ? (
            <div className="card px-6 py-14 text-center text-muted">This course doesn&apos;t have any lessons yet.</div>
          ) : (
            <VideoPlayerProvider key={current.id}>
              <p className="text-xs font-medium tracking-wide text-faint uppercase">{current.moduleTitle} · Lesson {index + 1} of {lessons.length}</p>
              <h2 className="mt-1 mb-6 text-2xl font-semibold tracking-tight">{current.title}</h2>

              {embed && (
                <>
                  <LessonVideoPlayer embedUrl={embed} title={current.title} startAt={startAt} />
                  <WatchTracker lessonId={current.id} />
                  <NotesPanel courseId={course.id} lessonId={current.id} hasVideo initialNotes={notes} initialActions={noteActions} aiEnabled={isAiEnabled()} />
                </>
              )}

              {current.content.trim() && (
                <article className="prose prose-twr max-w-none prose-headings:font-semibold prose-pre:border prose-pre:border-line"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(current.content) }} />
              )}

              {practice !== "hidden" && <LessonPractice key={current.id} lessonId={current.id} availability={practice} />}

              {!embed && <div className="mt-8"><NotesPanel courseId={course.id} lessonId={current.id} hasVideo={false} initialNotes={notes} initialActions={noteActions} aiEnabled={isAiEnabled()} /></div>}

              <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
                {prev ? <Link href={`/courses/${course.id}?lesson=${prev.id}`} className="btn btn-ghost">← Previous</Link> : <span />}
                <div className="flex gap-2">
                  <form action={setLessonComplete}>
                    <input type="hidden" name="lessonId" value={current.id} />
                    <input type="hidden" name="completed" value={isDone ? "false" : "true"} />
                    {isDone
                      ? <SubmitButton className="btn btn-secondary">✓ Completed · Undo</SubmitButton>
                      : <SubmitButton className="btn btn-primary" pendingText="Saving…">Mark as complete</SubmitButton>}
                  </form>
                  {next && <Link href={`/courses/${course.id}?lesson=${next.id}`} className={`btn ${isDone ? "btn-primary" : "btn-secondary"}`}>Next →</Link>}
                </div>
              </div>
            </VideoPlayerProvider>
          )}
        </div>
      </section>
    </div>
  );
}

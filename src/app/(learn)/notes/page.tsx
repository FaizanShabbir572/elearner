import Link from "next/link";
import { requireApproved } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/activity";
import { formatTimestamp } from "@/lib/video";
import { EmptyState, PageHeader } from "@/components/ui";
import { StatefulNoteActionsRow } from "@/components/NoteToAction";
import { isAiEnabled } from "@/lib/ai";

export const metadata = { title: "My notes" };

const PAGE_SIZE = 50;

type NoteRow = { id: string; lessonId: string; timestampSec: number | null; content: string; updatedAt: Date };
type CourseGroup = { id: string; title: string; lessons: Map<string, { title: string; notes: NoteRow[] }> };

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const user = await requireApproved();
  const { q: rawQ, page: rawPage } = await searchParams;
  const q = (rawQ ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);

  // Note: SQLite's `contains` is case-insensitive for ASCII; on PostgreSQL add `mode: "insensitive"`.
  const where = {
    userId: user.id,
    ...(q ? { OR: [{ content: { contains: q } }, { lesson: { title: { contains: q } } }] } : {}),
  };
  const [notes, total] = await Promise.all([
    db.lessonNote.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, lessonId: true, timestampSec: true, content: true, updatedAt: true,
        lesson: { select: { title: true, module: { select: { course: { select: { id: true, title: true } } } } } },
      },
    }),
    db.lessonNote.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const actions = notes.length
    ? await db.action.findMany({
        where: { userId: user.id, noteId: { in: notes.map((n) => n.id) } },
        orderBy: { createdAt: "asc" },
        select: { id: true, title: true, status: true, noteId: true },
      })
    : [];

  // Group this page's notes by course > lesson, keeping newest-first order.
  const groups = new Map<string, CourseGroup>();
  for (const n of notes) {
    const course = n.lesson.module.course;
    const g = groups.get(course.id) ?? { id: course.id, title: course.title, lessons: new Map() };
    const l = g.lessons.get(n.lessonId) ?? { title: n.lesson.title, notes: [] };
    l.notes.push(n);
    g.lessons.set(n.lessonId, l);
    groups.set(course.id, g);
  }

  const pageHref = (p: number) => `/notes?${new URLSearchParams({ ...(q ? { q } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 md:px-10 md:py-10">
      <PageHeader title="My notes" subtitle={`${total} note${total === 1 ? "" : "s"}${q ? ` matching “${q}”` : ""}`}>
        <form action="/notes" className="flex w-full gap-2 sm:w-auto">
          <input type="search" name="q" defaultValue={q} placeholder="Search notes or lessons…" className="input sm:w-64" aria-label="Search notes" />
          <button className="btn btn-secondary">Search</button>
        </form>
      </PageHeader>

      {notes.length === 0 ? (
        <EmptyState title={q ? "No notes match your search" : "No notes yet"}>
          {q ? <Link href="/notes" className="text-brand-600 hover:underline">Clear search</Link> : "Open any lesson and click “Add note” while you watch."}
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {[...groups.values()].map((g) => (
            <section key={g.id}>
              <h2 className="mb-3 font-semibold">{g.title}</h2>
              <div className="space-y-4">
                {[...g.lessons.entries()].map(([lessonId, l]) => (
                  <div key={lessonId} className="card">
                    <Link href={`/courses/${g.id}?lesson=${lessonId}`} className="block border-b border-slate-100 px-5 py-3 text-sm font-medium text-slate-900 hover:text-brand-600">
                      {l.title}
                    </Link>
                    <ul className="divide-y divide-slate-100">
                      {l.notes.map((n) => (
                        <li key={n.id} className="px-5 py-3">
                          <Link href={`/courses/${g.id}?lesson=${lessonId}${n.timestampSec !== null ? `&t=${n.timestampSec}` : ""}`}
                            className="group flex gap-3">
                            <span className={`badge h-fit shrink-0 font-mono ${n.timestampSec !== null ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500"}`}>
                              {n.timestampSec !== null ? `▶ ${formatTimestamp(n.timestampSec)}` : "Note"}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="line-clamp-3 text-sm break-words whitespace-pre-wrap text-slate-700 group-hover:text-slate-900">{n.content}</span>
                              <span className="mt-1 block text-xs text-slate-400">Updated {formatDateTime(n.updatedAt)}</span>
                            </span>
                          </Link>
                          <StatefulNoteActionsRow note={{ id: n.id, content: n.content }} initialActions={actions.filter((a) => a.noteId === n.id)} aiEnabled={isAiEnabled()} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {pages > 1 && (
        <nav className="mt-8 flex items-center justify-between text-sm" aria-label="Pagination">
          {page > 1 ? <Link href={pageHref(page - 1)} className="btn btn-secondary btn-sm">← Newer</Link> : <span />}
          <span className="text-slate-500">Page {page} of {pages}</span>
          {page < pages ? <Link href={pageHref(page + 1)} className="btn btn-secondary btn-sm">Older →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}

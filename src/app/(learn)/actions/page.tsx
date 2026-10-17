import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireApproved } from "@/lib/auth";
import { db } from "@/lib/db";
import { startOfToday } from "@/lib/due";
import { ACTION_CARD_SELECT, URGENCY_ORDER, toCardData } from "@/lib/student-actions";
import { ActionCard, NewActionForm } from "@/components/ActionCard";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "My actions" };

const PAGE_SIZE = 50;

const TABS = [
  { key: "outstanding", label: "Outstanding", where: { status: { not: "DONE" } } },
  { key: "todo", label: "To do", where: { status: "TODO" } },
  { key: "in-progress", label: "In progress", where: { status: "IN_PROGRESS" } },
  { key: "completed", label: "Completed", where: { status: "DONE" } },
] as const satisfies readonly { key: string; label: string; where: Prisma.ActionWhereInput }[];

const EMPTY_TEXT: Record<string, string> = {
  outstanding: "Nothing outstanding — nice work. Create an action to plan your next practice session.",
  todo: "No actions waiting to be started.",
  "in-progress": "Nothing in progress. Click “Start” on an action when you begin working on it.",
  completed: "Completed actions will appear here.",
};

export default async function ActionsPage({ searchParams }: { searchParams: Promise<{ tab?: string; page?: string; highlight?: string }> }) {
  const user = await requireApproved();
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab) ?? TABS[0];
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const today = startOfToday();

  const where: Prisma.ActionWhereInput = { userId: user.id, ...tab.where };
  const [rows, total, statusCounts, highlighted] = await Promise.all([
    db.action.findMany({
      where,
      orderBy: tab.key === "completed" ? [{ completedAt: "desc" }, { updatedAt: "desc" }] : URGENCY_ORDER,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: ACTION_CARD_SELECT,
    }),
    db.action.count({ where }),
    db.action.groupBy({ by: ["status"], where: { userId: user.id }, _count: true }),
    sp.highlight ? db.action.findFirst({ where: { id: sp.highlight, userId: user.id }, select: ACTION_CARD_SELECT }) : null,
  ]);
  const countOf = (s: string) => statusCounts.find((c) => c.status === s)?._count ?? 0;
  const tabCount: Record<string, number> = {
    outstanding: countOf("TODO") + countOf("IN_PROGRESS"),
    todo: countOf("TODO"),
    "in-progress": countOf("IN_PROGRESS"),
    completed: countOf("DONE"),
  };
  const overdue = tab.key !== "completed" ? await db.action.count({ where: { userId: user.id, status: { not: "DONE" }, dueDate: { lt: today } } }) : 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cards = rows.map((r) => toCardData(r, today));
  const href = (t: string, p = 1) => `/actions?${new URLSearchParams({ tab: t, ...(p > 1 ? { page: String(p) } : {}) })}`;

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 md:px-10 md:py-10">
      <PageHeader title="My actions" subtitle="Your own practice tasks — plan them, track them, tick them off.">
        <NewActionForm />
      </PageHeader>

      {highlighted && (
        <section className="mb-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-500">Selected action</h2>
            <Link href={href(tab.key)} className="text-xs text-slate-500 hover:text-slate-800">Dismiss</Link>
          </div>
          <ActionCard action={toCardData(highlighted, today)} highlighted />
        </section>
      )}

      <nav className="mb-5 flex gap-1.5 overflow-x-auto pb-1" aria-label="Action status">
        {TABS.map((t) => (
          <Link key={t.key} href={href(t.key)}
            className={`btn btn-sm shrink-0 ${t.key === tab.key ? "bg-slate-900 text-white" : "btn-secondary"}`}>
            {t.label}
            <span className={`rounded-full px-1.5 text-[11px] ${t.key === tab.key ? "bg-white/20" : "bg-slate-100"}`}>{tabCount[t.key]}</span>
          </Link>
        ))}
      </nav>

      {overdue > 0 && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800" role="status">
          {overdue} action{overdue === 1 ? " is" : "s are"} past {overdue === 1 ? "its" : "their"} target date.
        </p>
      )}

      {cards.length === 0 ? (
        <EmptyState title={tab.key === "outstanding" ? "You're all caught up" : `No ${tab.label.toLowerCase()} actions`}>{EMPTY_TEXT[tab.key]}</EmptyState>
      ) : (
        <div className="space-y-3">
          {cards.map((c) => <ActionCard key={c.id} action={c} />)}
        </div>
      )}

      {pages > 1 && (
        <nav className="mt-8 flex items-center justify-between text-sm" aria-label="Pagination">
          {page > 1 ? <Link href={href(tab.key, page - 1)} className="btn btn-secondary btn-sm">← Previous</Link> : <span />}
          <span className="text-slate-500">Page {page} of {pages}</span>
          {page < pages ? <Link href={href(tab.key, page + 1)} className="btn btn-secondary btn-sm">Next →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}

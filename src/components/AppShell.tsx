import Link from "next/link";
import type { CurrentUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { db } from "@/lib/db";
import { startOfToday } from "@/lib/due";
import { Logo, LevelBadge } from "./ui";
import { Icon } from "./icons";
import { Backdrop, CornerBeam, SidebarPeak } from "./art";
import { NavLink } from "./NavLink";
import { SidebarFrame } from "./SidebarFrame";
import { Heartbeat } from "./Heartbeat";

const Counter = ({ n, title }: { n: number; title?: string }) => (
  <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white shadow-[0_0_10px_rgb(0_140_255/0.7)]" title={title}>{n}</span>
);

const SectionLabel = ({ children, first = false }: { children: React.ReactNode; first?: boolean }) => (
  <p className={`px-3 pb-1.5 text-[11px] font-semibold tracking-[0.14em] text-faint uppercase ${first ? "pt-1" : "pt-5"}`}>{children}</p>
);

export async function AppShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  const isAdmin = user.role === "ADMIN";
  const [openActions, overdueActions, quizCount, unreadNotifications] = await Promise.all([
    db.action.count({ where: { userId: user.id, status: { not: "DONE" } } }),
    db.action.count({ where: { userId: user.id, status: { not: "DONE" }, dueDate: { lt: startOfToday() } } }),
    // Admins: quizzes waiting for review. Students: assigned quizzes not yet submitted.
    isAdmin ? db.examAssignment.count({ where: { status: "SUBMITTED" } }) : db.examAssignment.count({ where: { userId: user.id, status: "ASSIGNED" } }),
    isAdmin ? 0 : db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return (
    <div className="min-h-screen md:flex">
      <SidebarFrame brand={<Link href="/" aria-label="Trade With Ray home"><Logo className="h-9 w-auto" priority /></Link>}>
        <div className="relative flex h-full flex-col overflow-hidden border-r border-line bg-sidebar">
          <div className="pointer-events-none absolute -top-24 -left-20 h-64 w-64 rounded-full bg-accent/[0.07] blur-3xl" aria-hidden />

          <div className="relative px-5 pt-6 pb-5">
            <Link href="/" className="inline-block rounded-md" aria-label="Trade With Ray home"><Logo className="h-14 w-auto" priority /></Link>
          </div>

          <nav className="relative z-10 flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Main">
            {isAdmin && (
              <>
                <SectionLabel first>Admin</SectionLabel>
                <NavLink href="/admin/users"><Icon name="users" className="h-[17px] w-[17px]" />Users</NavLink>
                <NavLink href="/admin/courses"><Icon name="book" className="h-[17px] w-[17px]" />Course builder</NavLink>
                <NavLink href="/admin/exams">
                  <Icon name="quiz" className="h-[17px] w-[17px]" />Quizzes
                  {quizCount > 0 && <Counter n={quizCount} title="Awaiting review" />}
                </NavLink>
                <SectionLabel>Learning</SectionLabel>
              </>
            )}
            <NavLink href="/dashboard"><Icon name="home" className="h-[17px] w-[17px]" />{isAdmin ? "Student view" : "My courses"}</NavLink>
            <NavLink href="/notes"><Icon name="notes" className="h-[17px] w-[17px]" />My notes</NavLink>
            <NavLink href="/actions">
              <Icon name="check" className="h-[17px] w-[17px]" />My actions
              {openActions > 0 && <Counter n={openActions} title="Open actions" />}
            </NavLink>
            <NavLink href="/revision"><Icon name="refresh" className="h-[17px] w-[17px]" />Revision</NavLink>
            {!isAdmin && (
              <NavLink href="/quizzes">
                <Icon name="quiz" className="h-[17px] w-[17px]" />My quizzes
                {quizCount > 0 && <Counter n={quizCount} title="Assigned" />}
              </NavLink>
            )}
            {!isAdmin && (
              <NavLink href="/notifications">
                <Icon name="bell" className="h-[17px] w-[17px]" />Notifications
                {unreadNotifications > 0 && <Counter n={unreadNotifications} title="Unread" />}
              </NavLink>
            )}
          </nav>

          <div className="relative border-t border-line/80 p-4">
            <SidebarPeak className="absolute inset-x-0 bottom-full -z-0" />
            <div className="mb-3 flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-linear-to-b from-[#3a9bff] to-[#0a5ee6] text-sm font-bold text-white shadow-[0_0_14px_-2px_rgb(0_140_255/0.8)]" aria-hidden>
                {user.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                <p className="truncate text-xs text-muted">{isAdmin ? "Administrator" : user.email}</p>
              </div>
            </div>
            {!isAdmin && <div className="mb-3"><LevelBadge level={user.proficiencyLevel} /></div>}
            <form action={logout}>
              <button className="btn btn-ghost btn-sm w-full justify-start gap-2.5 text-sm"><Icon name="logout" />Log out</button>
            </form>
          </div>
        </div>
      </SidebarFrame>

      <main className="relative isolate min-w-0 flex-1">
        <Backdrop />
        <CornerBeam />
        {unreadNotifications > 0 && (
          <Link href="/notifications" className="block border-b border-accent/30 bg-brand-50/80 px-5 py-2 text-center text-sm text-brand-900 hover:bg-brand-100 md:px-10">
            You have {unreadNotifications} new notification{unreadNotifications === 1 ? "" : "s"} from your instructor — <span className="font-medium text-cyan underline">read now</span>
          </Link>
        )}
        {overdueActions > 0 && (
          <Link href="/actions" className="block border-b border-red-300/60 bg-red-50/90 px-5 py-2 text-center text-sm text-red-800 hover:bg-red-100 md:px-10">
            You have {overdueActions} overdue action{overdueActions === 1 ? "" : "s"} — <span className="font-medium underline">review them</span>
          </Link>
        )}
        {children}
      </main>
      <Heartbeat unread={unreadNotifications} />
    </div>
  );
}

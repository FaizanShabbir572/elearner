import Link from "next/link";
import type { CurrentUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { Logo, LevelBadge } from "./ui";
import { NavLink } from "./NavLink";
import { Heartbeat } from "./Heartbeat";

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const ICONS = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14ZM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5",
  notes: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8m8 4H8m2-8H8",
  logout:"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9",
};

export function AppShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  const isAdmin = user.role === "ADMIN";
  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 z-20 border-b border-slate-200 bg-white md:h-screen md:w-64 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-5 py-4 md:py-5">
            <Link href="/"><Logo /></Link>
            <form action={logout} className="md:hidden">
              <button className="btn btn-ghost btn-sm">Log out</button>
            </form>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-visible md:pb-0">
            {isAdmin && <p className="hidden px-3 pt-2 pb-1 text-xs font-semibold tracking-wider text-slate-400 uppercase md:block">Admin</p>}
            {isAdmin && <NavLink href="/admin/users"><Icon d={ICONS.users} />Users</NavLink>}
            {isAdmin && <NavLink href="/admin/courses"><Icon d={ICONS.book} />Course builder</NavLink>}
            {isAdmin && <p className="hidden px-3 pt-5 pb-1 text-xs font-semibold tracking-wider text-slate-400 uppercase md:block">Learning</p>}
            <NavLink href="/dashboard"><Icon d={ICONS.home} />{isAdmin ? "Student view" : "My courses"}</NavLink>
            <NavLink href="/notes"><Icon d={ICONS.notes} />My notes</NavLink>
          </nav>
          <div className="hidden border-t border-slate-200 p-4 md:block">
            <div className="mb-3 flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                {user.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
                <p className="truncate text-xs text-slate-500">{isAdmin ? "Administrator" : user.email}</p>
              </div>
            </div>
            {!isAdmin && <div className="mb-3"><LevelBadge level={user.proficiencyLevel} /></div>}
            <form action={logout}>
              <button className="btn btn-ghost btn-sm w-full justify-start"><Icon d={ICONS.logout} />Log out</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
      <Heartbeat />
    </div>
  );
}

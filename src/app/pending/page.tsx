import { redirect } from "next/navigation";
import { requireUser, homeFor } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { LogoBadge } from "@/components/ui";
import { Backdrop, CornerBeam } from "@/components/art";

export const metadata = { title: "Awaiting approval" };
export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const user = await requireUser();
  if (homeFor(user) !== "/pending") redirect(homeFor(user));
  const rejected = user.status === "REJECTED";

  return (
    <div className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      <Backdrop />
      <CornerBeam />
      <div className="mb-6"><LogoBadge className="h-28 w-28" priority /></div>
      <div className="card card-glow w-full max-w-md p-8 text-center">
        <div className={`mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full ${rejected ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}>
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {rejected ? <path d="M18 6 6 18M6 6l12 12" /> : <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}
          </svg>
        </div>
        <h1 className="text-xl font-semibold">{rejected ? "Registration not approved" : "Your account is awaiting approval"}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {rejected
            ? "An administrator has declined this registration. If you think this is a mistake, please contact the site team."
            : <>Thanks for signing up, {user.name}. An administrator will review your account and assign your learning track. We&apos;ll email <strong>{user.email}</strong> as soon as you&apos;re approved.</>}
        </p>
        <div className="mt-7 flex justify-center gap-2">
          {!rejected && <a href="/pending" className="btn btn-secondary">Check again</a>}
          <form action={logout}><button className="btn btn-ghost">Log out</button></form>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { Logo, LogoBadge } from "@/components/ui";
import { Backdrop } from "@/components/art";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user));

  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-hidden">
      <Backdrop className="h-[80vh]" />
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-5 sm:px-6">
        <Logo className="h-10 w-auto sm:h-12" priority />
        <div className="flex gap-2">
          <Link href="/login" className="btn btn-ghost">Log in</Link>
          <Link href="/register" className="btn btn-primary max-sm:hidden">Create account</Link>
        </div>
      </header>
      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
        <LogoBadge className="mb-8 h-32 w-32 sm:h-40 sm:w-40" priority />
        <span className="badge mb-6 bg-brand-50 text-brand-700 ring-1 ring-accent/40">Structured courses · Certificates on completion</span>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Learn at the level that fits you.</h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Every learner is placed on a track by our team, then works through video lessons and reading at their own pace — with a certificate at the finish line.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/register" className="btn btn-primary px-5 py-2.5">Request access</Link>
          <Link href="/login" className="btn btn-secondary px-5 py-2.5">I have an account</Link>
        </div>
      </section>
    </div>
  );
}

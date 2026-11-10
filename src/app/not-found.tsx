import Link from "next/link";
import { LogoBadge } from "@/components/ui";
import { Backdrop, CornerBeam } from "@/components/art";
export default function NotFound() {
  return (
    <div className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 text-center">
      <Backdrop />
      <CornerBeam />
      <LogoBadge className="mb-6 h-24 w-24" />
      <p className="text-sm font-semibold text-brand-600">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-muted">It may have been removed, or you may not have access to it.</p>
      <Link href="/" className="btn btn-primary mt-6">Go home</Link>
    </div>
  );
}

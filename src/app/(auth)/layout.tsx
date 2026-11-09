import Link from "next/link";
import { LogoBadge } from "@/components/ui";
import { Backdrop } from "@/components/art";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      <Backdrop className="h-[70vh]" />
      <Link href="/" className="mb-6 rounded-full" aria-label="Trade With Ray home">
        <LogoBadge className="h-28 w-28 sm:h-32 sm:w-32" priority />
      </Link>
      <div className="card card-glow w-full max-w-sm p-7">{children}</div>
    </div>
  );
}

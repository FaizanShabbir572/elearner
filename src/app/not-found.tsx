import Link from "next/link";
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold text-brand-600">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-slate-500">It may have been removed, or you may not have access to it.</p>
      <Link href="/" className="btn btn-primary mt-6">Go home</Link>
    </div>
  );
}

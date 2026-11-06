import { LEVEL_LABEL } from "@/lib/constants";

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  REJECTED: "bg-red-50 text-red-700 ring-1 ring-red-200",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_STYLE[status] ?? "bg-slate-100 text-slate-600"}`}>{status.charAt(0) + status.slice(1).toLowerCase()}</span>;
}

const LEVEL_STYLE: Record<string, string> = {
  BEGINNER: "bg-sky-50 text-sky-700",
  INTERMEDIATE: "bg-violet-50 text-violet-700",
  ADVANCED: "bg-rose-50 text-rose-700",
};

export function LevelBadge({ level }: { level: string | null }) {
  if (!level) return <span className="text-xs text-slate-400">—</span>;
  return <span className={`badge ${LEVEL_STYLE[level] ?? "bg-slate-100"}`}>{LEVEL_LABEL[level] ?? level}</span>;
}

export function ProgressBar({ percent, className = "" }: { percent: number; className?: string }) {
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-slate-100 ${className}`} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-all ${percent === 100 ? "bg-emerald-500" : "bg-brand-600"}`} style={{ width: `${percent}%` }} />
    </div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <p className="font-medium text-slate-900">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-slate-500">{children}</div>}
    </div>
  );
}

/** Shown in the content area while a page loads; the sidebar stays in place. */
export function PageLoader() {
  return (
    <div className="grid min-h-[60vh] place-items-center" role="status" aria-label="Loading">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600 motion-reduce:animate-none" />
    </div>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight text-slate-900">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5c3 2 9 2 12 0v-5" /></svg>
      </span>
      LearnHub
    </span>
  );
}

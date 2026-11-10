import Image from "next/image";
import { LEVEL_LABEL } from "@/lib/constants";
import { Icon, type IconName } from "./icons";

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  REJECTED: "bg-red-50 text-red-700 ring-1 ring-red-200",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_STYLE[status] ?? "bg-surface-3 text-muted"}`}>{status.charAt(0) + status.slice(1).toLowerCase()}</span>;
}

/** Level pill: the TWR blue pill used on course cards. */
export function LevelBadge({ level }: { level: string | null }) {
  if (!level) return <span className="text-xs text-faint">—</span>;
  return <span className="badge-pill pill-blue">{LEVEL_LABEL[level] ?? level}</span>;
}

export function DraftBadge() {
  return <span className="badge-pill pill-grey">Draft</span>;
}

export function ProgressBar({ percent, className = "" }: { percent: number; className?: string }) {
  const done = percent === 100;
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-[#1a2535] ${className}`} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${done ? "bg-emerald-500 shadow-[0_0_10px_rgb(16_185_129/0.6)]" : "bg-linear-to-r from-[#1c8cff] to-[#0a64f0] shadow-[0_0_10px_rgb(0_140_255/0.8)]"}`}
        style={{ width: `${percent}%` }} />
    </div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="heading-accent text-[1.75rem] leading-tight font-bold tracking-tight sm:text-[2rem]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function SectionTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`heading-accent mb-3 text-[15px] font-bold text-ink ${className}`}>{children}</h2>;
}

/** Plain glowing blue icon on a soft halo, as in the TWR stat cards and panels. */
export function IconTile({ name, size = "md" }: { name: IconName; size?: "sm" | "md" }) {
  const md = size === "md";
  return (
    <span className={`icon-halo ${md ? "h-14 w-14" : "h-10 w-10"}`}>
      <Icon name={name} className={`icon-glow ${md ? "h-9 w-9" : "h-7 w-7"}`} />
    </span>
  );
}

export function StatCard({ icon, value, label, size = "md" }: { icon: IconName; value: React.ReactNode; label: string; size?: "sm" | "md" }) {
  const md = size === "md";
  return (
    <div className={`card card-hover flex items-center ${md ? "card-glow gap-3 px-4 py-4 sm:gap-4 sm:px-5" : "gap-2.5 px-3 py-2.5"}`}>
      <IconTile name={icon} size={md ? "md" : "sm"} />
      <div className="min-w-0">
        <p className={`leading-tight font-bold text-ink ${md ? "text-2xl sm:text-[1.7rem]" : "text-lg"}`}>{value}</p>
        <p className={`text-ink-2 ${md ? "mt-0.5 text-[13px]" : "text-[11.5px] leading-snug"}`}>{label}</p>
      </div>
    </div>
  );
}

export function EmptyState({ title, icon, children }: { title: string; icon?: IconName; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      {icon && <div className="mb-4"><IconTile name={icon} /></div>}
      <p className="font-semibold text-ink">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-muted">{children}</div>}
    </div>
  );
}

/** Shown in the content area while a page loads; the sidebar stays in place. */
export function PageLoader() {
  return (
    <div className="grid min-h-[60vh] place-items-center" role="status" aria-label="Loading">
      <span className="h-9 w-9 animate-spin rounded-full border-2 border-line border-t-[#1e95ff] shadow-[0_0_14px_-2px_rgb(0_140_255/0.7)] motion-reduce:animate-none" />
    </div>
  );
}

/** The official TWR wordmark (cropped from the brand logo, transparent background). */
export function Logo({ className = "h-12 w-auto", priority = false }: { className?: string; priority?: boolean }) {
  return <Image src="/brand/twr-wordmark.png" alt="Trade With Ray" width={440} height={199} priority={priority} unoptimized className={className} />;
}

/** The full circular TWR logo. */
export function LogoBadge({ className = "h-24 w-24", priority = false }: { className?: string; priority?: boolean }) {
  return <Image src="/brand/twr-logo.png" alt="Trade With Ray" width={512} height={512} priority={priority} unoptimized className={className} />;
}

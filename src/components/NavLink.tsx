"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children, exact = false }: { href: string; children: React.ReactNode; exact?: boolean }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium transition-[background-color,border-color,color,box-shadow] duration-150 ${
        active
          ? "border-accent/80 bg-linear-to-r from-accent/55 to-accent/20 text-white shadow-[0_0_18px_-4px_rgb(0_140_255/0.75),inset_0_0_12px_rgb(0_140_255/0.15)] [&_svg]:text-cyan"
          : "border-transparent text-ink-2 hover:border-line hover:bg-surface-2 hover:text-white [&_svg]:text-faint hover:[&_svg]:text-brand-400"
      }`}
    >
      {children}
    </Link>
  );
}

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
      className={`group flex items-center gap-3 rounded-lg border px-3 py-2 text-sm font-medium transition-[background-color,border-color,color,box-shadow] duration-150 ${
        active
          ? "border-[#3d9bff] bg-linear-to-b from-[#1468dc] to-[#0b4cb4] text-white shadow-[0_0_18px_-3px_rgb(0_140_255/0.85),inset_0_1px_0_rgb(255_255_255/0.18)] [&_svg]:text-white"
          : "border-transparent text-ink-2 hover:border-line hover:bg-surface-2 hover:text-white [&_svg]:text-[#9fb2c8] hover:[&_svg]:text-brand-400"
      }`}
    >
      {children}
    </Link>
  );
}

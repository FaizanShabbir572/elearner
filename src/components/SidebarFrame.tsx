"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";

/**
 * Fixed sidebar on desktop; on small screens a top bar with a menu button that slides the same
 * sidebar in as a drawer. Closes on navigation, Escape, or a tap on the backdrop.
 */
export function SidebarFrame({ brand, children }: { brand: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();

  useEffect(() => setOpen(false), [path]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-sidebar/90 px-4 py-2 backdrop-blur md:hidden">
        {brand}
        <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost px-2" aria-label="Open menu" aria-expanded={open} aria-controls="app-sidebar">
          <Icon name="menu" className="h-6 w-6" />
        </button>
      </div>

      {open && <div className="fixed inset-0 z-40 bg-black/65 backdrop-blur-[2px] md:hidden" onClick={() => setOpen(false)} aria-hidden />}

      <aside id="app-sidebar"
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] transition-[transform,visibility] duration-200 md:sticky md:top-0 md:z-20 md:h-screen md:w-60 md:max-w-none md:shrink-0 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full max-md:invisible"
        }`}>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost absolute top-3 right-3 z-10 px-2 md:hidden" aria-label="Close menu">
          <Icon name="close" className="h-5 w-5" />
        </button>
        {children}
      </aside>
    </>
  );
}

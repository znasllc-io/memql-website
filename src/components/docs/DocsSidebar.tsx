"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { NavSection } from "@/lib/docs-nav";

function NavList({
  sections,
  versionLabel,
  onNavigate,
}: {
  sections: NavSection[];
  versionLabel: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label="Documentation" className="flex flex-col gap-7">
      {sections.map((section) => (
        <div key={section.area}>
          <div className="mb-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
            {section.title}
          </div>
          <ul className="flex flex-col gap-0.5 border-l border-border">
            {section.items.map((item) => {
              const href = `/docs/${versionLabel}/${item.slug}`;
              const active = pathname === href;
              return (
                <li key={item.slug}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`-ml-px flex items-center gap-2 border-l-2 py-1.5 pl-4 text-[14px] leading-snug transition-colors ${
                      active
                        ? "border-accent font-medium text-accent"
                        : "border-transparent text-muted hover:border-border-strong hover:text-fg"
                    }`}
                  >
                    <span className="min-w-0 flex-1">{item.title}</span>
                    {item.generated && (
                      <span
                        title="Generated from the engine — not hand-edited"
                        className="shrink-0 rounded-sm border border-border px-1 font-mono text-[9px] uppercase tracking-wider text-dim"
                      >
                        gen
                      </span>
                    )}
                    {item.siteAuthored && (
                      <span
                        title="Written for this site — pending an upstream version"
                        className="shrink-0 rounded-sm border border-amber-500/40 px-1 font-mono text-[9px] uppercase tracking-wider text-amber-500/80"
                      >
                        site
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export default function DocsSidebar({
  sections,
  versionLabel,
}: {
  sections: NavSection[];
  versionLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile drawer on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <>
      {/* desktop rail */}
      <aside className="sticky top-24 hidden h-[calc(100vh-7rem)] w-60 shrink-0 overflow-y-auto pb-12 pr-4 lg:block">
        <NavList sections={sections} versionLabel={versionLabel} />
      </aside>

      {/* mobile trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 left-5 z-40 inline-flex items-center gap-2 rounded-full border border-border bg-bg-elev px-4 py-2.5 font-mono text-[12px] text-fg shadow-lg backdrop-blur-md lg:hidden"
        aria-label="Open documentation menu"
        aria-expanded={open}
      >
        <span aria-hidden="true" className="text-accent">≡</span> docs
      </button>

      {/* mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-bg/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-[82%] max-w-xs overflow-y-auto border-r border-border bg-bg-elev px-6 py-6">
            <div className="mb-6 flex items-center justify-between">
              <span className="font-display text-[18px] tracking-wide text-fg">
                Docs<span className="text-accent">.</span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="font-mono text-[18px] leading-none text-muted hover:text-fg"
              >
                ✕
              </button>
            </div>
            <NavList sections={sections} versionLabel={versionLabel} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

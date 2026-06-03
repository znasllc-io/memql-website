"use client";

import { useEffect, useState } from "react";
import type { TocEntry } from "@/lib/docs-nav";

/**
 * "On this page" rail with scroll-spy. Highlights the heading nearest the top
 * of the viewport. Honors reduced-motion (the browser handles smooth scroll
 * via CSS; we only set the active state here).
 */
export default function TableOfContents({ toc }: { toc: TocEntry[] }) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (toc.length === 0) return;
    const ids = toc.map((t) => t.id);
    const headings = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the topmost heading currently intersecting; fall back to the
        // last one scrolled past.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: [0, 1] }
    );

    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [toc]);

  if (toc.length < 2) return null;

  return (
    <aside className="sticky top-24 hidden h-[calc(100vh-7rem)] w-56 shrink-0 overflow-y-auto pb-12 pl-2 xl:block">
      <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
        On this page
      </div>
      <ul className="flex flex-col gap-1.5 border-l border-border">
        {toc.map((entry) => {
          const active = entry.id === activeId;
          return (
            <li key={entry.id}>
              <a
                href={`#${entry.id}`}
                className={`-ml-px block border-l-2 py-0.5 text-[12.5px] leading-snug transition-colors ${
                  entry.depth === 3 ? "pl-6" : "pl-3"
                } ${
                  active
                    ? "border-accent text-accent"
                    : "border-transparent text-dim hover:text-fg"
                }`}
              >
                {entry.text}
              </a>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

"use client";

import Image from "next/image";
import ThemeToggle from "@/components/ThemeToggle";
import { NeuronLink } from "@/components/Transition";

/**
 * Slim fixed header for the docs section — mirrors the landing nav's frosted
 * pill, but anchored to the docs home, with a link back to the marketing site.
 */
export default function DocsHeader() {
  return (
    <header className="fixed inset-x-0 top-4 z-50 mx-auto flex w-full max-w-[1400px] items-center gap-3 px-5">
      <nav
        aria-label="Docs"
        className="flex flex-1 items-center justify-between rounded-full border border-border bg-bg/70 px-5 py-3 backdrop-blur-md"
      >
        <div className="flex items-center gap-2.5">
          <NeuronLink href="/" aria-label="MemQL — home" className="flex items-center gap-2.5">
            <Image src="/memql-mark.png" alt="" width={28} height={28} priority className="h-7 w-7 object-contain" />
            <span className="font-display text-[20px] leading-none tracking-wide text-fg">
              MemQL<span className="text-accent">.</span>
            </span>
          </NeuronLink>
          <span className="font-mono text-[12px] tracking-wide text-dim">/ docs</span>
        </div>
        <div className="flex items-center gap-5">
          <NeuronLink
            href="/"
            className="hidden font-mono text-[12px] uppercase tracking-wider text-muted transition-colors hover:text-fg sm:inline"
          >
            ← site
          </NeuronLink>
          <a
            href="https://github.com/znasllc-io/MemQL"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[12px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
          >
            github <span aria-hidden="true" className="text-accent">→</span>
          </a>
        </div>
      </nav>
      <ThemeToggle />
    </header>
  );
}

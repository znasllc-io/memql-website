"use client";

import Image from "next/image";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

/**
 * Shared chrome for the standalone SEO/content pages (AI-harness explainer,
 * comparison, glossary). Mirrors the site's frosted-pill nav + footer so these
 * pages feel native, while keeping them server-rendered for crawlers (only
 * this shell is a client component; the page content is passed as children).
 */
export default function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="fixed inset-x-0 top-4 z-50 mx-auto flex w-full max-w-[1180px] items-center gap-3 px-4">
        <nav
          aria-label="Primary"
          className="flex flex-1 items-center justify-between rounded-full border border-border bg-bg/70 px-5 py-3 backdrop-blur-md"
        >
          <Link href="/" aria-label="MemQL — home" className="flex items-center gap-2.5">
            <Image src="/memql-mark.png" alt="" width={28} height={28} priority className="h-7 w-7 object-contain" />
            <span className="font-display text-[20px] leading-none tracking-wide text-fg">
              MemQL<span className="text-accent">.</span>
            </span>
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/docs" className="font-mono text-[12px] uppercase tracking-wider text-muted transition-colors hover:text-fg">
              docs
            </Link>
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

      <main className="mx-auto w-full max-w-[760px] px-6 pt-28 pb-24 sm:px-8">
        {children}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1180px] flex-col items-start justify-between gap-4 px-8 py-10 sm:flex-row sm:items-center">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/memql-mark.png" alt="" width={24} height={24} className="h-6 w-6 object-contain opacity-90" />
            <span className="font-display text-[16px] tracking-wide text-muted">
              MemQL<span className="text-accent">.</span>
            </span>
          </Link>
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
            <Link href="/about" className="transition-colors hover:text-fg">about</Link>
            <Link href="/docs" className="transition-colors hover:text-fg">docs</Link>
            <Link href="/ai-harness" className="transition-colors hover:text-fg">ai harness</Link>
            <Link href="/memql-vs-vector-memory" className="transition-colors hover:text-fg">vs vector memory</Link>
            <Link href="/glossary" className="transition-colors hover:text-fg">glossary</Link>
            <Link href="/privacy" className="transition-colors hover:text-fg">privacy</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}

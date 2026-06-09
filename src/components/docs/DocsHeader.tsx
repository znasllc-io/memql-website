"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { NeuronLink } from "@/components/Transition";

type VersionEntry = { version: string; engineVersion: string };

/**
 * Slim fixed header for the docs section — mirrors the landing nav's frosted
 * pill, with a version dropdown. Switching versions keeps you on the same page
 * slug when it exists in the target snapshot, falling back to that version's
 * index.
 */
export default function DocsHeader({
  versionLabel,
  resolvedVersion,
  versions,
  latest,
}: {
  versionLabel: string;
  resolvedVersion: string;
  versions: VersionEntry[];
  latest: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function switchVersion(next: string) {
    if (next === versionLabel) return;
    // Carry the current slug over: /docs/<label>/<slug...> -> /docs/<next>/<slug...>
    const rest = pathname.replace(/^\/docs\/[^/]+/, "").replace(/^\//, "");
    router.push(rest ? `/docs/${next}/${rest}` : `/docs/${next}`);
  }

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

          {/* version dropdown */}
          <div className="relative ml-1">
            <select
              aria-label="Documentation version"
              value={versionLabel}
              onChange={(e) => switchVersion(e.target.value)}
              className="cursor-pointer appearance-none rounded-full border border-border bg-bg-elev/60 py-1 pl-2.5 pr-6 font-mono text-[11px] text-muted transition-colors hover:border-border-strong hover:text-fg focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="latest">latest ({latest})</option>
              {versions.map((v) => (
                <option key={v.version} value={v.version}>
                  {v.version}
                </option>
              ))}
            </select>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-dim"
            >
              ▼
            </span>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <NeuronLink
            href="/cockpit"
            className="font-mono text-[12px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
          >
            cockpit
          </NeuronLink>
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
            className="hidden font-mono text-[12px] uppercase tracking-wider text-muted transition-colors hover:text-fg sm:inline"
          >
            github <span aria-hidden="true" className="text-accent">→</span>
          </a>
        </div>
      </nav>
      <ThemeToggle />
    </header>
  );
}

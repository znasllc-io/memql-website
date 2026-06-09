import type { Metadata } from "next";
import Image from "next/image";
import CockpitConsole from "@/components/CockpitConsole";
import { MarketingHeader, MarketingFooter } from "@/components/seo/MarketingShell";

export const metadata: Metadata = {
  title: "MemQL Cockpit — terminal IDE & ops console for MemQL clusters",
  description:
    "MemQL Cockpit is a terminal-native IDE and operations console for MemQL clusters — write, lint, and execute DSL, explore cluster state, manage identity and workers, and drive computer-use workers. No web app, no Electron, just gRPC.",
  alternates: { canonical: "/cockpit" },
  openGraph: {
    title: "MemQL Cockpit",
    description: "Terminal-native IDE + ops console for MemQL clusters. No web app. No Electron. Just gRPC.",
    url: "/cockpit",
    type: "article",
  },
};

function Inline({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[0.88em] text-fg-dim">{children}</code>;
}

const TABS: [string, string][] = [
  ["agents", "who's joined — humans, SI, workers"],
  ["auth", "identity · magic-link · JWKS"],
  ["client", "ad-hoc queries + mutations"],
  ["cluster", "topology · build tags · live events"],
  ["config", "clusters.yaml + worker.yaml"],
  ["editor", ".memql with linter feedback"],
  ["explorer", "graph + time-series traversal"],
  ["settings", "keys · telemetry · prefs"],
];

export default function CockpitPage() {
  return (
    <>
      <MarketingHeader />
      <main>
        <section className="cockpit-band relative overflow-hidden border-b border-border">
          <div className="relative mx-auto max-w-[1360px] px-6 pt-28 pb-24 sm:px-8">
            {/* product lockup: MemQL · [mark] · Cockpit. */}
            <div className="mb-14 flex items-center justify-center gap-3 sm:gap-4">
              <span className="font-display text-[34px] leading-none tracking-wide text-fg sm:text-[48px]">
                MemQL
              </span>
              <Image src="/memql-mark.png" alt="" width={60} height={60} priority className="h-[48px] w-[48px] object-contain sm:h-[60px] sm:w-[60px]" />
              <span className="font-display text-[34px] leading-none tracking-wide text-fg sm:text-[48px]">
                Cockpit<span className="text-accent">.</span>
              </span>
            </div>

            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">// cockpit</div>
            <h1 className="mt-5 max-w-[18em] font-serif text-[34px] leading-[1.12] tracking-tight text-fg sm:text-[44px]">
              A TUI that ships with the platform.
            </h1>
            <p className="mt-7 max-w-[46em] text-[18px] leading-[1.6] text-fg-dim">
              A second product, in your terminal. Terminal-native IDE and operations console for MemQL
              clusters &mdash; write, lint, and execute DSL; explore cluster state; manage identity and
              workers; observe the platform in real time. No web app. No Electron. Just gRPC to the cluster.
            </p>

            {/* oversized live console, lifted off the band with an emerald glow */}
            <div className="relative isolate mt-14">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-x-6 -inset-y-10 z-0"
                style={{ background: "radial-gradient(ellipse 58% 72% at 50% 50%, rgba(0,157,113,0.20), transparent 72%)" }}
              />
              <div className="relative z-10">
                <CockpitConsole />
              </div>
            </div>

            {/* eight tabs */}
            <div className="mt-16">
              <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">// eight tabs</div>
              <div className="grid grid-cols-1 gap-x-12 gap-y-3.5 sm:grid-cols-2">
                {TABS.map(([tab, desc]) => (
                  <div key={tab} className="grid grid-cols-[110px_minmax(0,1fr)] items-baseline gap-x-4">
                    <span className="font-mono text-[13px] text-accent">{tab}</span>
                    <span className="font-mono text-[12.5px] text-muted">{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* computer use — install/build detail lives in the cockpit docs */}
            <div className="mt-16">
              <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-accent">// computer use</div>
              <p className="max-w-[46em] text-[16px] leading-[1.65] text-fg">
                Run <Inline>./bin/memql-cockpit worker run</Inline> and your machine joins the cluster as a
                per-user worker &mdash; headless (shell, filesystem, HTTP) or embodied (mouse, keyboard,
                screenshots via RobotGo). The agent doesn&rsquo;t drive a sandbox. It drives your laptop.
              </p>
              <p className="mt-5 max-w-[46em] font-mono text-[13px] leading-[1.6] text-muted">
                <span className="text-accent">// install &amp; build</span> &middot; <Inline>make cockpit</Inline>, the run modes, and platform services are in the docs.{" "}
                <a href="/docs/latest/operate/workers-runbook" className="text-accent underline decoration-accent/30 underline-offset-2 transition-colors hover:decoration-accent">
                  Workers, build &amp; auth &rarr;
                </a>
              </p>
            </div>

            <div className="mt-12">
              <a
                href="https://github.com/znasllc-io/memql-cockpit"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-mono text-[13px] tracking-wide text-accent transition-colors hover:text-fg"
              >
                znasllc-io/memql-cockpit <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}

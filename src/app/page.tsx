"use client";

import Image from "next/image";
import { useState, useRef, useCallback, useEffect } from "react";
import HeroGraph from "@/components/HeroGraph";
import AgentLoopGraph from "@/components/AgentLoopGraph";
import ThemeToggle from "@/components/ThemeToggle";
import DocsFab from "@/components/DocsFab";
import GithubFab from "@/components/GithubFab";
import { NeuronLink } from "@/components/Transition";
import { GH_REPO, GH_STARS } from "@/lib/stars";

// Live star count: baked value as initial state, re-fetched client-side on
// mount. Failures keep the baked value. Consumers gate display on > 0.
function useGitHubStars(): number {
  const [stars, setStars] = useState<number>(GH_STARS);
  useEffect(() => {
    let alive = true;
    fetch(`https://api.github.com/repos/${GH_REPO}`, { headers: { Accept: "application/vnd.github+json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j && typeof j.stargazers_count === "number") setStars(j.stargazers_count);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return stars;
}

function formatStars(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

/* ───────────────────────────── page ───────────────────────────── */

export default function Home() {
  return (
    <>
      <Nav />
      <main className="relative">
        <Hero />
        <StackStrip />
        <Harness />
        <CoPresent />
        <ForWhom />
        <Close />
        <Footer />
      </main>
      <DocsFab />
      <GithubFab />
    </>
  );
}

/* ───────────────────────────── nav ───────────────────────────── */

// In-page section nav (centered in the bar). Docs is a route; the rest are
// anchors to the landing's sections.
const NAV_SECTIONS: { href: string; label: string; route?: boolean }[] = [
  { href: "/docs", label: "Docs", route: true },
  { href: "#harness", label: "Harness" },
  { href: "#copresent", label: "CoPresent" },
  { href: "#who", label: "Who it's for" },
  { href: "#project", label: "Project" },
];

function Nav() {
  return (
    <header className="fixed inset-x-0 top-4 z-50 mx-auto flex w-full max-w-[1180px] items-center gap-3 px-4">
      <nav aria-label="Primary" className="relative flex flex-1 items-center justify-between rounded-full border border-border bg-bg/70 px-5 py-3 backdrop-blur-md">
        {/* left: home lockup */}
        <a href="#top" aria-label="MemQL — home" className="flex items-center gap-2.5">
          <Image src="/memql-mark.png" alt="" width={30} height={30} priority className="h-[30px] w-[30px] object-contain" />
          <span className="font-display text-[21px] leading-none tracking-wide text-fg">
            MemQL<span className="text-accent">.</span>
          </span>
        </a>

        {/* center: in-page section navigation */}
        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-5 lg:flex">
          {NAV_SECTIONS.map((s) =>
            s.route ? (
              <NeuronLink
                key={s.href}
                href={s.href}
                className="font-mono text-[12px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
              >
                {s.label}
              </NeuronLink>
            ) : (
              <a
                key={s.href}
                href={s.href}
                className="font-mono text-[12px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
              >
                {s.label}
              </a>
            ),
          )}
        </div>

        {/* right: Cockpit brand lockup -> dedicated page */}
        <NeuronLink
          href="/cockpit"
          aria-label="MemQL Cockpit"
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <span className="font-display text-[18px] leading-none tracking-wide text-fg">
            Cockpit<span className="text-accent">.</span>
          </span>
          <Image src="/memql-mark.png" alt="" width={22} height={22} className="h-[22px] w-[22px] object-contain" />
        </NeuronLink>
      </nav>
      {/* theme toggle sits OUTSIDE the nav oval as its own control */}
      <ThemeToggle />
    </header>
  );
}

/* ───────────────────────────── hero ───────────────────────────── */

function Hero() {
  // The harness's job, in four lines — the proof panel that replaces the old
  // MQL code window (syntax now lives in the docs, not the landing).
  const does = [
    ["the agent loop", "A terminating tool-calling loop, run as a service — not your for-loop."],
    ["cost & safety spine", "Rate ceiling, per-plan budgets, and loop breakers. On by default."],
    ["memory substrate", "An append-only time-series graph. Recall blends recency and relevance."],
    ["multi-node & observable", "One Go source tree compiles into a secured, traced node mesh."],
  ];
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="hero-glow" />
      <HeroGraph />
      <div className="relative z-10 mx-auto grid max-w-[1180px] grid-cols-1 gap-12 px-8 pt-36 pb-32 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16">
        <div>
          <Eyebrow>// the go-to golang llm harness</Eyebrow>
          <h1 className="mt-6 font-serif text-[44px] leading-[1.08] tracking-tight text-fg sm:text-[56px] lg:text-[60px]">
            The agent runtime, not the parts to build one.
          </h1>
          <p className="mt-7 max-w-[34em] text-[18px] leading-[1.6] text-fg-dim">
            memQL is a Go harness and memory substrate that{" "}
            <em className="not-italic text-fg">runs</em>{" "}the agent loop, enforces a
            cost-and-safety spine, and remembers across restarts. Other frameworks hand you pieces to
            assemble a runtime &mdash; memQL is the runtime. Ship better AI, faster.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <NeuronLink
              href="/docs/latest/getting-started"
              className="inline-flex items-center gap-2 rounded-full bg-accent-bright px-5 py-2.5 font-mono text-[13px] tracking-wide text-bg transition-colors hover:bg-accent"
            >
              Get started <span aria-hidden="true">→</span>
            </NeuronLink>
            <GithubMenu label="browse source" variant="cta" align="left" />
          </div>
          <div className="mt-5 font-mono text-[12px] tracking-wider text-dim uppercase">
            open source · apache 2.0 · alpha
          </div>
        </div>

        {/* proof panel — what the harness handles, no syntax */}
        <div className="rounded-lg border border-border bg-bg-elev/60 p-1.5 backdrop-blur-sm">
          <div className="rounded-md border border-border/60 bg-bg-panel/60 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
            // what the harness handles
          </div>
          <ul className="divide-y divide-border">
            {does.map(([title, body]) => (
              <li key={title} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:gap-5">
                <span className="shrink-0 font-mono text-[12px] tracking-wide text-accent sm:w-44">
                  {title}
                </span>
                <span className="text-[14px] leading-[1.5] text-fg-dim">{body}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── stack strip ───────────────────────── */

function StackStrip() {
  const builtOn = ["Go", "PostgreSQL", "TimescaleDB", "Anthropic", "OpenAI", "Gemini", "Mistral", "Groq", "Deepgram"];
  const inTheBox = ["agent loop", "memory", "cost + safety", "tools", "voice", "computer use", "cockpit", "mcp", "cluster"];
  const stars = useGitHubStars();
  const creds = ["Apache 2.0", "Alpha", "self-hostable", "MCP-native"];
  return (
    <section className="border-y border-border bg-bg-panel">
      <div className="mx-auto max-w-[1180px] px-8">
        {/* proof row — honest, verifiable credentials in the first scroll */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border py-4">
          {creds.map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5 font-mono text-[12px] tracking-wide text-fg-dim">
              <span aria-hidden="true" className="text-accent">›</span> {c}
            </span>
          ))}
          {stars > 0 && (
            <a
              href={`https://github.com/${GH_REPO}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1.5 font-mono text-[12px] tracking-wide text-fg-dim hover:text-fg transition-colors"
            >
              <span aria-hidden="true" className="text-accent">★</span> {formatStars(stars)} on GitHub
            </a>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-border py-5">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-dim">
            built on
          </span>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            {builtOn.map((t) => (
              <span key={t} className="font-mono text-[13px] tracking-wide text-muted">
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-5">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
            in the box
          </span>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            {inTheBox.map((t) => (
              <span key={t} className="font-mono text-[13px] tracking-wide text-fg">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── the harness ───────────────────────── */

function Harness() {
  // phases driven by the loop graph: 1 agent loop · 2 cost+safety · 3 memory
  const [phase, setPhase] = useState(0);
  const onPhase = useCallback((p: number) => setPhase(p), []);

  const cols: { label: string; body: React.ReactNode }[] = [
    {
      label: "// the agent loop",
      body: (
        <>
          The turn loop, tool dispatch, and reply contract are part of the engine. An agent ends every
          turn through one structured envelope, and client tools relay across nodes. You declare the
          tools and the reply shape &mdash; not the <Inline>for</Inline> loop.
        </>
      ),
    },
    {
      label: "// cost & safety spine",
      body: (
        <>
          On by default: a process-wide LLM rate ceiling, per-plan token budgets enforced <em className="not-italic text-fg">before</em> each
          call, and loop breakers that stop the apologize-and-retry-forever failure. Expensive plans
          park for approval before they spend.
        </>
      ),
    },
    {
      label: "// memory substrate",
      body: (
        <>
          An append-only time-series graph keyed by <Inline>(partition, id, createdAt)</Inline>. Provenance
          and replay are free; <Inline>recall()</Inline> blends semantic similarity with recency, and
          episodic rows consolidate into durable semantic knowledge.
        </>
      ),
    },
  ];
  return (
    <Section eyebrow="the harness" index="01" id="harness">
      <Headline>What a production agent actually needs.</Headline>
      <Lede className="max-w-[44em]">
        An agent in a demo is a <Inline>while</Inline> loop around one model call. In production it has
        to terminate for the right reason, remember across restarts, and not bankrupt you when a model
        gets stuck repeating itself. memQL makes those the substrate.
      </Lede>
      <p className="mt-7 max-w-[44em] font-mono text-[13px] leading-[1.6] text-muted">
        A plan fans into steps, each step leaves an observation, recall pulls the relevant ones back, and
        the whole run replays. Watch.
      </p>

      <Reveal delay={120} className="mt-10 overflow-hidden rounded-lg border border-border bg-bg-elev/40">
        <AgentLoopGraph onPhase={onPhase} />
      </Reveal>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-3 lg:gap-12">
        {cols.map((c, i) => {
          const lit = phase >= i + 1;
          return (
            <div
              key={c.label}
              className={`border-l-2 pl-5 transition-all duration-500 ${
                lit ? "border-accent" : "border-border"
              }`}
            >
              <h3
                className={`mb-3 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors duration-500 ${
                  lit ? "text-accent" : "text-dim"
                }`}
              >
                {c.label}
              </h3>
              <p
                className={`text-[16px] leading-[1.65] transition-colors duration-500 ${
                  lit ? "text-fg" : "text-muted"
                }`}
              >
                {c.body}
              </p>
            </div>
          );
        })}
      </div>

      <p className="mt-12 max-w-[44em] font-mono text-[13px] leading-[1.6] text-muted">
        <span className="text-accent">// the proof</span> &middot; every claim above points at the code.{" "}
        <a href="/docs/latest/overview/why-memql-harness" className="text-accent underline decoration-accent/30 underline-offset-2 transition-colors hover:decoration-accent">
          Why memQL is a harness &rarr;
        </a>
      </p>
      <p className="mt-6 max-w-[44em] font-mono text-[13px] leading-[1.6] text-muted">
        <span className="text-accent">// the field</span> &middot; the others give you the pieces to build an
        agent runtime; memQL is the agent runtime.{" "}
        <a href="/docs/latest/overview/vs-other-harnesses" className="text-accent underline decoration-accent/30 underline-offset-2 transition-colors hover:decoration-accent">
          memQL vs. other harnesses &rarr;
        </a>
      </p>
    </Section>
  );
}

/* ───────────────────────── copresent ───────────────────────── */

function CoPresent() {
  const tags = ["real-time voice", "video avatars", "shared canvas", "multi-agent", "releasing soon"];
  return (
    <Section eyebrow="living proof" index="02" id="copresent" grid>
      <Headline>It&rsquo;s real: CoPresent runs on it.</Headline>
      <Lede className="max-w-[46em]">
        Visionarys is building <span className="text-fg">CoPresent</span>{" "}&mdash; a multi-agent product
        with real-time voice, video avatars, and a shared canvas &mdash; on memQL right now, on the path
        to release. The breakers, the budgets, the memory consolidation, and the cross-node tool relay
        exist because a shipping product needs them. memQL is the extracted, open-source harness
        underneath.
      </Lede>

      <Reveal delay={120} className="mt-10 flex flex-wrap gap-2.5">
        {tags.map((t) => (
          <span
            key={t}
            className="rounded-md border border-border bg-bg-elev/40 px-3.5 py-1.5 font-mono text-[12.5px] text-fg-dim"
          >
            {t}
          </span>
        ))}
      </Reveal>

      <p className="mt-8 max-w-[46em] text-[16px] leading-[1.7] text-fg-dim">
        The strongest proof that this is a harness and not a slide deck is a product depending on it in
        production. CoPresent is that product.
      </p>
    </Section>
  );
}

/* ───────────────────────── for whom ───────────────────────── */

function ForWhom() {
  const items = [
    {
      label: "// the agent product builder",
      body: "You're shipping a product where memory and reliability matter. You've outgrown stuffing context into prompts, and outgrown a vector DB next to a Postgres next to a custom event bus. memQL is the runtime you'd build if you had a year.",
    },
    {
      label: "// the Go platform engineer",
      body: "You want a Go-native agent runtime, not a Python stack to operate. memQL is one substrate: the loop, the memory, the cost guardrails, the node mesh, and the identity layer — already built, not assembled.",
    },
    {
      label: "// the agentic-os curious",
      body: "The next interesting layer of infrastructure is the one between models and applications. memQL is what that layer looks like when it actually runs.",
    },
  ];
  return (
    <Section eyebrow="who it's for" index="03" id="who">
      <Headline>Three readers.</Headline>
      <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-3">
        {items.map((it, i) => (
          <Reveal key={it.label} delay={i * 90}>
            <Label tone="accent" as="h3">{it.label}</Label>
            <p className="text-[16px] leading-[1.65] text-fg">{it.body}</p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ───────────────────────── close ───────────────────────── */

function Close() {
  return (
    <section id="project" className="relative scroll-mt-24 overflow-hidden border-t border-border">
      <div className="hero-glow" />
      <div className="relative mx-auto max-w-[760px] px-8 py-32 text-center">
        <Eyebrow center index="04">the project</Eyebrow>
        <p className="mx-auto mt-8 max-w-[32em] font-serif text-[24px] leading-[1.45] text-fg sm:text-[28px]">
          memQL and the Cockpit are open source, Apache 2.0. Alpha.
        </p>
        <p className="mx-auto mt-9 max-w-[34em] font-mono text-[12.5px] leading-[1.65] text-muted">
          The go-to Golang LLM harness &mdash; the runtime, the memory, and the safety spine your agents
          run on.
        </p>
        <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
          <NeuronLink
            href="/docs/latest/getting-started"
            className="inline-flex items-center gap-2 rounded-full bg-accent-bright px-5 py-2.5 font-mono text-[13px] tracking-wide text-bg transition-colors hover:bg-accent"
          >
            Get started <span aria-hidden="true">→</span>
          </NeuronLink>
          <GithubMenu label="view on github" variant="cta" align="center" />
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── footer ───────────────────────── */

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[1180px] flex-col items-start justify-between gap-4 px-8 py-10 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2.5">
          <Image src="/memql-mark.png" alt="" width={24} height={24} className="h-6 w-6 object-contain opacity-90" />
          <span className="font-display text-[16px] tracking-wide text-muted">
            MemQL<span className="text-accent">.</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <NeuronLink href="/about" className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg">
            about
          </NeuronLink>
          <NeuronLink href="/docs" className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg">
            docs
          </NeuronLink>
          <NeuronLink href="/cockpit" className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg">
            cockpit
          </NeuronLink>
          <NeuronLink href="/ai-harness" className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg">
            ai harness
          </NeuronLink>
          <NeuronLink href="/memql-vs-vector-memory" className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg">
            vs vector memory
          </NeuronLink>
          <NeuronLink href="/glossary" className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg">
            glossary
          </NeuronLink>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-dim">
            prototype · {new Date().getFullYear()}
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ───────────────────────── primitives ───────────────────────── */

function Section({
  eyebrow,
  id,
  index,
  grid = false,
  children,
}: {
  eyebrow: string;
  id?: string;
  index?: string;
  grid?: boolean;
  children: React.ReactNode;
}) {
  const labelId = `section-eyebrow-${id ?? eyebrow.replace(/[^a-z0-9]/gi, "-")}`;
  return (
    <section id={id} aria-labelledby={labelId} className="relative scroll-mt-24 border-t border-border">
      {grid && <div aria-hidden="true" className="bg-grid pointer-events-none absolute inset-0" />}
      <div className="relative mx-auto max-w-[1180px] px-8 py-28">
        <Eyebrow id={labelId} index={index}>{eyebrow}</Eyebrow>
        <div className="mt-6">{children}</div>
      </div>
    </section>
  );
}

function GithubMenu({
  label = "github",
  variant = "nav",
  align = "left",
}: {
  label?: string;
  variant?: "nav" | "cta";
  align?: "left" | "right" | "center";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const item0Ref = useRef<HTMLAnchorElement>(null);
  const item1Ref = useRef<HTMLAnchorElement>(null);

  // Move focus into the menu on open; return to trigger on close.
  useEffect(() => {
    if (open) {
      item0Ref.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setOpen(false);
      triggerRef.current?.focus();
    };
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const onItemKey = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const target = idx === 0 ? item1Ref : item0Ref;
      target.current?.focus();
    }
    if (e.key === "Home") {
      e.preventDefault();
      item0Ref.current?.focus();
    }
    if (e.key === "End") {
      e.preventDefault();
      item1Ref.current?.focus();
    }
    if (e.key === "Tab") {
      // Let Tab leave the menu naturally; close it on the way out.
      setOpen(false);
    }
  };

  const onTriggerKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!open) setOpen(true);
      else item0Ref.current?.focus();
    }
  };

  const triggerClass =
    variant === "nav"
      ? "font-mono text-[12px] tracking-wider uppercase text-muted outline-none transition-colors hover:text-fg focus-visible:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded"
      : "inline-flex items-center gap-2 font-mono text-[13px] tracking-wide text-accent outline-none transition-colors hover:text-fg focus-visible:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded";

  return (
    <div ref={ref} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKey}
        className={triggerClass}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label}: choose a repository`}
      >
        {label}{" "}
        <span aria-hidden="true" className={variant === "nav" ? "text-accent" : ""}>
          {open ? "↓" : "→"}
        </span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="MemQL repositories"
          className={`absolute z-50 top-full mt-2 min-w-[220px] overflow-hidden rounded-md border border-border bg-bg-elev shadow-2xl ${
            align === "right"
              ? "right-0"
              : align === "center"
                ? "left-1/2 -translate-x-1/2"
                : "left-0"
          }`}
        >
          <a
            ref={item0Ref}
            href="https://github.com/znasllc-io/MemQL"
            target="_blank"
            rel="noopener noreferrer"
            className="block px-4 py-3 outline-none transition-colors hover:bg-accent-soft focus-visible:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset group"
            role="menuitem"
            onKeyDown={(e) => onItemKey(e, 0)}
          >
            <div className="font-mono text-[13px] text-fg group-hover:text-accent group-focus-visible:text-accent">
              <span aria-hidden="true" className="text-muted group-hover:text-accent group-focus-visible:text-accent">▸</span> memql
            </div>
            <div className="ml-4 mt-0.5 font-mono text-[11px] text-dim">core engine</div>
          </a>
          <a
            ref={item1Ref}
            href="https://github.com/znasllc-io/memql-cockpit"
            target="_blank"
            rel="noopener noreferrer"
            className="block border-t border-border px-4 py-3 outline-none transition-colors hover:bg-accent-soft focus-visible:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset group"
            role="menuitem"
            onKeyDown={(e) => onItemKey(e, 1)}
          >
            <div className="font-mono text-[13px] text-fg group-hover:text-accent group-focus-visible:text-accent">
              <span aria-hidden="true" className="text-muted group-hover:text-accent group-focus-visible:text-accent">▸</span> memql-cockpit
            </div>
            <div className="ml-4 mt-0.5 font-mono text-[11px] text-dim">tui ide + ops console</div>
          </a>
        </div>
      )}
    </div>
  );
}

function Eyebrow({ children, center = false, id, index }: { children: React.ReactNode; center?: boolean; id?: string; index?: string }) {
  return (
    <div id={id} className={`font-mono text-[11px] uppercase tracking-[0.22em] text-accent ${center ? "text-center" : ""}`}>
      {index && <span className="text-dim">{index} / 04&nbsp;&nbsp;</span>}
      {children}
    </div>
  );
}

function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "h2" | "p";
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={`reveal ${shown ? "reveal-in" : ""} ${className}`}
    >
      {children}
    </Tag>
  );
}

function Headline({ children }: { children: React.ReactNode }) {
  return (
    <Reveal as="h2" className="mt-5 max-w-[18em] font-serif text-[36px] leading-[1.12] tracking-tight text-fg sm:text-[44px]">
      {children}
    </Reveal>
  );
}

function Lede({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <Reveal as="p" delay={70} className={`mt-7 text-[18px] leading-[1.6] text-fg-dim ${className}`}>
      {children}
    </Reveal>
  );
}

function Inline({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[0.88em] text-fg-dim">{children}</code>;
}

function Label({
  children,
  tone = "muted",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  tone?: "muted" | "accent" | "dim";
  as?: "div" | "h3" | "h4";
}) {
  const cls = tone === "accent" ? "text-accent" : tone === "dim" ? "text-dim" : "text-muted";
  return (
    <Tag className={`mb-3 font-mono text-[11px] uppercase tracking-[0.18em] ${cls}`}>{children}</Tag>
  );
}

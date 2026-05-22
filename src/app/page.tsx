"use client";

import Image from "next/image";
import { memo, useState, useRef, useCallback, useEffect, useMemo } from "react";

/* ───────────────────────────── data ───────────────────────────── */

const AUTOMATION_MEMQL = `@enabled
@trigger(event="node.created", concept="v1:cognition:space", partition="*")
@filter(payload.active==true)
@description("On space creation, joins the creator's general assistant plus any specialist agents picked at creation time.")
@useLogic(logicAutoJoinSI)
automation autoJoinSI {
  step run {
    logic autoJoinSI { event: event }
  }
}`;

const CONCEPT_MEMQL = `@description("A streaming text chunk emitted incrementally during AI response generation.")
concept chunk {
  done           bool    @required
  index          int     @required
  participantId  string  @required
  replyId        string  @required
  spaceId        string  @required
  text           string  @required

  @relationship(type="parent",    field="spaceId",       target="v1:cognition:space")
  @relationship(type="createdBy", field="participantId", target="v1:cognition:participant")
}`;

const QUERY_MEMQL = `@enabled
@useConcept(participant)
@description("Get active human participants in a space")
query queryActiveHumanParticipants {
  args {
    spaceId  string  @required
  }
  filter  participant.spaceId==args.spaceId
        ; participant.participantType=="human"
        ; participant.status=="active"
        ; traitIsActiveRecord
  shape   participantFull
}`;

const MUTATION_MEMQL = `@enabled
@useConcept(participant)
@description("Add the caller's agent to a space's roster.")
mutation mutationAddAgentToSpace {
  args {
    spaceId      string  @required
    agentId      string  @required
    displayName  string  @required
  }
  insert participant {
    id: concat("si-", hash(concat(
      canonicalId(args.agentId, "v1:copresent:agent"), ":",
      canonicalId(args.spaceId, "v1:cognition:space")
    )))
    args.spaceId
    args.agentId
    args.displayName
    participantType: "si"
    status: "active"
    joinedAt: timestamp()
  }
}`;

const PROMPT_MEMQL = `@defaultProvider("chat54Mini")
@templateFile("prompts/cognitionMisrouteCheck.tmpl")
@description("Classifies whether a message belongs in the tab the user is composing in (Group vs Team).")
prompt cognitionMisrouteCheck {
  currentTab     string    @required @description("'group' or 'private'")
  message        string    @required @description("The text the user is about to send")
  spaceContext   object              @description("Space title, purpose, status")
  participants   []object            @description("Active humans + agents in the space")
  recentGroup    []object            @description("Last few group-thread utterances")
  recentPrivate  []object            @description("Last few private-thread utterances")
}`;

const PROVIDER_MEMQL = `@description("OpenAI GPT-5.4 Mini — balanced cost/latency chat")
@extends("openai")
@model("gpt-5.4-mini")
provider chat54Mini {
  params {
    contextWindow        128000
    maxCompletionTokens  16384
    inputCostPerMillion  0.15
    outputCostPerMillion 0.60
  }
}`;

const TOOL_MEMQL = `@enabled
@handler(type="function", name="mutationCreateCanvasState")
@executionTime("fast")
@description("Publish a state to the active space's canvas timeline.")
tool canvasPublish {
  space       string  @required @description("Target space id")
  kind        string  @required @enum("card", "document", "dataview", "graph")
  data        object  @required @description("Per-kind payload shape")
  actor       object  @required @description("{kind, agentId} of the calling agent")
  importance  string           @enum("ambient", "notify") @default("ambient")
  note        string           @description("Optional freeform line, 240 chars max")
}`;

const POLICY_MEMQL = `@primary("streamClaudeSonnet")
@fallback("stream54Pro")
@fallback("streamGeminiPro")
@maxLatencyMs(60000)
@preferredRole("general_assistant")
@description("Default chat policy — Claude Sonnet 4.6 primary, GPT-5.4 Pro fallback, Gemini Pro tertiary.")
policy balancedChat { }`;

const DUCT_TAPE_PY = `# on_space_created.py — today
from postgres import db
from pinecone import vec
from kafka import bus
from openai import OpenAI

oai = OpenAI()

def on_space_created(payload):
    if not payload["active"]:
        return
    space_id = payload["id"]
    user_id  = payload["created_by"]
    # join the user's default assistant
    si = db.assistants.default_for(user_id)
    db.memberships.insert(
        space_id=space_id,
        member_id=si.id,
        role="assistant",
    )
    # ...specialist joins, audit emit, retries, idempotency,
    # partition isolation, provider fallback — still TODO`;

type ConstructName =
  | "concept" | "query" | "mutation" | "automation"
  | "prompt"  | "provider" | "tool" | "policy";

type Construct = {
  name: ConstructName;
  blurb: string;
  file: string;
  code: string;
};

const CONSTRUCTS: Construct[] = [
  { name: "concept",    blurb: "Schema. Versioned. Time-series row.",       file: "dsl/cognition/concepts.memql",    code: CONCEPT_MEMQL },
  { name: "query",      blurb: "Read. Typed, filtered, shaped.",            file: "dsl/cognition/queries.memql",     code: QUERY_MEMQL },
  { name: "mutation",   blurb: "Write. Atomic. Event-emitting.",            file: "dsl/cognition/mutations.memql",   code: MUTATION_MEMQL },
  { name: "automation", blurb: "React. Subscribe to typed events.",         file: "dsl/cognition/automations.memql", code: AUTOMATION_MEMQL },
  { name: "prompt",     blurb: "LLM input. Versioned, provider-routed.",    file: "dsl/cognition/prompts.memql",     code: PROMPT_MEMQL },
  { name: "provider",   blurb: "Vendor + model. Cost-tagged.",              file: "dsl/providers/providers.memql",   code: PROVIDER_MEMQL },
  { name: "tool",       blurb: "Capability. Scoped, agent-callable.",       file: "dsl/copresent/tools.memql",       code: TOOL_MEMQL },
  { name: "policy",     blurb: "Cross-cutting. Defaults, fallbacks.",       file: "dsl/policies/policies.memql",     code: POLICY_MEMQL },
];

/* ───────────────────────────── page ───────────────────────────── */

export default function Home() {
  return (
    <>
      <Nav />
      <main className="relative">
        <Hero />
        <StackStrip />
        <What />
        <How />
        <Compare />
        <Language />
        <Cockpit />
        <ForWhom />
        <Close />
        <Footer />
      </main>
    </>
  );
}

/* ───────────────────────────── nav ───────────────────────────── */

function Nav() {
  return (
    <header className="sticky top-4 z-50 mx-auto w-full max-w-[1180px] px-4">
      <nav aria-label="Primary" className="flex items-center justify-between rounded-full border border-border bg-bg/70 px-5 py-3 backdrop-blur-md">
        <a href="#top" className="flex items-center gap-2.5">
          <Image src="/icon.png" alt="" width={26} height={26} priority className="h-[26px] w-[26px]" />
          <span className="font-mono text-[14px] tracking-wide text-fg">
            MemQL<span className="text-accent">.</span>
          </span>
        </a>
        <GithubMenu align="right" variant="nav" />
      </nav>
    </header>
  );
}

/* ───────────────────────────── hero ───────────────────────────── */

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="hero-glow" />
      <div className="relative mx-auto grid max-w-[1180px] grid-cols-1 gap-12 px-8 pt-28 pb-32 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16">
        <div>
          <Eyebrow>// alpha · apache 2.0 · breaking changes expected</Eyebrow>
          <h1 className="mt-6 font-serif text-[44px] leading-[1.08] tracking-tight text-fg sm:text-[56px] lg:text-[60px]">
            An AI-native memory graph with a single DSL.
          </h1>
          <p className="mt-7 max-w-[34em] text-[18px] leading-[1.6] text-fg-dim">
            Time-series memory. Event-driven by default. Multi-tenant by partition. A DSL where you describe behavior; an engine that handles the rest.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-6">
            <GithubMenu label="view on github" variant="cta" align="left" />
            <span className="font-mono text-[12px] tracking-wider text-dim uppercase">
              no demo · no waitlist · apache 2.0
            </span>
          </div>
        </div>
        <CodeWindow filename="dsl/cognition/automations.memql">
          <CodeBlock code={AUTOMATION_MEMQL} lang="memql" startLine={1} />
        </CodeWindow>
      </div>
    </section>
  );
}

/* ───────────────────────── stack strip ───────────────────────── */

function StackStrip() {
  const builtOn = ["PostgreSQL", "TimescaleDB", "Go", "Anthropic", "OpenAI", "Gemini", "Mistral", "Groq", "Deepgram"];
  const inTheBox = ["dsl", "voice", "computer use", "cockpit", "mcp", "cluster"];
  return (
    <section className="border-y border-border bg-bg-panel">
      <div className="mx-auto max-w-[1180px] px-8">
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

/* ───────────────────────── what / how ───────────────────────── */

function What() {
  return (
    <Section eyebrow="what">
      <Headline>What MemQL actually is.</Headline>
      <Lede className="max-w-[44em]">
        Agent and voice deployments are integration-heavy. The engineering is mostly plumbing &mdash; vector store, orchestrator, tool registry, model provider, kept consistent by hand. MemQL collapses that plumbing into one declarative substrate on top of PostgreSQL and TimescaleDB.
      </Lede>
      <div className="mt-14 grid grid-cols-1 gap-10 lg:grid-cols-3 lg:gap-12">
        <div>
          <Label tone="accent" as="h3">// time-series</Label>
          <p className="text-[16px] leading-[1.65] text-fg">
            Because agents have memory. TimescaleDB hypertables underneath. Every row keyed by <Inline>(partition, id, createdAt)</Inline> &mdash; history is a first-class index, not a log file.
          </p>
        </div>
        <div>
          <Label tone="accent" as="h3">// event-driven</Label>
          <p className="text-[16px] leading-[1.65] text-fg">
            Because agents react. Every mutation emits <Inline>node.created</Inline> or <Inline>node.updated</Inline>. Automations subscribe via <Inline>@trigger</Inline>. No polling, no glue, no message bus to operate.
          </p>
        </div>
        <div>
          <Label tone="accent" as="h3">// multi-tenant</Label>
          <p className="text-[16px] leading-[1.65] text-fg">
            Because each customer is their own world. Partition-isolated storage at the row level. Cluster-wide concepts (identity, topology) live in <Inline>_system</Inline>.
          </p>
        </div>
      </div>
      <p className="mt-14 max-w-[44em] font-mono text-[13px] leading-[1.6] text-muted">
        <span className="text-accent">// mcp</span> &middot; Author tools in MemQL once. They speak MCP &mdash; every tool is reachable by any MCP client.
      </p>
    </Section>
  );
}

function How() {
  const nodes: [string, string, string][] = [
    ["bff",       "frontend backend",   "HTTP surface for the apps."],
    ["voice",     "audio transport",    "Realtime media for spoken sessions."],
    ["cognition", "routing / conductor", "Routes events to logic and LLMs."],
    ["agent",     "tool execution",     "Calls tools, writes results back."],
    ["planner",   "orchestration",      "Multi-step task graphs across agents."],
  ];
  return (
    <Section eyebrow="architecture">
      <Headline>Three layers. One source tree.</Headline>
      <Lede className="max-w-[44em]">
        Plain-text DSL on top, a single Go source tree in the middle, partition-isolated time-series storage underneath. Build tags decide which binary each node becomes.
      </Lede>
      <div className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-16">
        <div>
          <Label as="h3">// layers</Label>
          <pre className="mt-1 overflow-x-auto whitespace-pre font-mono text-[13px] leading-[1.85] text-muted">
{`  `}<span className="text-fg">.memql files</span>{`                authored as plain text
        `}<span className="text-accent">↓</span>{`
  `}<span className="text-fg">MemQL engine + SI router</span>{`    one Go source tree,
        `}<span className="text-accent">↓</span>{`                  build tags per node type
  `}<span className="text-fg">PostgreSQL + TimescaleDB</span>{`    partition-isolated
                              time-series storage`}
          </pre>
        </div>
        <div>
          <Label as="h3">// five node binaries</Label>
          <ul className="mt-1 space-y-3.5">
            {nodes.map(([name, role, note]) => (
              <li key={name} className="grid grid-cols-[110px_minmax(0,1fr)] items-baseline gap-x-4">
                <span className="font-mono text-[13px] text-accent">{name}</span>
                <div>
                  <span className="font-mono text-[12.5px] text-muted">{role}</span>
                  <span className="ml-2 font-mono text-[12.5px] text-dim">{note}</span>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-6 font-mono text-[12px] text-dim">
            // one binary per type. same source tree. build tags decide what&rsquo;s compiled in.
          </p>
        </div>
      </div>
    </Section>
  );
}

/* ───────────────────────── compare ───────────────────────── */

function Compare() {
  return (
    <Section eyebrow="the pitch" id="compare">
      <Headline>
        From a duct-taped stack to nine lines of MemQL.
      </Headline>
      <Lede className="max-w-[34em]">
        Postgres next to a vector DB next to a custom event bus next to an OpenAI wrapper next to a retry-logic file. You&rsquo;ve built it. Drag the divider.
      </Lede>
      <div className="mt-12">
        <ComparisonSlider />
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-6">
          <Caption>
            <span className="text-muted">today &mdash;</span> ~40 lines, and idempotency, partition isolation, provider fallback, and audit log are all still TODO.
          </Caption>
          <Caption>
            <span className="text-accent">memql &mdash;</span> 9 lines, declarative. Trigger, filter, partition, dispatch. The engine handles the rest.
          </Caption>
        </div>
      </div>
    </Section>
  );
}

function ComparisonSlider() {
  const [pct, setPct] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    draggingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    document.body.style.cursor = "col-resize";
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const next = Math.max(4, Math.min(96, (x / rect.width) * 100));
    setPct(next);
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    draggingRef.current = false;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    document.body.style.cursor = "";
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft")  { e.preventDefault(); setPct((p) => Math.max(4,  p -  4)); }
    if (e.key === "ArrowRight") { e.preventDefault(); setPct((p) => Math.min(96, p +  4)); }
    if (e.key === "PageDown")   { e.preventDefault(); setPct((p) => Math.max(4,  p - 10)); }
    if (e.key === "PageUp")     { e.preventDefault(); setPct((p) => Math.min(96, p + 10)); }
    if (e.key === "Home")       { e.preventDefault(); setPct(4);  }
    if (e.key === "End")        { e.preventDefault(); setPct(96); }
  }, []);

  /* ── auto-demo: scroll-pinned section. ──────────────────────────────
     When window.scrollY crosses the Y where the compare section's top
     sits 80px below the viewport, the section becomes position:fixed
     at top:80 while a placeholder fills its space in flow. The rest
     of the page keeps scrolling normally — wheel/touch/scrollbar all
     stay responsive. The section just visually pins to the viewport
     for the ~2s the animation plays, then releases. The user ends up
     wherever their accumulated scroll took them. Fires once, respects
     prefers-reduced-motion. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const section = document.getElementById("compare");
    if (!section) return;

    let played = false;
    let rafId = 0;
    let triggerY = 0;
    let lastY = window.scrollY;
    let release: (() => void) | null = null;

    const recalc = () => {
      const rect = section.getBoundingClientRect();
      triggerY = window.scrollY + rect.top - 80;
    };

    const segments: [number, number, number][] = [
      [50,  5, 650],
      [ 5, 95, 850],
      [95, 50, 550],
    ];
    let segIdx = 0;
    let segStart: number | null = null;
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    const playFrame = (now: number) => {
      if (segIdx >= segments.length) {
        setPct(50);
        if (release) release();
        return;
      }
      if (segStart === null) segStart = now;
      const [from, to, dur] = segments[segIdx];
      const t = Math.min(1, (now - segStart) / dur);
      const eased = ease(t);
      setPct(from + (to - from) * eased);
      if (t >= 1) {
        segIdx++;
        segStart = null;
      }
      rafId = requestAnimationFrame(playFrame);
    };

    const onScroll = () => {
      if (played) return;
      const currentY = window.scrollY;
      const crossedDown = lastY < triggerY && currentY >= triggerY;
      lastY = currentY;
      if (!crossedDown) return;

      played = true;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", recalc);

      // If user has overshot, snap to triggerY first so the section
      // pins at the consistent visual position. This is instant — a
      // smooth scroll would fight with the user's ongoing fling.
      if (window.scrollY > triggerY + 5) {
        window.scrollTo({ top: triggerY, behavior: "auto" });
      }

      // Place an invisible placeholder of equal height where the
      // section was, so flow content below doesn't jump up when the
      // section becomes position:fixed.
      const sectionHeight = section.offsetHeight;
      const placeholder = document.createElement("div");
      placeholder.style.height = `${sectionHeight}px`;
      placeholder.setAttribute("aria-hidden", "true");
      placeholder.setAttribute("data-pin-placeholder", "true");
      section.parentNode?.insertBefore(placeholder, section);

      // Pin the section to the viewport. Scroll input continues to
      // register on the body underneath — scrollbar moves, momentum
      // decays, wheel events fire normally.
      const saved = {
        position: section.style.position,
        top: section.style.top,
        left: section.style.left,
        right: section.style.right,
        width: section.style.width,
        zIndex: section.style.zIndex,
      };
      section.style.position = "fixed";
      section.style.top = "80px";
      section.style.left = "0";
      section.style.right = "0";
      section.style.width = "100%";
      section.style.zIndex = "40";

      release = () => {
        section.style.position = saved.position;
        section.style.top = saved.top;
        section.style.left = saved.left;
        section.style.right = saved.right;
        section.style.width = saved.width;
        section.style.zIndex = saved.zIndex;
        placeholder.remove();
        release = null;
      };

      rafId = requestAnimationFrame(playFrame);
    };

    recalc();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", recalc);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", recalc);
      if (rafId) cancelAnimationFrame(rafId);
      if (release) release();
    };
  }, []);

  const dominantFile = pct > 50 ? "on_space_created.py" : "dsl/cognition/automations.memql";

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-bg-elev">
      {/* chrome */}
      <div className="flex items-center gap-2 border-b border-border bg-black/30 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 font-mono text-[11.5px] text-muted">{dominantFile}</span>
        <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
          drag ⇆
        </span>
      </div>

      {/* body: two static layers anchored to opposite edges + vertical slider cut */}
      <div ref={containerRef} className="relative h-[540px] select-none bg-bg-elev">

        {/* Python — anchored to LEFT edge. Revealed to the left of the slider. */}
        <div
          className="absolute inset-0 overflow-hidden bg-bg-elev"
          style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}
        >
          <div className="px-5 pt-4 pb-2 whitespace-nowrap">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              // today · on_space_created.py
            </span>
          </div>
          <pre className="overflow-hidden px-5 pb-5 font-mono text-[12.5px] leading-[1.75]">
            <CodeBlock code={DUCT_TAPE_PY} lang="python" />
          </pre>
        </div>

        {/* MemQL — anchored to RIGHT edge. Revealed to the right of the slider. */}
        <div
          className="absolute inset-0 flex flex-col items-end overflow-hidden bg-bg-elev"
          style={{ clipPath: `inset(0 0 0 ${pct}%)` }}
        >
          <div className="w-full max-w-full px-5 pt-4 pb-2 text-right whitespace-nowrap">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
              // memql · automations.memql
            </span>
          </div>
          <pre className="w-full overflow-hidden px-5 pb-5 font-mono text-[12.5px] leading-[1.75]">
            <CodeBlock code={AUTOMATION_MEMQL} lang="memql" />
          </pre>
        </div>

        {/* slider handle — vertical line, drags horizontally */}
        <div
          role="slider"
          aria-label="Code comparison divider"
          aria-orientation="horizontal"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={4}
          aria-valuemax={96}
          aria-valuetext={`${Math.round(pct)} percent — ${pct > 50 ? "Python view" : "MemQL view"} dominant`}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onKeyDown={onKeyDown}
          className="group absolute inset-y-0 z-20 flex cursor-col-resize items-center justify-center touch-none rounded outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-elev"
          style={{ left: `calc(${pct}% - 14px)`, width: 28 }}
        >
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-accent/60 group-hover:bg-accent transition-colors" />
          <div className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full border border-accent-deep bg-bg-elev shadow-[0_0_0_6px_rgba(74,222,128,0.10)] group-hover:shadow-[0_0_0_8px_rgba(74,222,128,0.15)] transition-shadow">
            <span aria-hidden="true" className="font-mono text-[14px] leading-none text-accent">⇆</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── language showcase ───────────────────────── */

function Language() {
  const [active, setActive] = useState<ConstructName>("concept");
  const item = CONSTRUCTS.find((c) => c.name === active) ?? CONSTRUCTS[0];

  // WAI-ARIA APG tablist: arrow keys cycle, Home/End jump to ends,
  // focus follows selection.
  const onTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % CONSTRUCTS.length;
    if (e.key === "ArrowLeft")  next = (i - 1 + CONSTRUCTS.length) % CONSTRUCTS.length;
    if (e.key === "Home")       next = 0;
    if (e.key === "End")        next = CONSTRUCTS.length - 1;
    if (next === -1) return;
    e.preventDefault();
    setActive(CONSTRUCTS[next].name);
    document.getElementById(`tab-${CONSTRUCTS[next].name}`)?.focus();
  };

  return (
    <Section eyebrow="the language">
      <Headline>Eight constructs. One file format.</Headline>
      <Lede className="max-w-[36em]">
        Every behavior in the system is described as a typed construct in a <Inline>.memql</Inline> file. The vocabulary is small. The system is what those eight nouns compose into.
      </Lede>

      <div className="mt-12 overflow-hidden rounded-lg border border-border bg-bg-elev">
        {/* tabs */}
        <div
          role="tablist"
          aria-label="MemQL DSL constructs"
          className="grid grid-cols-4 border-b border-border sm:grid-cols-8"
        >
          {CONSTRUCTS.map((c, i) => {
            const isActive = c.name === active;
            return (
              <button
                key={c.name}
                id={`tab-${c.name}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${c.name}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActive(c.name)}
                onKeyDown={(e) => onTabKeyDown(e, i)}
                className={`-mb-px border-b-2 px-3 py-3.5 font-mono text-[12.5px] tracking-wide outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset ${
                  isActive
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-transparent text-muted hover:bg-bg/40 hover:text-fg"
                }`}
              >
                {c.name}
              </button>
            );
          })}
        </div>

        {/* file path + blurb */}
        <div className="flex flex-col gap-1 border-b border-border bg-black/20 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-mono text-[11.5px] text-muted">
            {item.file}
          </span>
          <span className="font-mono text-[11.5px] text-dim">
            <span className="text-accent">›</span> {item.blurb}
          </span>
        </div>

        {/* code panel */}
        <div
          role="tabpanel"
          id={`tabpanel-${item.name}`}
          aria-labelledby={`tab-${item.name}`}
          tabIndex={0}
        >
          <pre className="min-h-[440px] overflow-x-auto px-6 py-6 font-mono text-[12.5px] leading-[1.75]">
            <CodeBlock code={item.code} lang="memql" />
          </pre>
        </div>
      </div>
    </Section>
  );
}

/* ───────────────────────── cockpit ───────────────────────── */

function Cockpit() {
  const tabs: [string, string][] = [
    ["agents",   "who's joined — humans, SI, workers"],
    ["auth",     "identity · magic-link · JWKS"],
    ["client",   "ad-hoc queries + mutations"],
    ["cluster",  "topology · build tags · live events"],
    ["config",   "clusters.yaml + worker.yaml"],
    ["editor",   ".memql with linter feedback"],
    ["explorer", "graph + time-series traversal"],
    ["settings", "keys · telemetry · prefs"],
  ];
  return (
    <Section eyebrow="cockpit">
      <Headline>A TUI that ships with the platform.</Headline>
      <Lede className="max-w-[44em]">
        Terminal-native IDE and operations console for MemQL clusters. Write, lint, and execute DSL; explore cluster state; manage identity and workers; observe the platform in real time. No web app. No Electron. Just gRPC to the cluster.
      </Lede>

      {/* TUI mock — box-drawing chars, sidebar layout, keybind bar.
          Wrapped in <figure role="img"> so screen readers announce it
          as a single image with a meaningful caption rather than spelling
          out every box-drawing glyph individually. */}
      <figure
        role="img"
        aria-label="MemQL Cockpit TUI mockup: eight-tab terminal interface with the 'agents' tab active, showing four connected participants — sofia, claude-sonnet-4.6, planner-01, mac-mini-pool — and a keybind bar at the bottom."
        className="mt-12 overflow-x-auto rounded-md bg-bg-elev px-3 py-5"
      >
        <pre aria-hidden="true" className="mx-auto inline-block font-mono text-[13px] leading-[1.55] text-muted">
{`┌──────────────────────────────────────────────────────────────────────────┐
│ `}<span className="text-fg">memql-cockpit</span>{`                                 `}<span className="text-accent">connected</span>{` · 4 agents      │
├──────────────┬───────────────────────────────────────────────────────────┤
│ `}<span className="text-accent">▸ agents</span>{`     │  ── agents ──────────────────────────────                 │
│   auth       │                                                           │
│   client     │  `}<span className="text-accent">●</span>{` `}<span className="text-fg-dim">sofia</span>{`               human   asst-of   #space-72        │
│   cluster    │  `}<span className="text-accent">●</span>{` `}<span className="text-fg-dim">claude-sonnet-4.6</span>{`   si      general   #space-72        │
│   config     │  `}<span className="text-dim">○</span>{` `}<span className="text-fg-dim">planner-01</span>{`          worker  idle      —                 │
│   editor     │  `}<span className="text-dim">○</span>{` `}<span className="text-fg-dim">mac-mini-pool</span>{`       worker  idle      —                 │
│   explorer   │                                                           │
│   settings   │  `}<span className="text-dim italic">// 4 connected · 12 events/min · gRPC ok</span>{`                 │
│              │                                                           │
├──────────────┴───────────────────────────────────────────────────────────┤
│  `}<span className="text-accent">q</span>{`:quit  `}<span className="text-accent">↑↓</span>{`:nav  `}<span className="text-accent">Tab</span>{`:next-pane  `}<span className="text-accent">e</span>{`:edit  `}<span className="text-accent">/</span>{`:search  `}<span className="text-accent">?</span>{`:help                 │
└──────────────────────────────────────────────────────────────────────────┘`}
        </pre>
      </figure>

      {/* eight tabs */}
      <div className="mt-14">
        <Label as="h3">// eight tabs</Label>
        <div className="mt-3 grid grid-cols-1 gap-x-12 gap-y-3.5 sm:grid-cols-2">
          {tabs.map(([tab, desc]) => (
            <div key={tab} className="grid grid-cols-[110px_minmax(0,1fr)] items-baseline gap-x-4">
              <span className="font-mono text-[13px] text-accent">{tab}</span>
              <span className="font-mono text-[12.5px] text-muted">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* computer use + install */}
      <div className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        <div>
          <Label tone="accent" as="h3">// computer use</Label>
          <p className="text-[16px] leading-[1.65] text-fg">
            Run <Inline>./bin/memql-cockpit worker run</Inline> and your machine joins the cluster as a per-user worker. Two modes &mdash; <Inline>computer_use_headless</Inline> for shell, filesystem, and HTTP; <Inline>computer_use_embodied</Inline> (CGO build via <Inline>make cockpit-gui</Inline>) for mouse, keyboard, and screenshots through RobotGo. The agent doesn&rsquo;t drive a sandbox. It drives your laptop.
          </p>
        </div>
        <div>
          <Label tone="accent" as="h3">// install</Label>
          <pre className="overflow-x-auto font-mono text-[12.5px] leading-[1.85] text-fg-dim">
{`$ `}<span className="text-accent">make</span>{` cockpit
$ `}<span className="text-accent">./bin/memql-cockpit</span>
          </pre>
          <p className="mt-4 font-mono text-[12px] leading-[1.55] text-dim">
            macOS LaunchAgent &middot; Linux systemd user service &middot; cross-compile via <Inline>make cockpit-all-platforms</Inline>
          </p>
        </div>
      </div>

      {/* repo link */}
      <div className="mt-12">
        <a
          href="https://github.com/znasllc-io/memql-cockpit"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 font-mono text-[13px] tracking-wide text-accent hover:text-fg transition-colors"
        >
          znasllc-io/memql-cockpit <span>→</span>
        </a>
      </div>
    </Section>
  );
}

/* ───────────────────────── for whom ───────────────────────── */

function ForWhom() {
  const items = [
    {
      label: "// the agent product builder",
      body: "You're building a product where memory matters. You've outgrown stuffing context into prompts. You've outgrown a vector DB next to a Postgres next to a custom event bus. MemQL is the system you'd build if you had a year.",
    },
    {
      label: "// the platform engineer",
      body: "Every AI feature you shipped this year needed its own storage, its own retry logic, its own event plumbing. MemQL is one substrate that handles all of it. The DSL describes behavior; the engine handles the rest.",
    },
    {
      label: "// the agentic-os curious",
      body: "The next interesting layer of infrastructure is the one between models and applications. MemQL is what that layer looks like in practice.",
    },
  ];
  return (
    <Section eyebrow="who it's for">
      <Headline>Three readers.</Headline>
      <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-3">
        {items.map((it) => (
          <div key={it.label}>
            <Label tone="accent" as="h3">{it.label}</Label>
            <p className="text-[16px] leading-[1.65] text-fg">{it.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ───────────────────────── close ───────────────────────── */

function Close() {
  return (
    <section id="project" className="relative overflow-hidden border-t border-border">
      <div className="hero-glow" />
      <div className="relative mx-auto max-w-[760px] px-8 py-32 text-center">
        <Eyebrow center>// the project</Eyebrow>
        <p className="mx-auto mt-8 max-w-[32em] font-serif text-[24px] leading-[1.45] text-fg sm:text-[28px]">
          MemQL and MemQL Cockpit are open source, Apache 2.0. Designed and built with Claude as co-author. Alpha &mdash; breaking changes expected.
        </p>
        <div className="mt-12 inline-block">
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
          <Image src="/icon.png" alt="" width={20} height={20} className="h-5 w-5 opacity-80" />
          <span className="font-mono text-[12px] tracking-wide text-muted">
            MemQL<span className="text-accent">.</span>
          </span>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-dim">
          prototype · {new Date().getFullYear()}
        </span>
      </div>
    </footer>
  );
}

/* ───────────────────────── primitives ───────────────────────── */

function Section({
  eyebrow,
  id,
  children,
}: {
  eyebrow: string;
  id?: string;
  children: React.ReactNode;
}) {
  const labelId = `section-eyebrow-${id ?? eyebrow.replace(/[^a-z0-9]/gi, "-")}`;
  return (
    <section id={id} aria-labelledby={labelId} className="border-t border-border">
      <div className="mx-auto max-w-[1180px] px-8 py-28">
        <Eyebrow id={labelId}>{eyebrow}</Eyebrow>
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

function Eyebrow({ children, center = false, id }: { children: React.ReactNode; center?: boolean; id?: string }) {
  return (
    <div id={id} className={`font-mono text-[11px] uppercase tracking-[0.22em] text-accent ${center ? "text-center" : ""}`}>
      {children}
    </div>
  );
}

function Headline({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-5 max-w-[18em] font-serif text-[36px] leading-[1.12] tracking-tight text-fg sm:text-[44px]">
      {children}
    </h2>
  );
}

function Lede({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`mt-7 text-[18px] leading-[1.6] text-fg-dim ${className}`}>{children}</p>
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

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 font-mono text-[12px] leading-[1.5] text-muted">{children}</p>
  );
}

/* ───────────────────────── code window ───────────────────────── */

function CodeWindow({
  filename,
  filenameTone = "muted",
  children,
}: {
  filename: string;
  filenameTone?: "muted" | "dim";
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-bg-elev">
      <div className="flex items-center gap-2 border-b border-border bg-black/30 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className={`ml-3 font-mono text-[11.5px] ${filenameTone === "dim" ? "text-dim" : "text-muted"}`}>
          {filename}
        </span>
      </div>
      <pre className="overflow-x-auto px-5 py-5 font-mono text-[12.5px] leading-[1.75]">
        {children}
      </pre>
    </div>
  );
}

/* ───────────────────────── code block + tokenizer ───────────────────────── */

const CodeBlock = memo(function CodeBlock({
  code,
  lang,
  startLine = 1,
}: {
  code: string;
  lang: "memql" | "python";
  startLine?: number;
}) {
  // Tokenize once per (code, lang) pair. Without this, the ComparisonSlider
  // re-renders CodeBlock at 60fps during the 2s auto-demo and tokenizes
  // both code strings (~50 lines × 2) every frame.
  const tokenizedLines = useMemo(() => {
    const lines = code.split("\n");
    return lines.map((line) => tokenize(line, lang));
  }, [code, lang]);
  const width = String(startLine + tokenizedLines.length - 1).length;
  return (
    <code className="block">
      {tokenizedLines.map((tokens, i) => (
        <div key={i} className="flex">
          <span
            aria-hidden="true"
            className="select-none pr-5 text-right text-dim"
            style={{ minWidth: `${width + 1}ch` }}
          >
            {startLine + i}
          </span>
          <span className="min-w-0 flex-1">
            {tokens.map((t, j) => (
              <span key={j} className={tokenClass(t.kind)}>
                {t.text}
              </span>
            ))}
          </span>
        </div>
      ))}
    </code>
  );
});

type Kind = "annotation" | "keyword" | "string" | "number" | "comment" | "doc" | "plain";

function tokenize(line: string, lang: "memql" | "python"): { text: string; kind: Kind }[] {
  const out: { text: string; kind: Kind }[] = [];
  const re = lang === "memql"
    ? /(@description\("[^"]*"\))|("[^"]*")|(@[A-Za-z_][A-Za-z0-9_]*)|\b(concept|query|mutation|automation|prompt|provider|tool|policy|step|logic|args|filter|shape|insert|params|true|false|bool|int|string|float|object)\b|\b(\d+(?:\.\d+)?)\b/g
    : /(#[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(\d+(?:\.\d+)?)\b|\b(def|from|import|for|if|else|elif|not|return|as|in|is|None|True|False)\b/g;

  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) out.push({ text: line.slice(last, m.index), kind: "plain" });
    if (lang === "memql") {
      if (m[1]) out.push({ text: m[1], kind: "doc" });
      else if (m[2]) out.push({ text: m[2], kind: "string" });
      else if (m[3]) out.push({ text: m[3], kind: "annotation" });
      else if (m[4]) out.push({ text: m[4], kind: "keyword" });
      else if (m[5]) out.push({ text: m[5], kind: "number" });
    } else {
      if (m[1]) out.push({ text: m[1], kind: "comment" });
      else if (m[2]) out.push({ text: m[2], kind: "string" });
      else if (m[3]) out.push({ text: m[3], kind: "number" });
      else if (m[4]) out.push({ text: m[4], kind: "keyword" });
    }
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ text: line.slice(last), kind: "plain" });
  return out;
}

function tokenClass(kind: Kind): string {
  switch (kind) {
    case "annotation": return "text-accent";
    case "keyword":    return "text-accent-bright";
    case "string":     return "text-string";
    case "number":     return "text-number";
    case "comment":    return "text-dim italic";
    case "doc":        return "text-muted italic";
    default:           return "text-fg-dim";
  }
}

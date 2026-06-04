"use client";

import Image from "next/image";
import { memo, useState, useRef, useCallback, useEffect, useMemo } from "react";
import HeroGraph from "@/components/HeroGraph";
import ConceptGraph from "@/components/ConceptGraph";
import AgentLoopGraph from "@/components/AgentLoopGraph";
import CockpitConsole from "@/components/CockpitConsole";
import ThemeToggle from "@/components/ThemeToggle";
import WindowControls from "@/components/WindowControls";
import DocsFab from "@/components/DocsFab";
import { NeuronLink } from "@/components/Transition";
import { useOS } from "@/lib/useOS";
import { GH_REPO, GH_STARS } from "@/lib/stars";
import { tokenize, tokenClass } from "@/lib/tokenize";

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

/* ───────────────────────────── data ───────────────────────────── */

const AUTOMATION_MEMQL = `@enabled
@trigger(event="node.created", concept="v1:cognition:space", partition="*")
@filter(payload.active==true)
@description("On space creation, joins the creator's assistant plus any specialist agents picked at creation time. Joiners' GAs are never auto-joined.")
automation autoJoinSI {
  step run {
    logic autoJoinSI { event: event }
  }
}`;

// The logic the automation dispatches — trimmed from dsl/cognition/logic.memql.
const LOGIC_MEMQL = `@description("Triggered when a v1:cognition:space is created with status='active'. Auto-joins the creator's currently-active assistant as a v1:cognition:participant. The ONLY AI participant a space carries (maxAgents=1). Idempotent. Emits 'si.auto-joined'.")
logic logicAutoJoinSI {
  args {
    event object @required
  }
  body {
    getUser := queryUserById({ userId: args.event.payload.ownerUserId })
    activeAssistantId := coalesce(getUser.First().payload.preferences.activeAssistantId, "")

    // Exactly one of these fires, decided by activeAssistantId emptiness:
    getActiveGA := if activeAssistantId != "" {
      queryAgentById({ agentId: activeAssistantId })
    }
    getFallbackGA := if activeAssistantId == "" {
      queryAssistantAgentForUser({ ownerUserId: args.event.payload.ownerUserId })
    }
    getGA := coalesce(getActiveGA, getFallbackGA)

    // ...resolve the canonical agent id, then dispatch:
    //   mutationJoinSpaceAsSI                (insert the SI participant)
    //   mutationCreateSessionForParticipant  (bootstrap its session)
  }
}`;

// Move 2a — recall(): recency x relevance in one SQL statement.
const RECALL_MEMQL = `@enabled
@sdk
@executor("integration.harnessRecall.recall")
@args(profile="object", additionalProperties="true")
@description("Recall top-k memories of a concept (default v1:harness:observation) by a SINGLE hybrid recency x relevance score: pgvector cosine similarity + exponential time-decay over createdAt, scored and ordered server-side in one SQL statement against the MemoryNodes hypertable (no app-side merge). Owner-scoped; window prunes hypertable chunks; halfLife + wSem/wRec are tunable.")
builtin recall {
  text      string  @required
  concept   string
  k         int
  provider  string
}`;

// Move 2b — the harness spine: plan / step / observation (trimmed).
const HARNESS_MEMQL = `// The whole agent working-state model — no external task
// table, no audit log, no state store. (trimmed: real
// concepts carry @description / @displayCard / @relationship.)

concept plan {
  ownerUserId  string  @required
  goal         string  @required
  status       enum("open", "running", "done", "failed", "cancelled")  @required @default("open")
  rootStepId   string
  input        object
  result       object
  provenanceMutation  string
}

concept step {
  ownerUserId    string  @required
  planId         string  @required
  title          string  @required
  status         enum("pending", "ready", "running", "blocked", "done", "failed")  @required @default("pending")
  dependsOn      []string
  idempotencyKey string  @required
  attempt        int     @required @default("0")
  result         object
}

concept observation {
  ownerUserId  string  @required
  stepId       string  @required
  kind         enum("tool_result", "error", "note", "decision")  @required
  content      string  @required
  embedding    []float
}`;

// The scheduled automation behind the consolidation pass — a temporal
// trigger (description trimmed from dsl/harness/automations.memql).
const CRON_MEMQL = `@enabled
@trigger(schedule="0 45 2 * * *")
@description("Daily 02:45 UTC memory consolidation. Per owner: reads episodic nodes (plans / steps / observations) since that owner's watermark, groups them by similarity, LLM-distills stable facts, dedups against existing semantic memories, decays + prunes stale beliefs, then advances the watermark so the next run is incremental.")
automation consolidateMemory {
  step run {
    logic consolidateMemory { event: event }
  }
}`;

// Move 3 — the four constructs the showcase was missing.
const SPEC_MEMQL = `@description("Matches participants with human participantType")
spec specIsHumanParticipant {
  payload.participantType == "human"
}`;

const SHAPE_MEMQL = `@row
@description("Comprehensive participant projection with all fields")
shape participant participantFull {
  row.id
  payload.spaceId
  payload.userId
  payload.agentId
  payload.participantType
  payload.displayName
  payload.status
  payload.joinedAt
  payload.leftAt
  payload.capabilityOverrides
  payload.hidden
  row.createdAt
}`;

const BUILTIN_MEMQL = `@enabled
@executor("integration.chat.recentChat")
@args(profile="object")
@description("Read recent utterances + space context. Five operations: readRecent / readByKeyword / readByTime / getSpaceContext / listParticipants.")
builtin recentChat {
  spaceId    string  @required
  agentId    string
  operation  string  @required
  count      int
  keyword    string
  fromTime   string
  toTime     string
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

const POLICY_MEMQL = `@primary("streamGroqLlama70B")
@fallback("streamGeminiFlash")
@fallback("stream54Mini")
@maxTimeToFirstTokenMs(800)
@maxLatencyMs(10000)
@description("Low latency voice -- turn-taking in multi-party voice conversations. Groq is the best-in-class for first-token latency; Gemini Flash as a fallback matches the target TTFT envelope.")
policy lowLatencyVoice { }`;

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
  | "prompt"  | "provider" | "tool" | "policy"
  | "spec"    | "shape"    | "builtin" | "logic";

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
  { name: "logic",      blurb: "Procedure. Multi-step orchestration.",      file: "dsl/cognition/logic.memql",       code: LOGIC_MEMQL },
  { name: "prompt",     blurb: "LLM input. Versioned, provider-routed.",    file: "dsl/cognition/prompts.memql",     code: PROMPT_MEMQL },
  { name: "provider",   blurb: "Vendor + model. Cost-tagged.",              file: "dsl/providers/providers.memql",   code: PROVIDER_MEMQL },
  { name: "policy",     blurb: "Cross-cutting. SLA-aware routing.",         file: "dsl/policies/policies.memql",     code: POLICY_MEMQL },
  { name: "tool",       blurb: "Capability. Scoped, agent-callable.",       file: "dsl/copresent/tools.memql",       code: TOOL_MEMQL },
  { name: "builtin",    blurb: "Go capability behind a DSL schema.",        file: "dsl/cognition/builtins.memql",    code: BUILTIN_MEMQL },
  { name: "spec",       blurb: "Predicate. Compiles to a SQL WHERE.",       file: "dsl/cognition/specs.memql",       code: SPEC_MEMQL },
  { name: "shape",      blurb: "Projection. Reusable field selection.",     file: "dsl/cognition/shapes.memql",      code: SHAPE_MEMQL },
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
        <AgentLoop />
        <How />
        <Compare />
        <Composition />
        <Language />
        <Cockpit />
        <ForWhom />
        <Close />
        <Footer />
      </main>
      <DocsFab />
    </>
  );
}

/* ───────────────────────────── nav ───────────────────────────── */

function Nav() {
  const stars = useGitHubStars();
  return (
    <header className="fixed inset-x-0 top-4 z-50 mx-auto flex w-full max-w-[1180px] items-center gap-3 px-4">
      <nav aria-label="Primary" className="flex flex-1 items-center justify-between rounded-full border border-border bg-bg/70 px-5 py-3 backdrop-blur-md">
        <a href="#top" aria-label="MemQL — home" className="flex items-center gap-2.5">
          <Image src="/memql-mark.png" alt="" width={30} height={30} priority className="h-[30px] w-[30px] object-contain" />
          <span className="font-display text-[21px] leading-none tracking-wide text-fg">
            MemQL<span className="text-accent">.</span>
          </span>
        </a>
        <div className="flex items-center gap-4">
          <NeuronLink
            href="/docs"
            className="font-mono text-[12px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
          >
            docs
          </NeuronLink>
          {stars > 0 && (
            <a
              href={`https://github.com/${GH_REPO}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${formatStars(stars)} GitHub stars`}
              className="hidden items-center gap-1.5 font-mono text-[12px] text-muted hover:text-fg transition-colors sm:inline-flex"
            >
              <span aria-hidden="true" className="text-accent">★</span>
              {formatStars(stars)}
            </a>
          )}
          <GithubMenu align="right" variant="nav" />
        </div>
      </nav>
      {/* theme toggle sits OUTSIDE the nav oval as its own control */}
      <ThemeToggle />
    </header>
  );
}

/* ───────────────────────────── hero ───────────────────────────── */

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="hero-glow" />
      <HeroGraph />
      <div className="relative z-10 mx-auto grid max-w-[1180px] grid-cols-1 gap-12 px-8 pt-36 pb-32 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16">
        <div>
          <Eyebrow>// alpha · apache 2.0</Eyebrow>
          <h1 className="mt-6 font-serif text-[44px] leading-[1.08] tracking-tight text-fg sm:text-[56px] lg:text-[60px]">
            Ship agent memory without the plumbing.
          </h1>
          <p className="mt-7 max-w-[34em] text-[18px] leading-[1.6] text-fg-dim">
            An AI-native memory graph with a single DSL &mdash; time-series, event-driven by default, multi-tenant by partition. You describe the behavior; the engine handles the rest.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <a
              href="https://github.com/znasllc-io/MemQL"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-accent-bright px-5 py-2.5 font-mono text-[13px] tracking-wide text-bg transition-colors hover:bg-accent"
            >
              <span aria-hidden="true">★</span> Star on GitHub
            </a>
            <GithubMenu label="browse source" variant="cta" align="left" />
          </div>
          <div className="mt-5 font-mono text-[12px] tracking-wider text-dim uppercase">
            no demo · no waitlist · apache 2.0
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
  const inTheBox = ["dsl", "memory", "library", "harness", "voice", "computer use", "cockpit", "mcp", "cluster"];
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

/* ───────────────────────── what / how ───────────────────────── */

function What() {
  // phase 1 permanent · 2 organized · 3 retrievable — driven by the graph
  const [phase, setPhase] = useState(0);
  const onPhase = useCallback((p: number) => setPhase(p), []);

  const cols: { key: string; label: string; body: React.ReactNode }[] = [
    {
      key: "permanent",
      label: "// permanent",
      body: (
        <>
          Append-only by default. Every row is keyed by <Inline>(partition, id, createdAt)</Inline> on TimescaleDB hypertables &mdash; history is a first-class index, not a log file. Data is archived via soft-delete, not destroyed.
        </>
      ),
    },
    {
      key: "organized",
      label: "// organized",
      body: (
        <>
          Every node has its place. Behavior is declared, not coded &mdash; concept, query, mutation, automation, and more. Multi-tenant by partition: each customer is an isolated world; cluster-wide concepts live in <Inline>_system</Inline>.
        </>
      ),
    },
    {
      key: "retrievable",
      label: "// retrievable",
      body: (
        <>
          Any node, minimum path. Each datum has an index, a context, and a query. And memory acts: every mutation emits a typed event, automations subscribe via <Inline>@trigger</Inline> &mdash; context reaches the agent the moment it&rsquo;s needed.
        </>
      ),
    },
  ];

  return (
    <Section eyebrow="what" index="01">
      <Headline>What MemQL actually is.</Headline>
      <Lede className="max-w-[44em]">
        Agent and voice deployments are integration-heavy. The engineering is mostly plumbing &mdash; vector store, orchestrator, tool registry, model provider, kept consistent by hand. MemQL collapses that plumbing into one declarative substrate on top of PostgreSQL and TimescaleDB.
      </Lede>
      <p className="mt-7 max-w-[44em] font-mono text-[13px] leading-[1.6] text-muted">
        A network of nodes built for three properties at once &mdash; the same three a crystal lattice gets for free. Watch.
      </p>

      <Reveal delay={120} className="mt-10 overflow-hidden rounded-lg border border-border bg-bg-elev/40">
        <ConceptGraph onPhase={onPhase} />
      </Reveal>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-3 lg:gap-12">
        {cols.map((c, i) => {
          const lit = phase >= i + 1;
          return (
            <div
              key={c.key}
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

      <p className="mt-14 max-w-[44em] font-mono text-[13px] leading-[1.6] text-muted">
        <span className="text-accent">// mcp</span> &middot; Author tools in MemQL once. They speak MCP &mdash; every tool is reachable by any MCP client.
      </p>
    </Section>
  );
}

function AgentLoop() {
  // phases driven by the loop graph: 1 harness · 2 memory · 3 inspectable
  // (column order matches the headline: plan, remember, held to account)
  const [phase, setPhase] = useState(0);
  const onPhase = useCallback((p: number) => setPhase(p), []);

  const cols: { label: string; body: React.ReactNode }[] = [
    {
      label: "// the harness",
      body: (
        <>
          Agents work through whole tasks, not just react. A structured loop &mdash; <Inline>plan</Inline>, <Inline>step</Inline>, <Inline>observation</Inline> &mdash; with budgets, retries, and stopping rules. The planner runs reactively (tick &rarr; route &rarr; converge), and an agent can pause to ask you via <Inline>requestUserFeedback</Inline>.
        </>
      ),
    },
    {
      label: "// memory",
      body: (
        <>
          Consolidation turns episodic memory &mdash; what happened &mdash; into semantic knowledge: what&rsquo;s true in general. <Inline>recall()</Inline> blends recency &times; relevance; semantic retrieval finds by meaning. Episodic, semantic, similarity &mdash; one memory, mechanical not metaphor.
        </>
      ),
    },
    {
      label: "// inspectable",
      body: (
        <>
          <Inline>trace</Inline> &middot; <Inline>replay</Inline> &middot; <Inline>eval</Inline>. Record a run, replay it, grade it. The agent loop is glass, not a black box &mdash; the part senior engineers ask about first.
        </>
      ),
    },
  ];
  return (
    <Section eyebrow="the agent loop" index="02">
      <Headline>Where agents plan, remember, and are held to account.</Headline>
      <Lede className="max-w-[44em]">
        Storing data and reacting to events is table stakes. MemQL is where agents run whole tasks against a memory that behaves like memory &mdash; and where you can watch exactly what they did.
      </Lede>
      <p className="mt-7 max-w-[44em] font-mono text-[13px] leading-[1.6] text-muted">
        A plan fans into steps, each step leaves an observation, recall pulls the relevant ones back, and the whole run replays. Watch.
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

      {/* the differentiator, in the schema — recall() + the harness spine */}
      <Reveal delay={80} className="mt-16">
        <Label tone="accent" as="h3">// memory, in the schema</Label>
        <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
          <CodeWindow filename="dsl/harness/queries.memql">
            <CodeBlock code={RECALL_MEMQL} lang="memql" />
          </CodeWindow>
          <p className="text-[15.5px] leading-[1.7] text-fg-dim lg:pt-2">
            One hybrid score &mdash; <Inline>wSem · cosine(query, memory) + wRec · exp(−ln2 · age / halfLife)</Inline> &mdash; computed and ordered server-side in a single SQL statement, no app-side merge. A debugging agent raises <Inline>wRec</Inline> for &ldquo;what just happened&rdquo;; a research agent raises <Inline>wSem</Inline> for &ldquo;everything relevant, ever.&rdquo; Memory that behaves like a mind, not a log.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
          <CodeWindow filename="dsl/harness/concepts.memql  (trimmed)">
            <CodeBlock code={HARNESS_MEMQL} lang="memql" />
          </CodeWindow>
          <div className="text-[15.5px] leading-[1.7] text-fg-dim lg:pt-2">
            <p>
              A plan, its steps (a real DAG via <Inline>dependsOn</Inline>, with <Inline>idempotencyKey</Inline> for safe replay), and every observation an agent makes &mdash; all append-only rows with automatic provenance. Invalid transitions like <Inline>done &rarr; running</Inline> are rejected by the engine. Observations carry an embedding, so an agent can semantically search its own history: <em>&ldquo;what did I try last time I hit this error?&rdquo;</em>
            </p>
            <p className="mt-4">
              <span className="font-mono text-[13px] text-accent">// consolidation</span> &middot; a scheduled per-owner pass reads new observations since a watermark, clusters them by similarity, distills each cluster into a durable belief, dedupes, decays the unreinforced, and advances the watermark. What happened becomes what&rsquo;s true.
            </p>
          </div>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
          <CodeWindow filename="dsl/harness/automations.memql  (trimmed)">
            <CodeBlock code={CRON_MEMQL} lang="memql" />
          </CodeWindow>
          <p className="text-[15.5px] leading-[1.7] text-fg-dim lg:pt-2">
            And automations fire on clocks, not just events. This is the scheduled automation that runs that pass &mdash; <Inline>0 45 2 * * *</Inline>, daily at 02:45 UTC, deliberately offset past the other nightly sweeps so they don&rsquo;t contend for the same DB window. Real production scheduling, not a toy.
          </p>
        </div>
      </Reveal>

      <p className="mt-16 max-w-[44em] font-mono text-[13px] leading-[1.6] text-muted">
        <span className="text-accent">// tools</span> &middot; calendar &middot; notes &middot; tasks &middot; responsibilities &mdash; each a concept, a tool, and a skill. The Library subsystem stores and faceted-queries everything they produce.
      </p>
      <p className="mt-6 max-w-[44em] font-mono text-[13px] leading-[1.6] text-dim">
        <span className="text-accent">// new here?</span> &middot;{" "}
        <a href="/ai-harness" className="text-muted underline decoration-border underline-offset-2 transition-colors hover:text-fg hover:decoration-accent">
          What is an AI harness?
        </a>{" "}
        &mdash; the model-plus-harness primer, and where memory fits.
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
    <Section eyebrow="architecture" index="03" grid>
      <Headline>Three layers. One source tree.</Headline>
      <Lede className="max-w-[44em]">
        Plain-text DSL on top, a single Go source tree in the middle, partition-isolated time-series storage underneath. Build tags decide which binary each node becomes.
      </Lede>
      <Reveal delay={120} className="mt-14 grid grid-cols-1 gap-12 rounded-lg border border-border bg-bg-elev px-7 py-9 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-16 lg:px-10 lg:py-11">
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
      </Reveal>
    </Section>
  );
}

/* ───────────────────────── compare ───────────────────────── */

function Compare() {
  return (
    <Section eyebrow="the pitch" id="compare" index="04">
      <Headline>
        From a duct-taped stack to nine lines of MemQL.
      </Headline>
      <Lede className="max-w-[34em]">
        A Postgres. A vector DB. An event bus. An OpenAI wrapper. A retry-logic file. Five systems, kept in sync by hand. You&rsquo;ve built it. Drag the divider.
      </Lede>
      <Reveal delay={120} className="mt-12">
        <ComparisonSlider />
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-6">
          <Caption>
            <span className="text-muted">today &mdash;</span> ~40 lines, and idempotency, partition isolation, provider fallback, and audit log are all still TODO.
          </Caption>
          <Caption>
            <span className="text-accent">memql &mdash;</span> 9 lines, declarative. Trigger, filter, partition, dispatch. The engine handles the rest.
          </Caption>
        </div>
      </Reveal>
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

  /* ── auto-demo: in-place animation on scroll-in. ───────────────────
     When ≥50% of the slider window is visible, play the divider
     middle → 5% → 95% → middle wipe (~2s). No scroll lock, no pin,
     no DOM manipulation — just animates `pct` state. If the user
     scrolls past mid-animation, they miss the end; that's fine.
     Fires once. Respects prefers-reduced-motion. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const target = containerRef.current;
    if (!target) return;

    let played = false;
    let rafId = 0;

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

    const io = new IntersectionObserver(
      (entries) => {
        if (played) return;
        const entry = entries[0];
        if (!entry.isIntersecting) return;
        if (entry.intersectionRatio < 0.5) return;
        played = true;
        io.disconnect();
        rafId = requestAnimationFrame(playFrame);
      },
      { threshold: [0.5, 0.75, 1] }
    );
    io.observe(target);

    return () => {
      io.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  const dominantFile = pct > 50 ? "on_space_created.py" : "dsl/cognition/automations.memql";
  const os = useOS();

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-bg-elev">
      {/* chrome */}
      <div className="flex items-center gap-2 border-b border-border bg-bg-panel px-4 py-3">
        {os === "mac" && <WindowControls os={os} />}
        <span className={`${os === "mac" ? "ml-3" : ""} font-mono text-[11.5px] text-muted`}>{dominantFile}</span>
        <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
          drag ⇆
        </span>
        {os !== "mac" && <WindowControls os={os} color="var(--color-muted)" />}
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
          <div className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full border border-accent-deep bg-bg-elev shadow-[0_0_0_6px_rgba(92,205,167,0.10)] group-hover:shadow-[0_0_0_8px_rgba(92,205,167,0.16)] transition-shadow">
            <span aria-hidden="true" className="font-mono text-[14px] leading-none text-accent">⇆</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── composition ───────────────────────── */

function Composition() {
  // one write rippling through five real constructs
  const chain: [string, string, string][] = [
    ["concept",    "space",                 "a row is written"],
    ["event",      "node.created",          "emitted on insert"],
    ["automation", "autoJoinSI",            "@trigger subscribes"],
    ["logic",      "logicAutoJoinSI",       "resolves the assistant"],
    ["mutation",   "mutationJoinSpaceAsSI", "+ session bootstrap"],
  ];
  return (
    <Section eyebrow="composition" index="05">
      <Headline>One event. Five constructs. Zero glue.</Headline>
      <Lede className="max-w-[44em]">
        The fragmented Python above is the stack you assemble by hand. Here is the same outcome, declared &mdash; one write ripples through five real constructs, and the engine handles the rest.
      </Lede>

      {/* the chain */}
      <Reveal delay={120} className="mt-12">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch lg:gap-0">
          {chain.map(([kind, name, note], i) => (
            <div key={name} className="flex flex-col lg:flex-1 lg:flex-row lg:items-center">
              <div className="flex-1 rounded-lg border border-border bg-bg-elev/40 px-4 py-3">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-accent">{kind}</div>
                <div className="mt-1 font-mono text-[13px] text-fg break-all">{name}</div>
                <div className="mt-0.5 font-mono text-[11px] text-dim">{note}</div>
              </div>
              {i < chain.length - 1 && (
                <div aria-hidden="true" className="flex items-center justify-center py-1 text-accent lg:px-2.5 lg:py-0">
                  <span className="lg:hidden">↓</span>
                  <span className="hidden lg:inline">→</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </Reveal>

      {/* the two real constructs that carry the chain */}
      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <CodeWindow filename="dsl/cognition/automations.memql">
          <CodeBlock code={AUTOMATION_MEMQL} lang="memql" />
        </CodeWindow>
        <CodeWindow filename="dsl/cognition/logic.memql  (trimmed)">
          <CodeBlock code={LOGIC_MEMQL} lang="memql" />
        </CodeWindow>
      </div>

      <p className="mt-10 max-w-[46em] text-[16px] leading-[1.7] text-fg-dim">
        A user creates a space. That insert emits a typed <Inline>node.created</Inline> event. An automation is already subscribed to it. It dispatches a piece of logic that resolves the user&rsquo;s assistant and writes two rows &mdash; a participant and its session. Idempotency, partition isolation, audit provenance, and retries aren&rsquo;t code you wrote. They&rsquo;re the substrate.
      </p>
    </Section>
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
    <Section eyebrow="the language" index="06" grid>
      <Headline>Twelve constructs. One file format.</Headline>
      <Lede className="max-w-[36em]">
        Every behavior in the system is described as a typed construct in a <Inline>.memql</Inline> file. The vocabulary is small. The system is what those twelve nouns compose into.
      </Lede>

      <Reveal delay={120} className="mt-12 overflow-hidden rounded-lg border border-border bg-bg-elev">
        {/* tabs */}
        <div
          role="tablist"
          aria-label="MemQL DSL constructs"
          className="grid grid-cols-3 border-b border-border sm:grid-cols-6"
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
                style={!isActive ? { animationDelay: `${i * 0.18}s` } : undefined}
                className={`-mb-px cursor-pointer border-b-2 px-3 py-3.5 font-mono text-[12.5px] tracking-wide outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset ${
                  isActive
                    ? "border-accent bg-accent-soft text-accent"
                    : "tab-hint border-transparent text-muted hover:bg-bg/40 hover:text-fg hover:[animation:none]"
                }`}
              >
                {c.name}
              </button>
            );
          })}
        </div>

        {/* file path + blurb */}
        <div className="flex flex-col gap-1 border-b border-border bg-bg-panel px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-mono text-[11.5px] text-muted">
            {item.file}
          </span>
          <span className="font-mono text-[11.5px] text-dim">
            <span className="text-accent">›</span> {item.blurb}
          </span>
        </div>

        {/* code panel — keyed on active so the syntax-sweep replays per tab */}
        <div
          role="tabpanel"
          id={`tabpanel-${item.name}`}
          aria-labelledby={`tab-${item.name}`}
          tabIndex={0}
        >
          <pre key={item.name} className="code-sweep min-h-[440px] overflow-x-auto px-6 py-6 font-mono text-[12.5px] leading-[1.75]">
            <CodeBlock code={item.code} lang="memql" />
          </pre>
        </div>
      </Reveal>
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
    <section
      id="cockpit"
      aria-labelledby="cockpit-eyebrow"
      className="cockpit-band relative overflow-hidden border-y border-border"
    >
      {/* wider than the page column — the console breaks out, Warp/Raycast-style */}
      <div className="relative mx-auto max-w-[1360px] px-8 py-32">
        {/* centered product lockup crowning the flagship band:
            MemQL · [mark] · Cockpit, with the node mark as the centerpiece glyph. */}
        <div className="mb-16 flex items-center justify-center gap-3 sm:gap-4">
          <span className="font-display text-[40px] leading-none tracking-wide text-fg sm:text-[48px]">
            MemQL
          </span>
          <Image src="/memql-mark.png" alt="" width={60} height={60} priority className="h-[60px] w-[60px] object-contain" />
          <span className="font-display text-[40px] leading-none tracking-wide text-fg sm:text-[48px]">
            Cockpit<span className="text-accent">.</span>
          </span>
        </div>
        <Eyebrow id="cockpit-eyebrow" index="07">cockpit</Eyebrow>
        <Headline>A TUI that ships with the platform.</Headline>
        <Lede className="max-w-[46em]">
          A second product, in your terminal. Terminal-native IDE and operations console for MemQL clusters &mdash; write, lint, and execute DSL; explore cluster state; manage identity and workers; observe the platform in real time. No web app. No Electron. Just gRPC to the cluster.
        </Lede>

        {/* oversized live console, lifted off the band with an emerald glow */}
        <Reveal delay={120} className="relative isolate mt-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-6 -inset-y-10 z-0"
            style={{ background: "radial-gradient(ellipse 58% 72% at 50% 50%, rgba(0,157,113,0.20), transparent 72%)" }}
          />
          <div className="relative z-10">
            <CockpitConsole />
          </div>
        </Reveal>

      {/* eight tabs */}
      <Reveal delay={80} className="mt-14">
        <Label as="h3">// eight tabs</Label>
        <div className="mt-3 grid grid-cols-1 gap-x-12 gap-y-3.5 sm:grid-cols-2">
          {tabs.map(([tab, desc]) => (
            <div key={tab} className="grid grid-cols-[110px_minmax(0,1fr)] items-baseline gap-x-4">
              <span className="font-mono text-[13px] text-accent">{tab}</span>
              <span className="font-mono text-[12.5px] text-muted">{desc}</span>
            </div>
          ))}
        </div>
      </Reveal>

      {/* computer use + install */}
      <Reveal delay={80} className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
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
      </Reveal>

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
      </div>
    </section>
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
    <Section eyebrow="who it's for" index="08">
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
    <section id="project" className="relative overflow-hidden border-t border-border">
      <div className="hero-glow" />
      <div className="relative mx-auto max-w-[760px] px-8 py-32 text-center">
        <Eyebrow center index="09">the project</Eyebrow>
        <p className="mx-auto mt-8 max-w-[32em] font-serif text-[24px] leading-[1.45] text-fg sm:text-[28px]">
          MemQL and MemQL Cockpit are open source, Apache 2.0. Alpha.
        </p>
        <p className="mx-auto mt-9 max-w-[34em] font-mono text-[12.5px] leading-[1.65] text-muted">
          Memory Query Language &mdash; built to be to AI memory what SQL is to relational data.
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
    <section id={id} aria-labelledby={labelId} className="relative border-t border-border">
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
      {index && <span className="text-dim">{index} / 09&nbsp;&nbsp;</span>}
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
  const os = useOS();
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-bg-elev">
      <div className="flex items-center gap-2 border-b border-border bg-bg-panel px-4 py-3">
        {os === "mac" && <WindowControls os={os} />}
        <span className={`${os === "mac" ? "ml-3" : ""} font-mono text-[11.5px] ${filenameTone === "dim" ? "text-dim" : "text-muted"}`}>
          {filename}
        </span>
        {os !== "mac" && (
          <span className="ml-auto">
            <WindowControls os={os} color="var(--color-muted)" />
          </span>
        )}
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

// Syntax highlighting lives in @/lib/tokenize (shared with the docs renderer).

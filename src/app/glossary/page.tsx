import type { Metadata } from "next";
import Link from "next/link";
import MarketingShell from "@/components/seo/MarketingShell";

export const metadata: Metadata = {
  title: "AI Agent Memory Glossary — MemQL",
  description:
    "Plain definitions for AI agent memory terms: agent memory database, memory layer for AI agents, AI harness, temporal memory, time-series graph, episodic vs semantic memory, recall, and append-only memory.",
  alternates: { canonical: "/glossary" },
  openGraph: {
    title: "AI Agent Memory Glossary",
    description: "The vocabulary of agent memory, defined — and where MemQL fits each term.",
    url: "/glossary",
    type: "article",
  },
};

type Term = { term: string; body: React.ReactNode };

const TERMS: Term[] = [
  {
    term: "Agent memory",
    body: <>The information an AI agent keeps across time so it can act coherently — what it has seen, done, decided, and learned. Without it an agent is stateless and starts from zero on every turn.</>,
  },
  {
    term: "Agent memory database",
    body: <>A database purpose-built to store and serve an agent&rsquo;s memory — not a general store you bolt onto an agent, but one whose data model is the agent&rsquo;s state and history. <strong className="font-semibold text-fg">MemQL</strong> is an agent memory database: an append-only, time-series graph on PostgreSQL + TimescaleDB.</>,
  },
  {
    term: "Memory layer for AI agents",
    body: <>The part of an agent stack responsible for persistence and recall — the substrate the rest of the system reads from and writes to. In the <Link href="/ai-harness" className="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">Agent = Model + Harness</Link> model, the memory layer is the harness&rsquo;s most load-bearing pillar.</>,
  },
  {
    term: "AI harness",
    body: <>The runtime around a model that turns one LLM call into an agent that completes tasks — the loop, tools, budgets, retries, stopping rules, and memory. See the full explainer: <Link href="/ai-harness" className="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">What is an AI harness?</Link></>,
  },
  {
    term: "Temporal memory for AI agents",
    body: <>Memory that is aware of <em>when</em> things happened, so an agent can ask &ldquo;what changed since yesterday?&rdquo; or weight recent events more heavily. In MemQL every row is keyed by <code className="rounded border border-border bg-bg-panel px-1 font-mono text-[0.85em]">createdAt</code> on a TimescaleDB hypertable, making time a first-class index rather than a metadata field.</>,
  },
  {
    term: "Time-series graph (for AI)",
    body: <>A data model that is both a graph (records relate to one another) and a time-series (every record is timestamped and history is preserved). It lets an agent traverse relationships <em>and</em> reason over time in the same store — MemQL&rsquo;s core shape.</>,
  },
  {
    term: "Episodic vs. semantic memory",
    body: <>Episodic memory is the raw log of what happened (this step ran, this tool returned that). Semantic memory is what&rsquo;s generally true, distilled from many episodes (&ldquo;this approach usually fails here&rdquo;). MemQL&rsquo;s <Link href="/docs/memory" className="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">consolidation</Link> turns episodic memory into semantic memory on a schedule.</>,
  },
  {
    term: "recall()",
    body: <>MemQL&rsquo;s memory retrieval that blends <em>recency</em> and <em>relevance</em> in a single query — pgvector similarity combined with exponential time-decay over <code className="rounded border border-border bg-bg-panel px-1 font-mono text-[0.85em]">createdAt</code>, scored server-side. It&rsquo;s how an agent surfaces &ldquo;the right memories,&rdquo; not just the most similar ones.</>,
  },
  {
    term: "Append-only (a.k.a. immutable) agent memory",
    body: <>A memory store where records are never edited or deleted in place — you only append new versions. Because the past is never overwritten, the full history and provenance survive, which is what makes an agent&rsquo;s actions inspectable and replayable. People often search for this as &ldquo;immutable agent memory&rdquo;; MemQL is append-only, which gives that same guarantee.</>,
  },
  {
    term: "Agentic memory layer",
    body: <>Shorthand for the memory layer specifically designed for autonomous agents — durable, time-aware, queryable, and aware of an agent&rsquo;s working state (plans and steps), not just a passive cache of text.</>,
  },
];

const slug = (s: string) => s.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");

export default function GlossaryPage() {
  return (
    <MarketingShell>
      <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">// glossary</div>
      <h1 className="mt-5 font-serif text-[38px] leading-[1.1] tracking-tight text-fg sm:text-[46px]">
        AI agent memory glossary
      </h1>
      <p className="mt-6 text-[17px] leading-[1.6] text-fg-dim">
        The vocabulary of agent memory, in plain terms — and where{" "}
        <Link href="/" className="font-medium text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">MemQL</Link>{" "}
        fits each one.
      </p>

      <dl className="mt-12">
        {TERMS.map((t) => (
          <div key={t.term} className="border-t border-border py-7">
            <dt id={slug(t.term)} className="scroll-mt-28 font-serif text-[22px] leading-[1.2] tracking-tight text-fg">
              {t.term}
            </dt>
            <dd className="mt-3 text-[16px] leading-[1.7] text-fg-dim">{t.body}</dd>
          </div>
        ))}
      </dl>
    </MarketingShell>
  );
}

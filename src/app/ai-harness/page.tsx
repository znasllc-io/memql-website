import type { Metadata } from "next";
import Link from "next/link";
import MarketingShell from "@/components/seo/MarketingShell";

export const metadata: Metadata = {
  title: "What is an AI Harness? Model + Harness, Explained — MemQL",
  description:
    "An AI harness is the runtime around a model that turns one LLM call into an agent that plans, calls tools, remembers, retries, and stops. Agent = Model + Harness — and memory is the pillar that makes it work.",
  alternates: { canonical: "/ai-harness" },
  openGraph: {
    title: "What is an AI Harness?",
    description: "Agent = Model + Harness. What the harness does, and where agent memory fits.",
    url: "/ai-harness",
    type: "article",
  },
};

// Q&A pairs power both the page and the FAQPage structured data, so they can
// never drift apart.
const FAQ: { q: string; a: string }[] = [
  {
    q: "What is an AI harness?",
    a: "An AI harness is the runtime scaffolding around a language model that turns a single model call into an agent that completes whole tasks. The model predicts text; the harness gives it a loop, tools, memory, budgets, retries, and stopping rules. A useful shorthand is Agent = Model + Harness: the model is the reasoning, the harness is everything that lets that reasoning act, persist, and be held to account.",
  },
  {
    q: "What is the difference between the model and the harness?",
    a: "The model (the LLM) takes a prompt and returns text — it is stateless and forgets everything between calls. The harness is the surrounding system: it plans the work, decides which tool to call, feeds the model the right context, stores what happened, retries failed steps, and stops when the task is done. Swap the model and the harness still works; remove the harness and you are back to one-shot prompting.",
  },
  {
    q: "What does an AI harness actually do?",
    a: "A harness runs a loop. It decomposes a goal into steps, routes each step to a tool or a model call, records an observation of what happened, and repeats — tick, route, converge — until the task is done or a budget is hit. Along the way it enforces stopping rules, retries steps that fail, and keeps a durable record so the run can be inspected, replayed, and graded. That record — the plan, its steps, and the observations — is state, and state needs somewhere to live.",
  },
  {
    q: "Where does memory fit in an AI harness?",
    a: "Memory is the pillar of the harness that makes an agent more than a stateless chatbot. It is two things: the agent's working state (the current plan and steps) and its long-term memory (what it has learned and done before). Without durable, queryable memory an agent cannot resume a task, avoid repeating mistakes, or explain what it did. Memory is where most agent harnesses are improvised — a vector store bolted next to a database next to a log file.",
  },
  {
    q: "How does MemQL fit into an AI harness?",
    a: "MemQL is the memory and state layer of the harness, as a database rather than glue code. The harness spine — plan, step, observation — is modeled as first-class, append-only, time-series data, so an agent's working state and its history are the same queryable substrate. recall() blends recency and relevance to surface the right memories; consolidation distills what happened into what is generally true; and because every run is recorded with provenance, it can be traced, replayed, and evaluated. You declare the behavior in one DSL and the engine handles persistence, time-awareness, retries, and isolation.",
  },
  {
    q: "Is an AI harness the same as an agent framework like LangChain?",
    a: "They overlap but solve different problems. Prompt/agent frameworks help you compose chains and tool calls in application code. A harness is the runtime that actually carries a task to completion — the loop, the budgets, the convergence. MemQL is neither a prompt framework nor a model; it is the memory and state layer a harness relies on, so the agent's plan, steps, and observations are durable, time-aware, and inspectable instead of living in process memory.",
  },
];

function H2({ children, id }: { children: React.ReactNode; id: string }) {
  return (
    <h2 id={id} className="mt-14 scroll-mt-28 font-serif text-[26px] leading-[1.18] tracking-tight text-fg">
      {children}
    </h2>
  );
}

export default function AiHarnessPage() {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const slug = (s: string) => s.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");

  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">// explainer</div>
      <h1 className="mt-5 font-serif text-[38px] leading-[1.1] tracking-tight text-fg sm:text-[46px]">
        What is an AI harness?
      </h1>
      <p className="mt-6 text-[17px] leading-[1.6] text-fg-dim">
        Large language models predict text. They do not, on their own, plan a task, call tools,
        remember what happened, retry when something fails, or know when to stop. The{" "}
        <strong className="font-semibold text-fg">harness</strong> is everything around the model that
        makes those things happen. A useful shorthand:
      </p>
      <p className="mt-6 rounded-lg border border-accent-deep/40 bg-accent-soft px-6 py-4 text-center font-serif text-[22px] text-fg">
        Agent = Model + Harness
      </p>
      <p className="mt-6 text-[16px] leading-[1.7] text-fg-dim">
        The model is the reasoning. The harness is the loop, the tools, the budgets — and, above all,
        the <strong className="font-semibold text-fg">memory</strong>. This page explains what a harness
        does and where agent memory fits, because memory is the part most teams improvise and the part{" "}
        <Link href="/" className="font-medium text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">MemQL</Link>{" "}
        is built to be.
      </p>

      {FAQ.map((f) => (
        <section key={f.q}>
          <H2 id={slug(f.q)}>{f.q}</H2>
          <p className="mt-4 text-[16px] leading-[1.7] text-fg-dim">{f.a}</p>
        </section>
      ))}

      {/* CTA + internal links */}
      <div className="mt-16 rounded-lg border border-border bg-bg-elev/40 p-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">// keep reading</div>
        <ul className="mt-3 space-y-2 text-[15.5px] text-fg-dim">
          <li>
            <Link href="/docs/latest/overview/why-memql-harness" className="font-medium text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">
              Memory &amp; the agent harness
            </Link>{" "}
            — how recall, consolidation, and the plan/step/observation loop work in MemQL.
          </li>
          <li>
            <Link href="/memql-vs-vector-memory" className="font-medium text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">
              MemQL vs. vector memory
            </Link>{" "}
            — why a time-series graph differs from embed-and-retrieve.
          </li>
          <li>
            <Link href="/glossary" className="font-medium text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">
              Agent-memory glossary
            </Link>{" "}
            — the terms, defined.
          </li>
        </ul>
      </div>
    </MarketingShell>
  );
}

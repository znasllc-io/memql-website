import type { Metadata } from "next";
import Link from "next/link";
import MarketingShell from "@/components/seo/MarketingShell";

export const metadata: Metadata = {
  title: "MemQL vs. Vector Memory for AI Agents — MemQL",
  description:
    "How MemQL's append-only, time-series graph memory compares to vector / embed-and-retrieve agent memory (Mem0-style). MemQL includes vector similarity too (the similar() DSL construct) — plus time-awareness, relationships, provenance, and queryability. When to use which.",
  alternates: { canonical: "/memql-vs-vector-memory" },
  openGraph: {
    title: "MemQL vs. Vector Memory for AI Agents",
    description: "Append-only, time-series graph memory — with built-in vector similarity. An honest comparison vs. embed-and-retrieve.",
    url: "/memql-vs-vector-memory",
    type: "article",
  },
};

const ROWS: { dim: string; vector: string; memql: string }[] = [
  {
    dim: "Storage model",
    vector: "Embeddings in a vector index; memories are points in similarity space.",
    memql: "Append-only, time-series graph rows on PostgreSQL + TimescaleDB — with embeddings stored alongside (pgvector). Memories are versioned records with relationships.",
  },
  {
    dim: "Vector / similarity search",
    vector: "The whole product — nearest-neighbour over embeddings is all it does.",
    memql: "Built in, not given up: the similar() DSL construct ranks rows by vector similarity (pgvector), and knowledge domains do classic chunk-embed-retrieve RAG — all on the same engine, not a separate store.",
  },
  {
    dim: "Time-awareness",
    vector: "Usually none natively — recency is bolted on as metadata filters.",
    memql: "First-class. Every row is keyed by createdAt; temporal queries and time-decay are built in.",
  },
  {
    dim: "Retrieval",
    vector: "Pure semantic similarity (nearest-neighbour) over embeddings.",
    memql: "similar() for vector similarity, recall() to blend similarity × recency (time-decay) in one query, and exact DSL queries — your pick per call.",
  },
  {
    dim: "Consolidation",
    vector: "None — raw chunks accumulate; nothing distills or expires on its own.",
    memql: "Episodic rows consolidate into durable semantic knowledge on a schedule, so memory distills instead of just piling up.",
  },
  {
    dim: "Relationships",
    vector: "Flat — memories don't natively reference each other.",
    memql: "Graph — rows relate (a step belongs to a plan, an observation to a step), traversable and typed.",
  },
  {
    dim: "Working state",
    vector: "Out of scope — you store an agent's task state elsewhere.",
    memql: "The harness spine — plan, step, observation — is first-class data, so memory and working state share one substrate.",
  },
  {
    dim: "History & provenance",
    vector: "Typically overwrite/replace; little built-in history.",
    memql: "Append-only: nothing is edited in place, so every version and author is preserved — and you can ask what was true at any point in time (asOf), then replay it.",
  },
  {
    dim: "Queryability",
    vector: "Vector search + metadata filters.",
    memql: "A full DSL — queries, mutations, automations, policies — over the same memory.",
  },
  {
    dim: "Isolation & access control",
    vector: "You build it — namespaces and any auth live in your app around the store.",
    memql: "Multi-tenant by partition, with per-row authorization built in (test-enforced).",
  },
];

export default function ComparisonPage() {
  return (
    <MarketingShell>
      <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">// comparison</div>
      <h1 className="mt-5 font-serif text-[38px] leading-[1.1] tracking-tight text-fg sm:text-[46px]">
        MemQL vs. vector memory for AI agents
      </h1>
      <p className="mt-6 text-[17px] leading-[1.6] text-fg-dim">
        There are two common ways to give an AI agent memory. The popular one is{" "}
        <strong className="font-semibold text-fg">vector memory</strong> — embed everything and retrieve
        by similarity (the Mem0 / vector-store approach). The other is what{" "}
        <Link href="/" className="font-medium text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">MemQL</Link>{" "}
        does: an <strong className="font-semibold text-fg">append-only, time-series graph</strong>{" "}that
        treats memory and an agent&rsquo;s working state as the same queryable data. The key thing to
        know up front: this isn&rsquo;t vectors <em>or</em> a graph. MemQL{" "}
        <strong className="font-semibold text-fg">includes vector similarity</strong> — the{" "}
        <code className="font-mono text-[0.9em] text-fg-dim">similar()</code>{" "}construct does embedding
        search over the same data — so choosing MemQL doesn&rsquo;t mean giving up embed-and-retrieve;
        it means getting it <em>plus</em> time, relationships, provenance, and working state.
      </p>

      {/* mobile: stacked cards so MemQL (the key column) is never clipped off-screen */}
      <div className="mt-10 flex flex-col gap-4 sm:hidden">
        {ROWS.map((r) => (
          <div key={r.dim} className="rounded-lg border border-border bg-bg-elev/40 p-4">
            <div className="text-[15px] font-medium text-fg">{r.dim}</div>
            <div className="mt-3 border-t border-border pt-3">
              <div className="font-mono text-[11px] uppercase tracking-wider text-muted">Vector memory</div>
              <p className="mt-1.5 text-[14px] leading-[1.55] text-muted">{r.vector}</p>
            </div>
            <div className="mt-3 border-t border-border pt-3">
              <div className="font-mono text-[11px] uppercase tracking-wider text-accent">MemQL</div>
              <p className="mt-1.5 text-[14px] leading-[1.55] text-fg-dim">{r.memql}</p>
            </div>
          </div>
        ))}
      </div>

      {/* sm+ : full side-by-side comparison table */}
      <div className="mt-10 hidden overflow-x-auto rounded-lg border border-border sm:block">
        <table className="w-full border-collapse text-left text-[14px]">
          <thead className="bg-bg-panel">
            <tr>
              <th className="border-b border-border px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Dimension</th>
              <th className="border-b border-border px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Vector memory</th>
              <th className="border-b border-border px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-accent">MemQL</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.dim}>
                <td className="border-b border-border px-4 py-3 align-top font-medium text-fg">{r.dim}</td>
                <td className="border-b border-border px-4 py-3 align-top text-muted">{r.vector}</td>
                <td className="border-b border-border px-4 py-3 align-top text-fg-dim">{r.memql}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-14 font-serif text-[26px] leading-[1.18] tracking-tight text-fg">When to use which</h2>
      <p className="mt-4 text-[16px] leading-[1.7] text-fg-dim">
        <strong className="font-semibold text-fg">Reach for vector memory</strong> when the job is
        semantic search over a pile of documents or past messages — &ldquo;find me things like this&rdquo; —
        and you don&rsquo;t need time, relationships, or durable task state. It&rsquo;s simple, lighter to
        run (a library, no database), and great at that one thing.
      </p>
      <p className="mt-4 text-[16px] leading-[1.7] text-fg-dim">
        <strong className="font-semibold text-fg">Reach for MemQL</strong> when an agent needs to{" "}
        <em>behave</em> like it has memory: resume tasks, remember what it tried, reason over time
        (&ldquo;what changed since yesterday?&rdquo;), follow relationships, and let you inspect and replay
        exactly what it did. And you don&rsquo;t trade away vector search to get there: MemQL does
        embedding similarity natively via <code className="font-mono text-[0.9em] text-fg-dim">similar()</code>{" "}&mdash;
        it just isn&rsquo;t <em>only</em> that. It&rsquo;s the memory and state layer for the whole{" "}
        <Link href="/ai-harness" className="font-medium text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">agent harness</Link>.
      </p>

      <div className="mt-16 rounded-lg border border-border bg-bg-elev/40 p-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">// go deeper</div>
        <ul className="mt-3 space-y-2 text-[15.5px] text-fg-dim">
          <li>
            <Link href="/docs/latest/overview/why-memql-harness" className="font-medium text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">Memory &amp; the agent harness</Link>{" "}
            — recall(), consolidation, and the plan/step/observation model.
          </li>
          <li>
            <Link href="/docs" className="font-medium text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">Read the docs</Link>{" "}
            — the data model, the DSL, and the rest.
          </li>
        </ul>
      </div>
    </MarketingShell>
  );
}

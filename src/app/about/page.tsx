import type { Metadata } from "next";
import Link from "next/link";
import MarketingShell from "@/components/seo/MarketingShell";

export const metadata: Metadata = {
  title: "About MemQL — the memory layer for AI agents",
  description:
    "Why MemQL exists: AI forgets when a conversation ends, and every team rebuilds the same fragmented memory stack. MemQL is the part of the system that remembers — open source, Apache 2.0.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About MemQL",
    description: "Why MemQL exists, and the conviction behind building it in the open.",
    url: "/about",
    type: "article",
  },
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">{children}</div>;
}
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-16 font-serif text-[26px] leading-[1.2] tracking-tight text-fg">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 text-[16px] leading-[1.7] text-fg-dim">{children}</p>;
}

export default function AboutPage() {
  return (
    <MarketingShell>
      <Eyebrow>// about</Eyebrow>
      <h1 className="mt-5 font-serif text-[38px] leading-[1.1] tracking-tight text-fg sm:text-[46px]">
        MemQL exists so AI doesn&rsquo;t forget what matters.
      </h1>
      <p className="mt-6 text-[18px] leading-[1.6] text-fg-dim">
        It&rsquo;s the memory layer between the models and the applications &mdash; the most critical,
        least-solved part of the stack.
      </p>

      <H2>Why it exists</H2>
      <P>
        AI has a structural flaw: when a conversation ends, it forgets. So every team rebuilds the same
        fragmented stack to paper over it &mdash; a Postgres next to a vector database next to an event
        bus next to an LLM wrapper next to a file of retry logic &mdash; and keeps it all consistent by
        hand.
      </P>
      <P>
        A human brain forgets <em>on purpose</em>. That&rsquo;s a feature: a brain isn&rsquo;t built to
        be an archive, it&rsquo;s built to think. But when the <em>machine</em> also forgets, the human is
        the one stuck re-explaining, re-reconstructing, carrying the context the system should have kept.
      </P>
      <p className="mt-8 border-l-2 border-accent pl-5 font-serif text-[22px] leading-[1.4] text-fg">
        AI without memory doesn&rsquo;t amplify you &mdash; it hands you back work.
      </p>
      <P>
        MemQL is the part of the system that remembers. One DSL, on PostgreSQL and TimescaleDB. You
        describe the behavior; the engine runs it; the memory persists.
      </P>

      <H2>What it is</H2>
      <P>
        MemQL is an AI-native, time-series memory graph with a single DSL &mdash; time-series and
        event-driven by default, multi-tenant by partition. The full picture lives in the{" "}
        <Link href="/docs" className="font-medium text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">docs</Link>{" "}
        and on the{" "}
        <Link href="/" className="font-medium text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">homepage</Link>;
        this page is about why it&rsquo;s built, not a feature tour.
      </P>

      <H2>Open source, by conviction</H2>
      <P>
        MemQL and MemQL Cockpit are{" "}
        <a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">Apache 2.0</a>.
        No demo, no waitlist &mdash; the repo is public and the code is the documentation.
      </P>
      <P>
        Transparency is total: what you see in the repo is what runs in production. There is no &ldquo;lite&rdquo;
        version behind a paywall and no hidden core. It&rsquo;s open source now, Apache 2.0, and that&rsquo;s
        the commitment going forward. Browse it:{" "}
        <a href="https://github.com/znasllc-io/MemQL" target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">znasllc-io/MemQL</a>{" "}
        and{" "}
        <a href="https://github.com/znasllc-io/memql-cockpit" target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">znasllc-io/memql-cockpit</a>.
      </P>

      <H2>Who&rsquo;s behind it</H2>
      <P>
        MemQL is built and maintained by <strong className="font-semibold text-fg">ZNAS LLC</strong>. It&rsquo;s
        deliberately code-forward &mdash; the work is in the open, and the repository is the resume.
      </P>

      <H2>Status</H2>
      <P>
        MemQL is <strong className="font-semibold text-fg">Alpha &mdash; pre-1.0</strong>. It is already
        running in production against real workloads, but the DSL, the engine API, and the wire surface are
        still evolving; expect breaking changes between versions. We&rsquo;d rather say that plainly than
        pretend otherwise &mdash; the honesty is the point.
      </P>

      <H2>Get involved</H2>
      <P>
        Star it, browse the source, open an issue or a discussion on{" "}
        <a href="https://github.com/znasllc-io/MemQL" target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">GitHub</a>.
        For licensing, enterprise questions, or just to tell us what you&rsquo;re building, email{" "}
        <a href="mailto:legal@znas.io" className="font-medium text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">legal@znas.io</a>.
        {" "}No &ldquo;book a demo.&rdquo;
      </P>
    </MarketingShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { DOC_SECTIONS } from "@/lib/docs-nav";
import Typewriter from "@/components/docs/Typewriter";

export const metadata: Metadata = {
  title: "Documentation — MemQL",
  description:
    "Complete documentation for MemQL and MemQL Cockpit — written from the source. The data model, the DSL, memory & the agent harness, providers, the gRPC API & SDK, deployment, and the Cockpit.",
  alternates: { canonical: "/docs" },
};

const STARTERS = [
  { slug: "overview", label: "Start with the overview", desc: "The mental model and the layered architecture." },
  { slug: "dsl", label: "Read the DSL", desc: "Every behavior in the system is a typed construct in a .memql file." },
];

export default function DocsHome() {
  return (
    <div className="max-w-[860px] pb-24">
      <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
        // documentation
      </div>
      <Typewriter
        text="Everything MemQL, from the source."
        className="mt-5 font-serif text-[40px] leading-[1.1] tracking-tight text-fg sm:text-[48px]"
      />
      <p className="mt-6 max-w-[40em] text-[17px] leading-[1.6] text-fg-dim">
        MemQL is an AI-native time-series memory graph with a single DSL. These
        docs cover the engine, the language, the agent harness, the AI provider
        layer, the wire API, deployment, and the Cockpit &mdash; the terminal IDE
        and ops console that ships alongside it.
      </p>

      {/* quick starts */}
      <div className="mt-9 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {STARTERS.map((s) => (
          <Link
            key={s.slug}
            href={`/docs/${s.slug}`}
            className="group rounded-lg border border-accent-deep/40 bg-accent-soft px-5 py-4 transition-colors hover:border-accent"
          >
            <div className="text-[15px] font-medium text-fg group-hover:text-accent">
              {s.label} <span aria-hidden="true">→</span>
            </div>
            <div className="mt-1 text-[13.5px] leading-snug text-muted">{s.desc}</div>
          </Link>
        ))}
      </div>

      {/* full index */}
      <div className="mt-16 flex flex-col gap-12">
        {DOC_SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="mb-4 font-mono text-[12px] uppercase tracking-[0.18em] text-accent">
              {section.title}
            </h2>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {section.items.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/docs/${item.slug}`}
                    className="group block h-full rounded-lg border border-border bg-bg-elev/40 px-5 py-4 transition-colors hover:border-border-strong"
                  >
                    <div className="text-[15.5px] font-medium text-fg group-hover:text-accent">
                      {item.title}
                    </div>
                    <div className="mt-1 text-[13.5px] leading-[1.5] text-muted">
                      {item.blurb}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

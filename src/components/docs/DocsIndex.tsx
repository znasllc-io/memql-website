import Link from "next/link";
import Typewriter from "@/components/docs/Typewriter";
import { docBlurb, getNav } from "@/lib/docs";

// Preferred quick-start cards, by slug, if the version ships them.
const STARTER_SLUGS = ["getting-started", "overview/why-memql-harness"];

export default function DocsIndex({ version }: { version: string }) {
  const sections = getNav(version);
  const bySlug = new Map(sections.flatMap((s) => s.items).map((i) => [i.slug, i]));
  const starters = STARTER_SLUGS.map((s) => bySlug.get(s)).filter((x) => x !== undefined);

  return (
    <div className="max-w-[860px] pb-24">
      <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
        // documentation
      </div>
      <Typewriter
        text="Everything memQL, from the source."
        className="mt-5 font-serif text-[40px] leading-[1.1] tracking-tight text-fg sm:text-[48px]"
      />
      <p className="mt-6 max-w-[42em] text-[17px] leading-[1.6] text-fg-dim">
        These docs are generated from the memQL engine repository and versioned
        with each release — what you read here matches the code that shipped.
        They cover the harness, the language, the AI layer, operations, and the
        Cockpit.
      </p>

      {/* quick starts */}
      {starters.length > 0 && (
        <div className="mt-9 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {starters.map((s) => (
            <Link
              key={s.slug}
              href={`/docs/${version}/${s.slug}`}
              className="group rounded-lg border border-accent-deep/40 bg-accent-soft px-5 py-4 transition-colors hover:border-accent"
            >
              <div className="text-[15px] font-medium text-fg group-hover:text-accent">
                {s.title} <span aria-hidden="true">→</span>
              </div>
              <div className="mt-1 text-[13.5px] leading-snug text-muted">
                {docBlurb(version, s)}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* full index */}
      <div className="mt-16 flex flex-col gap-12">
        {sections.map((section) => (
          <section key={section.area}>
            <h2 className="mb-4 font-mono text-[16px] uppercase tracking-[0.16em] text-accent sm:text-[12px] sm:tracking-[0.18em]">
              {section.title}
            </h2>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {section.items.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/docs/${version}/${item.slug}`}
                    className="group block h-full rounded-lg border border-border bg-bg-elev/40 px-5 py-4 transition-colors hover:border-border-strong"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[15.5px] font-medium text-fg group-hover:text-accent">
                        {item.title}
                      </span>
                      {item.generated && (
                        <span className="shrink-0 rounded-sm border border-border px-1 font-mono text-[9px] uppercase tracking-wider text-dim">
                          gen
                        </span>
                      )}
                      {item.siteAuthored && (
                        <span className="shrink-0 rounded-sm border border-amber-500/40 px-1 font-mono text-[9px] uppercase tracking-wider text-amber-500/80">
                          site
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[13.5px] leading-[1.5] text-muted">
                      {docBlurb(version, item)}
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

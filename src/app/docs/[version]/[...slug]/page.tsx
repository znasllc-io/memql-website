import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import DocsChrome from "@/components/docs/DocsChrome";
import Markdown from "@/components/docs/Markdown";
import TableOfContents from "@/components/docs/TableOfContents";
import { NeuronLink } from "@/components/Transition";
import { allDocParams, docBlurb, loadDoc } from "@/lib/docs";

export const dynamicParams = false;

export function generateStaticParams() {
  return allDocParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ version: string; slug: string[] }>;
}): Promise<Metadata> {
  const { version, slug } = await params;
  const doc = loadDoc(version, slug.join("/"));
  if (!doc) return { title: "Not found — memQL docs" };
  const title = `${doc.item.title} — memQL docs`;
  const description = docBlurb(version, doc.item) || doc.item.title;
  const canonical = `/docs/${version}/${doc.item.slug}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical },
  };
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ version: string; slug: string[] }>;
}) {
  const { version, slug } = await params;
  const slugStr = slug.join("/");
  const doc = loadDoc(version, slugStr);
  if (!doc) notFound();

  const { item, content, toc, section, prev, next } = doc;

  const techArticleLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: item.title,
    description: docBlurb(version, item) || item.title,
    url: `https://memql.io/docs/${version}/${item.slug}`,
    isPartOf: { "@type": "WebSite", name: "MemQL", url: "https://memql.io" },
    publisher: { "@type": "Organization", name: "ZNAS", url: "https://znas.io" },
    inLanguage: "en",
  };

  return (
    <DocsChrome version={version}>
      <div className="flex gap-10">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(techArticleLd) }} />
        <article className="min-w-0 max-w-[760px] flex-1 pb-24">
          {/* breadcrumb */}
          <div className="mb-6 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
            <Link href={`/docs/${version}`} className="transition-colors hover:text-fg">
              docs
            </Link>
            {section && (
              <>
                <span aria-hidden="true">/</span>
                <span className="text-muted">{section}</span>
              </>
            )}
          </div>

          <div className="mb-7">
            <h1 className="font-serif text-[34px] leading-[1.12] tracking-tight text-fg sm:text-[40px]">
              {item.title}
            </h1>
            {item.generated && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-border bg-bg-elev/40 px-2.5 py-1 font-mono text-[11px] text-dim">
                <span className="rounded-sm border border-border px-1 text-[9px] uppercase tracking-wider">gen</span>
                Generated from the engine — do not hand-edit
              </div>
            )}
            {item.siteAuthored && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-2.5 py-1 font-mono text-[11px] text-amber-500/90">
                <span className="rounded-sm border border-amber-500/40 px-1 text-[9px] uppercase tracking-wider">site</span>
                Written for this site — pending an upstream version
              </div>
            )}
          </div>

          <Markdown content={content} />

          {/* prev / next pager */}
          <nav
            aria-label="Pagination"
            className="mt-16 grid grid-cols-1 gap-4 border-t border-border pt-8 sm:grid-cols-2"
          >
            {prev ? (
              <NeuronLink
                href={`/docs/${version}/${prev.slug}`}
                className="group rounded-lg border border-border bg-bg-elev/40 px-5 py-4 transition-colors hover:border-border-strong"
              >
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
                  ← Previous
                </div>
                <div className="mt-1 text-[15px] font-medium text-fg group-hover:text-accent">
                  {prev.title}
                </div>
              </NeuronLink>
            ) : (
              <span />
            )}
            {next ? (
              <NeuronLink
                href={`/docs/${version}/${next.slug}`}
                className="group rounded-lg border border-border bg-bg-elev/40 px-5 py-4 text-right transition-colors hover:border-border-strong"
              >
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
                  Next →
                </div>
                <div className="mt-1 text-[15px] font-medium text-fg group-hover:text-accent">
                  {next.title}
                </div>
              </NeuronLink>
            ) : (
              <span />
            )}
          </nav>
        </article>

        <TableOfContents toc={toc} />
      </div>
    </DocsChrome>
  );
}

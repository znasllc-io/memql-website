import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Markdown from "@/components/docs/Markdown";
import TableOfContents from "@/components/docs/TableOfContents";
import { DOC_LIST, loadDoc } from "@/lib/docs";

export const dynamicParams = false;

export function generateStaticParams() {
  return DOC_LIST.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = loadDoc(slug);
  if (!doc) return { title: "Not found — MemQL docs" };
  const title = `${doc.meta.title} — MemQL docs`;
  return {
    title,
    description: doc.meta.blurb,
    alternates: { canonical: `/docs/${slug}` },
    openGraph: { title, description: doc.meta.blurb, url: `/docs/${slug}` },
  };
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = loadDoc(slug);
  if (!doc) notFound();

  const { meta, content, toc, section, prev, next } = doc;

  const techArticleLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: meta.title,
    description: meta.blurb,
    url: `https://memql.io/docs/${slug}`,
    isPartOf: { "@type": "WebSite", name: "MemQL", url: "https://memql.io" },
    publisher: { "@type": "Organization", name: "ZNAS", url: "https://znas.io" },
    inLanguage: "en",
  };

  return (
    <div className="flex gap-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(techArticleLd) }} />
      <article className="min-w-0 max-w-[760px] flex-1 pb-24">
        {/* breadcrumb */}
        <div className="mb-6 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
          <Link href="/docs" className="transition-colors hover:text-fg">
            docs
          </Link>
          {section && (
            <>
              <span aria-hidden="true">/</span>
              <span className="text-muted">{section}</span>
            </>
          )}
        </div>

        <h1 className="mb-7 font-serif text-[34px] leading-[1.12] tracking-tight text-fg sm:text-[40px]">
          {meta.title}
        </h1>

        <Markdown content={content} />

        {/* prev / next pager */}
        <nav
          aria-label="Pagination"
          className="mt-16 grid grid-cols-1 gap-4 border-t border-border pt-8 sm:grid-cols-2"
        >
          {prev ? (
            <Link
              href={`/docs/${prev.slug}`}
              className="group rounded-lg border border-border bg-bg-elev/40 px-5 py-4 transition-colors hover:border-border-strong"
            >
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
                ← Previous
              </div>
              <div className="mt-1 text-[15px] font-medium text-fg group-hover:text-accent">
                {prev.title}
              </div>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={`/docs/${next.slug}`}
              className="group rounded-lg border border-border bg-bg-elev/40 px-5 py-4 text-right transition-colors hover:border-border-strong"
            >
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
                Next →
              </div>
              <div className="mt-1 text-[15px] font-medium text-fg group-hover:text-accent">
                {next.title}
              </div>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </article>

      <TableOfContents toc={toc} />
    </div>
  );
}

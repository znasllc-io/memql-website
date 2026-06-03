import type { ComponentPropsWithoutRef, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeBlock from "./CodeBlock";
import { slugify } from "@/lib/docs-nav";

// Recursively flatten React children to plain text — for heading ids and for
// reading the raw contents of a fenced code block.
function nodeText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (typeof node === "object" && "props" in node) {
    // @ts-expect-error — React element children
    return nodeText(node.props?.children);
  }
  return "";
}

function Heading({ level, children }: { level: 1 | 2 | 3 | 4; children: ReactNode }) {
  const id = slugify(nodeText(children));
  const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4";
  const base =
    level === 1
      ? "font-serif text-[34px] leading-[1.12] tracking-tight text-fg sm:text-[40px] mt-2 mb-6"
      : level === 2
        ? "font-serif text-[26px] leading-[1.18] tracking-tight text-fg mt-16 mb-4 scroll-mt-28 border-t border-border pt-10"
        : level === 3
          ? "font-sans font-semibold text-[18px] leading-[1.3] text-fg mt-10 mb-3 scroll-mt-28"
          : "font-mono text-[12px] uppercase tracking-[0.18em] text-accent mt-8 mb-2 scroll-mt-28";
  return (
    <Tag id={level === 1 ? undefined : id} className={`group relative ${base}`}>
      {level !== 1 && (
        <a
          href={`#${id}`}
          aria-label="Link to this section"
          className="absolute -left-5 top-1/2 hidden -translate-y-1/2 font-mono text-accent opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 lg:inline"
        >
          #
        </a>
      )}
      {children}
    </Tag>
  );
}

const components = {
  h1: ({ children }: ComponentPropsWithoutRef<"h1">) => <Heading level={1}>{children}</Heading>,
  h2: ({ children }: ComponentPropsWithoutRef<"h2">) => <Heading level={2}>{children}</Heading>,
  h3: ({ children }: ComponentPropsWithoutRef<"h3">) => <Heading level={3}>{children}</Heading>,
  h4: ({ children }: ComponentPropsWithoutRef<"h4">) => <Heading level={4}>{children}</Heading>,

  p: ({ children }: ComponentPropsWithoutRef<"p">) => (
    <p className="my-4 text-[15.5px] leading-[1.72] text-fg-dim">{children}</p>
  ),

  a: ({ href, children }: ComponentPropsWithoutRef<"a">) => {
    const external = !!href && /^https?:\/\//.test(href);
    return (
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="font-medium text-accent underline decoration-accent/30 underline-offset-2 transition-colors hover:decoration-accent"
      >
        {children}
      </a>
    );
  },

  ul: ({ children }: ComponentPropsWithoutRef<"ul">) => (
    <ul className="my-4 space-y-2 pl-1 text-[15.5px] leading-[1.7] text-fg-dim marker:text-accent [&>li]:relative [&>li]:pl-5">
      {children}
    </ul>
  ),
  ol: ({ children }: ComponentPropsWithoutRef<"ol">) => (
    <ol className="my-4 list-decimal space-y-2 pl-6 text-[15.5px] leading-[1.7] text-fg-dim marker:font-mono marker:text-dim">
      {children}
    </ol>
  ),
  li: ({ children }: ComponentPropsWithoutRef<"li">) => (
    <li className="before:absolute before:left-0 before:text-accent before:content-['›'] [ol_&]:before:content-none [ol_&]:pl-0">
      {children}
    </li>
  ),

  blockquote: ({ children }: ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote className="my-6 rounded-r-lg border-l-2 border-accent bg-accent-soft px-5 py-1 text-fg-dim [&>p]:text-[15px]">
      {children}
    </blockquote>
  ),

  hr: () => <hr className="my-12 border-0 border-t border-border" />,

  strong: ({ children }: ComponentPropsWithoutRef<"strong">) => (
    <strong className="font-semibold text-fg">{children}</strong>
  ),
  em: ({ children }: ComponentPropsWithoutRef<"em">) => (
    <em className="italic text-fg-dim">{children}</em>
  ),

  table: ({ children }: ComponentPropsWithoutRef<"table">) => (
    <div className="my-6 overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-left text-[14px]">{children}</table>
    </div>
  ),
  thead: ({ children }: ComponentPropsWithoutRef<"thead">) => (
    <thead className="bg-bg-panel">{children}</thead>
  ),
  th: ({ children }: ComponentPropsWithoutRef<"th">) => (
    <th className="border-b border-border px-4 py-2.5 font-mono text-[11.5px] uppercase tracking-wider text-muted">
      {children}
    </th>
  ),
  td: ({ children }: ComponentPropsWithoutRef<"td">) => (
    <td className="border-b border-border px-4 py-2.5 align-top text-fg-dim [&_code]:text-[12.5px]">
      {children}
    </td>
  ),

  code: ({ className, children }: ComponentPropsWithoutRef<"code">) => {
    const text = nodeText(children);
    const isBlock = (className && /language-/.test(className)) || text.includes("\n");
    if (!isBlock) {
      return (
        <code className="rounded border border-border bg-bg-panel px-[0.4em] py-[0.1em] font-mono text-[0.85em] text-fg">
          {children}
        </code>
      );
    }
    const lang = className?.match(/language-([\w-]+)/)?.[1];
    return <CodeBlock code={text} lang={lang} />;
  },

  // We render code blocks as a self-contained <figure>; collapse the wrapping
  // <pre> so we don't nest block elements inside it.
  pre: ({ children }: ComponentPropsWithoutRef<"pre">) => <>{children}</>,
};

export default function Markdown({ content }: { content: string }) {
  return (
    <div className="doc-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

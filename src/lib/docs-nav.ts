// Pure docs registry + text helpers — NO filesystem access, so this is safe
// to import from client components (the sidebar, the TOC). The fs-backed
// loader lives in docs.ts (server-only) and re-exports from here.

export type DocMeta = {
  slug: string;
  title: string;
  blurb: string;
  file: string; // relative to src/content/docs
};

export type DocSection = {
  title: string;
  items: DocMeta[];
};

// Information architecture — the left-rail grouping. Order is meaningful:
// it drives the sidebar and the prev/next pager.
export const DOC_SECTIONS: DocSection[] = [
  {
    title: "Get started",
    items: [
      { slug: "overview", title: "Overview & architecture", blurb: "The mental model, the layered architecture, the project layout. The front door.", file: "00-overview.md" },
    ],
  },
  {
    title: "Core concepts",
    items: [
      { slug: "data-model", title: "Data model", blurb: "Concepts, nodes, the (partition, id, createdAt) model, partitions, the typed graph-event model.", file: "01-data-model.md" },
      { slug: "events", title: "Events & automations", blurb: "How events fire, how automations subscribe via @trigger, the logic runner, scheduled crons.", file: "09-events-and-automations.md" },
      { slug: "memory", title: "Memory & the agent harness", blurb: "Episodic ↔ semantic memory, recall(), consolidation, the plan/step/observation loop, observability.", file: "03-memory-and-harness.md" },
    ],
  },
  {
    title: "The language",
    items: [
      { slug: "dsl", title: "The MemQL DSL", blurb: "Every construct kind with real examples, argument resolution, the dependency tree.", file: "02-dsl-language.md" },
      { slug: "reference", title: "Reference", blurb: "Exhaustive enumeration: concepts by namespace, tools, providers, policies, builtins.", file: "10-reference.md" },
    ],
  },
  {
    title: "AI",
    items: [
      { slug: "providers", title: "SI providers & policies", blurb: "The AI provider system, the full provider list, routing policies, prompts.", file: "04-si-providers-and-policies.md" },
      { slug: "integrations", title: "Integrations & tools", blurb: "Voice, avatars, computer-use workers, knowledge/RAG, email, calendar/notes, the Library, training.", file: "05-integrations-and-tools.md" },
    ],
  },
  {
    title: "Operate",
    items: [
      { slug: "cluster", title: "Cluster & deployment", blurb: "Node types (build tags), the mesh, multi-replica concerns, the Azure AKS / GitOps model.", file: "06-cluster-and-deployment.md" },
      { slug: "auth", title: "Auth & identity", blurb: "The identity service, magic-link, JWKS, partition ACLs, token types, the genesis envelope.", file: "07-auth-and-identity.md" },
    ],
  },
  {
    title: "Build against it",
    items: [
      { slug: "sdk", title: "gRPC API & SDK", blurb: "The gRPC-first wire surface (MemqlService.Stream), message types, the WebSocket bridge, the Go SDK.", file: "08-sdk-and-api.md" },
    ],
  },
  {
    title: "Cockpit",
    items: [
      { slug: "cockpit", title: "Overview", blurb: "What the Cockpit is — terminal IDE + ops console — the launch flow, layout, how it connects.", file: "cockpit/00-overview.md" },
      { slug: "cockpit-tabs", title: "Tabs & features", blurb: "A tour of every tab: Clusters, Chat, Concepts, Planner, Skills, Workers, Safety, Settings.", file: "cockpit/01-tabs-and-features.md" },
      { slug: "cockpit-workers", title: "Workers, build & auth", blurb: "Worker run modes, build variants, the first-launch genesis wizard, auth & install.", file: "cockpit/02-workers-build-and-auth.md" },
    ],
  },
];

// Flat, ordered list — used for generateStaticParams and the prev/next pager.
export const DOC_LIST: DocMeta[] = DOC_SECTIONS.flatMap((s) => s.items);

export function getDocBySlug(slug: string): DocMeta | undefined {
  return DOC_LIST.find((d) => d.slug === slug);
}

export function adjacentDocs(slug: string): { prev?: DocMeta; next?: DocMeta } {
  const i = DOC_LIST.findIndex((d) => d.slug === slug);
  if (i === -1) return {};
  return { prev: DOC_LIST[i - 1], next: DOC_LIST[i + 1] };
}

export function sectionTitleFor(slug: string): string | undefined {
  return DOC_SECTIONS.find((s) => s.items.some((i) => i.slug === slug))?.title;
}

export type TocEntry = { depth: 2 | 3; text: string; id: string };

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// Strip inline markdown (code ticks, bold/italic, links) down to plain text —
// for heading display + slug computation.
export function stripInlineMarkdown(s: string): string {
  return s
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/\*([^*]*)\*/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .trim();
}

// Remove internal QA apparatus that should never appear on a public docs page:
// the `[VERIFY: …]` markers the doc set was annotated with.
export function cleanMarkdown(raw: string): string {
  let out = raw;
  // Bold-lead form: **[VERIFY: title]** …
  out = out.replace(/\*\*\[VERIFY:[^\]]*\]\*\*\s*/g, "");
  // Trailing / inline form: … [VERIFY: …].
  out = out.replace(/\s*\[VERIFY:[^\]]*\]/g, "");
  // Drop any blockquote lines left wholly empty by the removal.
  out = out
    .split("\n")
    .filter((line) => !/^>\s*$/.test(line))
    .join("\n");
  return out;
}

export function extractToc(markdown: string): TocEntry[] {
  const lines = markdown.split("\n");
  let inFence = false;
  const toc: TocEntry[] = [];
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(/^(#{2,3})\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    const depth = m[1].length as 2 | 3;
    const text = stripInlineMarkdown(m[2]);
    toc.push({ depth, text, id: slugify(text) });
  }
  return toc;
}

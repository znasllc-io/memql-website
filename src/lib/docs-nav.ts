// Pure docs helpers + types — NO filesystem access, so this is safe to import
// from client components (the sidebar, the TOC, the version dropdown). The
// fs-backed loader lives in docs.ts (server-only) and re-exports from here.
//
// Nav is no longer hardcoded: it is derived from each version's manifest.json
// (shipped in the release bundle). These helpers turn that manifest into the
// section/item tree the chrome renders, and map bundle paths <-> route slugs.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ManifestPage = {
  path: string; // e.g. "overview/why-memql-harness.md"
  title: string;
  sinceVersion?: string;
};

export type ManifestArea = {
  area: string;
  pages: ManifestPage[];
};

export type Manifest = {
  version: string;
  engineVersion: string;
  pageCount: number;
  areas: string[];
  nav: ManifestArea[];
};

export type NavItem = {
  slug: string; // route slug, e.g. "overview/why-memql-harness"
  title: string;
  path: string; // file path: bundle-relative, or site-docs-relative when siteAuthored
  sinceVersion?: string;
  generated: boolean; // machine-generated reference (badge it; never hand-edit)
  siteAuthored: boolean; // written for this site, pending an upstream canonical version
};

export type NavSection = {
  area: string;
  title: string;
  items: NavItem[];
};

export type TocEntry = { depth: 2 | 3; text: string; id: string };

// ---------------------------------------------------------------------------
// Area presentation — the seven doc areas map 1:1 to sidebar sections. Order
// and labels are the only site-side editorial layer; everything else is the
// manifest's. Areas not listed fall back to a title-cased label.
// ---------------------------------------------------------------------------

export const AREA_TITLES: Record<string, string> = {
  "get-started": "Get started",
  overview: "Overview",
  concepts: "Concepts",
  language: "Language",
  ai: "AI",
  operate: "Operate",
  build: "Build",
  cockpit: "Cockpit",
};

// Narrative section order for the sidebar (issue #11's story arc). The manifest
// drives page order *within* an area; this orders the areas themselves. Areas
// not listed here fall to the end, in manifest order.
export const AREA_ORDER = [
  "get-started",
  "overview",
  "concepts",
  "language",
  "ai",
  "operate",
  "build",
  "cockpit",
];

export function areaTitle(area: string): string {
  return AREA_TITLES[area] ?? area.replace(/(^|[-_])(\w)/g, (_, s, c) => (s ? " " : "") + c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Site-authored pages — a thin overlay on the bundle. memQL's docs are
// source-of-truth upstream, but a few site-only pages (e.g. a friendly
// Get Started / install page) don't exist upstream yet. They live in
// src/content/site-docs/, are clearly badged "site-written, pending upstream",
// and are merged into the nav. When the canonical version ships in a bundle,
// drop the entry here and the bundle page takes over.
// ---------------------------------------------------------------------------

export type SitePage = {
  slug: string; // route slug, e.g. "getting-started"
  title: string;
  area: string; // section to merge into, e.g. "get-started"
  file: string; // relative to src/content/site-docs/
  blurb: string;
  // Bundle paths that, once present in a version's manifest, retire this
  // placeholder — the canonical upstream page takes over automatically.
  supersededBy?: string[];
};

export const SITE_PAGES: SitePage[] = [
  {
    slug: "getting-started",
    title: "Get started",
    area: "get-started",
    file: "getting-started.md",
    blurb: "Install the memQL Cockpit with one command and run your first agent. macOS and Linux.",
    supersededBy: [
      "overview/getting-started.md",
      "overview/get-started.md",
      "overview/install.md",
      "get-started/getting-started.md",
      "get-started/install.md",
    ],
  },
];

// ---------------------------------------------------------------------------
// Path <-> slug
// ---------------------------------------------------------------------------

export function slugFromPath(path: string): string {
  return path.replace(/\.md$/, "");
}

export function isGeneratedPath(path: string): boolean {
  return path.includes("_generated");
}

// ---------------------------------------------------------------------------
// Manifest -> nav tree
// ---------------------------------------------------------------------------

export function buildNav(manifest: Manifest, sitePages: SitePage[] = SITE_PAGES): NavSection[] {
  const byArea = new Map<string, NavItem[]>();

  // Manifest pages first (the canonical bundle content).
  for (const entry of manifest.nav) {
    const items = entry.pages.map((p) => ({
      slug: slugFromPath(p.path),
      title: p.title,
      path: p.path,
      sinceVersion: p.sinceVersion,
      generated: isGeneratedPath(p.path),
      siteAuthored: false,
    }));
    if (items.length) byArea.set(entry.area, [...(byArea.get(entry.area) ?? []), ...items]);
  }

  // Site-authored pages prepend within their area (so Get Started leads) —
  // unless the canonical upstream page has shipped, in which case the
  // placeholder retires itself and the bundle page takes over.
  const bundlePaths = new Set(manifest.nav.flatMap((e) => e.pages.map((p) => p.path)));
  for (const sp of sitePages) {
    if (sp.supersededBy?.some((p) => bundlePaths.has(p))) continue;
    const item: NavItem = {
      slug: sp.slug,
      title: sp.title,
      path: sp.file,
      generated: false,
      siteAuthored: true,
    };
    byArea.set(sp.area, [item, ...(byArea.get(sp.area) ?? [])]);
  }

  const rank = (area: string) => {
    const i = AREA_ORDER.indexOf(area);
    return i === -1 ? AREA_ORDER.length : i;
  };

  return [...byArea.keys()]
    .sort((a, b) => rank(a) - rank(b))
    .map((area) => ({ area, title: areaTitle(area), items: byArea.get(area)! }))
    .filter((s) => s.items.length > 0);
}

export function flattenNav(sections: NavSection[]): NavItem[] {
  return sections.flatMap((s) => s.items);
}

export function adjacentInNav(
  sections: NavSection[],
  slug: string,
): { prev?: NavItem; next?: NavItem } {
  const flat = flattenNav(sections);
  const i = flat.findIndex((d) => d.slug === slug);
  if (i === -1) return {};
  return { prev: flat[i - 1], next: flat[i + 1] };
}

export function sectionTitleForSlug(sections: NavSection[], slug: string): string | undefined {
  return sections.find((s) => s.items.some((i) => i.slug === slug))?.title;
}

// ---------------------------------------------------------------------------
// Markdown text helpers
// ---------------------------------------------------------------------------

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

// Remove YAML front-matter (the bundle stamps every doc with title/area/etc.).
export function stripFrontmatter(raw: string): string {
  return raw.replace(/^---\n[\s\S]*?\n---\n?/, "");
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

// First real paragraph after the H1 — used as a card blurb on the docs index.
export function firstParagraph(markdown: string, max = 160): string {
  const body = markdown.replace(/^#\s+[^\n]*\n+/, "");
  const lines = body.split("\n");
  let inFence = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence || !line) continue;
    if (/^(#|>|[-*]|\d+\.|\||!\[|<)/.test(line)) continue;
    const text = stripInlineMarkdown(line);
    return text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, "")}…` : text;
  }
  return "";
}

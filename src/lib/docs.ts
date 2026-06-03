// Server-only docs loader: reads the bundled markdown in src/content/docs at
// build time (the site is a static export, so this runs during `next build`).
// Pure registry/text helpers live in docs-nav.ts and are re-exported here.

import fs from "node:fs";
import path from "node:path";
import {
  type DocMeta,
  type TocEntry,
  adjacentDocs,
  cleanMarkdown,
  extractToc,
  getDocBySlug,
  sectionTitleFor,
} from "./docs-nav";

export * from "./docs-nav";

const CONTENT_DIR = path.join(process.cwd(), "src", "content", "docs");

export type LoadedDoc = {
  meta: DocMeta;
  content: string;
  toc: TocEntry[];
  section?: string;
  prev?: DocMeta;
  next?: DocMeta;
};

export function loadDoc(slug: string): LoadedDoc | null {
  const meta = getDocBySlug(slug);
  if (!meta) return null;
  const filePath = path.join(CONTENT_DIR, meta.file);
  const raw = fs.readFileSync(filePath, "utf8");
  // Strip the source's leading H1 ("# memQL — …"); the page renders the
  // curated registry title instead (brand-consistent casing, no duplication).
  const content = cleanMarkdown(raw).replace(/^#\s+[^\n]*\n+/, "");
  const toc = extractToc(content);
  const { prev, next } = adjacentDocs(slug);
  return { meta, content, toc, section: sectionTitleFor(slug), prev, next };
}

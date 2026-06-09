// Server-only docs loader: reads the versioned bundle trees committed under
// src/content/docs/<version>/ at build time (the site is a static export, so
// this runs during `next build`). Each version is a snapshot of the engine
// repo's docs/public tree + a manifest.json that drives the nav. Pure
// registry/text helpers live in docs-nav.ts and are re-exported here.

import fs from "node:fs";
import path from "node:path";
import {
  type Manifest,
  type NavItem,
  type NavSection,
  type TocEntry,
  adjacentInNav,
  buildNav,
  cleanMarkdown,
  extractToc,
  firstParagraph,
  flattenNav,
  sectionTitleForSlug,
  stripFrontmatter,
} from "./docs-nav";

export * from "./docs-nav";

const CONTENT_DIR = path.join(process.cwd(), "src", "content", "docs");
const SITE_DIR = path.join(process.cwd(), "src", "content", "site-docs");

// Resolve a nav item to its file: site-authored pages live outside the
// versioned bundle (version-independent); everything else is bundle content.
function filePathFor(version: string, item: NavItem): string {
  return item.siteAuthored ? path.join(SITE_DIR, item.path) : path.join(CONTENT_DIR, version, item.path);
}

type Registry = {
  latest: string;
  versions: { version: string; engineVersion: string }[];
};

export function getRegistry(): Registry {
  const raw = fs.readFileSync(path.join(CONTENT_DIR, "versions.json"), "utf8");
  return JSON.parse(raw) as Registry;
}

// "latest" is an alias route that always resolves to the registry's newest
// version; concrete versions ("0.9.30") resolve to themselves.
export function resolveVersion(label: string): string {
  if (label === "latest") return getRegistry().latest;
  return label;
}

// Every routable version label, including the "latest" alias.
export function versionLabels(): string[] {
  return ["latest", ...getRegistry().versions.map((v) => v.version)];
}

export function loadManifest(label: string): Manifest {
  const version = resolveVersion(label);
  const raw = fs.readFileSync(path.join(CONTENT_DIR, version, "manifest.json"), "utf8");
  return JSON.parse(raw) as Manifest;
}

export function getNav(label: string): NavSection[] {
  return buildNav(loadManifest(label));
}

export type LoadedDoc = {
  item: NavItem;
  content: string;
  toc: TocEntry[];
  section?: string;
  prev?: NavItem;
  next?: NavItem;
};

export function loadDoc(label: string, slug: string): LoadedDoc | null {
  const version = resolveVersion(label);
  const sections = getNav(label);
  const item = flattenNav(sections).find((d) => d.slug === slug);
  if (!item) return null;

  const raw = fs.readFileSync(filePathFor(version, item), "utf8");
  // Drop front-matter, QA markers, and the source's leading H1 ("# memQL …");
  // the page renders the manifest title instead (no duplication).
  const content = cleanMarkdown(stripFrontmatter(raw)).replace(/^\s*#\s+[^\n]*\n+/, "");
  const toc = extractToc(content);
  const { prev, next } = adjacentInNav(sections, slug);
  return { item, content, toc, section: sectionTitleForSlug(sections, slug), prev, next };
}

export function docBlurb(label: string, item: NavItem): string {
  const version = resolveVersion(label);
  const raw = fs.readFileSync(filePathFor(version, item), "utf8");
  return firstParagraph(cleanMarkdown(stripFrontmatter(raw)));
}

// All (version, slug) pairs for generateStaticParams across the doc routes.
export function allDocParams(): { version: string; slug: string[] }[] {
  const out: { version: string; slug: string[] }[] = [];
  for (const label of versionLabels()) {
    for (const item of flattenNav(getNav(label))) {
      out.push({ version: label, slug: item.slug.split("/") });
    }
  }
  return out;
}

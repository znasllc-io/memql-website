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

/**
 * The versions this build PUBLISHES — by default, only the newest.
 *
 * WHY NOT ALL OF THEM. The registry carries every engine release that has ever
 * shipped docs, and each one is a complete 108-page manual. Building all of
 * them produced a 5.5 GB site (8436 pages) that exhausted the CI runner's disk
 * — and 96-99% of it was duplication: consecutive patch releases differ by one
 * file out of 108. Publishing the newest alone is 108 pages and ~81 MB.
 *
 * NOTHING IS LOST. Every version stays committed under src/content/docs/. This
 * function decides what gets RENDERED, not what is kept — restoring an older
 * line is this one setting, not a recovery job.
 *
 * DOCS_PUBLISH_VERSIONS overrides it without a code change:
 *   "all"                     every version in the registry
 *   "0.21.25,0.20.28,0.19.9"  exactly those (unknown ones ignored)
 * Use it to republish an older line for a client still running that engine —
 * memQL's own rule is docs version == engine release.
 */
export function publishedVersions(): string[] {
  const registry = getRegistry();
  const known = registry.versions.map((v) => v.version);
  const override = (process.env.DOCS_PUBLISH_VERSIONS ?? "").trim();

  if (override === "all") return known;
  if (override) {
    const asked = override.split(",").map((s) => s.trim()).filter(Boolean);
    const found = asked.filter((v) => known.includes(v));
    // A typo here would silently publish less than intended, and the symptom
    // is a 404 nobody connects back to an env var.
    for (const miss of asked.filter((v) => !known.includes(v))) {
      console.warn(`[docs] DOCS_PUBLISH_VERSIONS names ${miss}, which is not in versions.json — ignored`);
    }
    if (found.length) return found;
  }
  return [registry.latest];
}

// Every routable version label, including the "latest" alias. Deliberately the
// PUBLISHED set: offering a version in the picker that was never built is a
// link straight to a 404.
export function versionLabels(): string[] {
  return ["latest", ...publishedVersions()];
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

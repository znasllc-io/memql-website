#!/usr/bin/env node
/**
 * Land old /docs/<version> URLs on /docs/latest instead of a 404.
 *
 * The site publishes only the newest docs version (src/lib/docs.ts ->
 * publishedVersions); every other release stays committed but is not rendered.
 * Without this, a link to /docs/0.19.4 — which this site used to serve — simply
 * dies. A redirect is not as good as the page, but it is much better than
 * nothing, and it tells a reader where the docs went.
 *
 * WHAT THIS DOES NOT COVER, deliberately: deep links like
 * /docs/0.19.4/operate/env-vars. Covering those would mean emitting a stub per
 * page per retired version — roughly 9400 files to serve a redirect apiece —
 * which trades the size problem this change exists to fix for a file-count one.
 * Those 404, which is honest: that page is genuinely not published.
 *
 * Usage: node scripts/make-version-redirects.mjs   (npm `postbuild`)
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "out", "docs");
const REGISTRY = path.join(ROOT, "src", "content", "docs", "versions.json");

const attr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function stub(version, target) {
  const href = attr(target);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>memQL docs ${attr(version)} — moved</title>
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="https://memql.io${href}">
<meta http-equiv="refresh" content="0; url=${href}">
</head>
<body>
<p>Documentation for <strong>${attr(version)}</strong> is no longer published on this site.
You are being sent to <a href="${href}">the current documentation</a>.</p>
</body>
</html>
`;
}

function main() {
  if (!fs.existsSync(OUT)) {
    console.error("make-version-redirects: no out/docs — run `next build` first.");
    process.exit(1);
  }

  const { latest, versions } = JSON.parse(fs.readFileSync(REGISTRY, "utf8"));
  let written = 0;

  for (const { version } of versions) {
    // Anything this build actually rendered keeps its own pages.
    if (fs.existsSync(path.join(OUT, version))) continue;
    fs.writeFileSync(path.join(OUT, `${version}.html`), stub(version, "/docs/latest"));
    written++;
  }

  console.log(
    `make-version-redirects: ${written} retired version(s) point at /docs/latest ` +
      `(published: ${latest})`,
  );
}

main();

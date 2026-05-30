// Build-time GitHub star fetch. Runs as npm `prebuild` so the count is
// inlined into the static export. Network failure is non-fatal: we keep
// whatever value is already in src/lib/stars.ts (the committed default),
// so a CI blip never breaks `next build`.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = join(__dirname, "..", "src", "lib", "stars.ts");

const REPO = "znasllc-io/MemQL";

async function main() {
  let stars = null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`https://api.github.com/repos/${REPO}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "memql-website-build" },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (res.ok) {
      const json = await res.json();
      if (typeof json.stargazers_count === "number") stars = json.stargazers_count;
    } else {
      console.warn(`[fetch-stars] GitHub responded ${res.status}; keeping baked value.`);
    }
  } catch (e) {
    console.warn(`[fetch-stars] fetch failed (${e?.message ?? e}); keeping baked value.`);
  }

  if (stars === null) return; // keep committed default

  const current = await readFile(file, "utf8");
  const next = current.replace(/export const GH_STARS = \d+;/, `export const GH_STARS = ${stars};`);
  if (next !== current) {
    await writeFile(file, next, "utf8");
    console.log(`[fetch-stars] baked GH_STARS = ${stars}`);
  } else {
    console.log(`[fetch-stars] GH_STARS already ${stars}; no change.`);
  }
}

main();

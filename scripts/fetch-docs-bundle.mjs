// Pull a memQL release's documentation bundle into the versioned content tree.
//
//   node scripts/fetch-docs-bundle.mjs            # newest published release
//   node scripts/fetch-docs-bundle.mjs 0.9.30     # a specific version
//
// The engine repo (znasllc-io/memql) attaches a `docs-<X.Y.Z>.tgz` asset to
// every GitHub Release: the docs/public markdown tree + manifest.json. We
// unpack it into src/content/docs/<X.Y.Z>/ and register it in versions.json,
// where `latest` tracks the newest pulled version. The site renders from that
// tree — it never authors canonical prose itself.
//
// Network failure is non-fatal so a CI blip never breaks `next build`: if the
// requested bundle is already on disk we keep it; otherwise we exit 0 with a
// warning and the build proceeds with whatever versions are committed.
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CONTENT_DIR = join(ROOT, "src", "content", "docs");
const VERSIONS_FILE = join(CONTENT_DIR, "versions.json");

const REPO = "znasllc-io/memql";
const UA = "memql-website-build";
const requested = process.argv[2]?.replace(/^v/, "") || null;

async function gh(path) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": UA,
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// Resolve the version to pull and the asset's download URL.
async function resolveTarget() {
  if (requested) {
    const rel = await gh(`/releases/tags/${requested}`).catch(() => gh(`/releases/tags/v${requested}`));
    return assetFor(rel, requested);
  }
  const latest = await gh(`/releases/latest`);
  const version = latest.tag_name.replace(/^v/, "");
  return assetFor(latest, version);
}

function assetFor(release, version) {
  const name = `docs-${version}.tgz`;
  const asset = (release.assets || []).find((a) => a.name === name);
  if (!asset) throw new Error(`release ${version} has no asset ${name}`);
  return { version, name, url: asset.browser_download_url };
}

async function download(url, dest) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: ctrl.signal });
    if (!res.ok) throw new Error(`download ${url} -> ${res.status}`);
    await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  } finally {
    clearTimeout(t);
  }
}

async function registerVersion(version, engineVersion) {
  let reg = { latest: version, versions: [] };
  if (existsSync(VERSIONS_FILE)) {
    try {
      reg = JSON.parse(await readFile(VERSIONS_FILE, "utf8"));
    } catch {
      /* corrupt registry — rebuild from this pull */
    }
  }
  reg.versions = (reg.versions || []).filter((v) => v.version !== version);
  reg.versions.push({ version, engineVersion });
  // Newest semver first; `latest` points at the top.
  reg.versions.sort((a, b) => cmpSemver(b.version, a.version));
  reg.latest = reg.versions[0].version;
  await writeFile(VERSIONS_FILE, `${JSON.stringify(reg, null, 2)}\n`, "utf8");
}

function cmpSemver(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

async function main() {
  let target;
  try {
    target = await resolveTarget();
  } catch (e) {
    console.warn(`[fetch-docs] could not resolve a release (${e?.message ?? e}); keeping committed versions.`);
    return;
  }

  const outDir = join(CONTENT_DIR, target.version);
  if (existsSync(join(outDir, "manifest.json")) && !process.env.FORCE_REFETCH) {
    console.log(`[fetch-docs] ${target.version} already present; skipping (FORCE_REFETCH=1 to override).`);
    return;
  }

  const work = await mkdtemp(join(tmpdir(), "memql-docs-"));
  const tgz = join(work, target.name);
  try {
    console.log(`[fetch-docs] downloading ${target.name}…`);
    await download(target.url, tgz);
    await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });
    await exec("tar", ["xzf", tgz, "-C", outDir]);

    const manifest = JSON.parse(await readFile(join(outDir, "manifest.json"), "utf8"));
    await registerVersion(manifest.version, manifest.engineVersion);
    console.log(`[fetch-docs] unpacked ${manifest.version} (engine ${manifest.engineVersion}, ${manifest.pageCount} pages).`);
  } catch (e) {
    console.warn(`[fetch-docs] failed (${e?.message ?? e}); keeping committed versions.`);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

main();

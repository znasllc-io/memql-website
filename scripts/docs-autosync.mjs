// docs-autosync.mjs — keep the site's versioned docs in step with the engine.
//
//   node scripts/docs-autosync.mjs
//
// The site renders docs from a per-release bundle the engine produces; it never
// authors canonical prose. Historically the engine's release pipeline attached
// a `docs-<X.Y.Z>.tgz` asset to each GitHub Release and the site just unpacked
// it (see fetch-docs-bundle.mjs). That asset stopped being published after
// 0.11.2, so the site silently fell behind. This job closes that gap:
//
//   1. List the engine's release tags (X.Y.Z) via `gh` (uses your gh auth).
//   2. Diff them against src/content/docs/versions.json.
//   3. For each MISSING release at/above FLOOR, obtain its docs bundle:
//        - fast path: download the release's docs-<v>.tgz asset if present
//          (works again automatically once the engine pipeline re-attaches it);
//        - fallback: build it from the tag with the engine's OWN
//          scripts/docs/build-docs-bundle.sh, in a private cache clone.
//   4. Unpack into src/content/docs/<v>/ and register it in versions.json.
//
// Everything lands UNCOMMITTED in the working tree. Nothing goes live until a
// human reviews on localhost and pushes to main — that push is the green flag.
// Deterministic tooling only: no model authors docs here.
//
// Env knobs:
//   DOCS_ENGINE_REPO   default "znasllc-io/memql"
//   DOCS_AUTOSYNC_FLOOR default "0.12.0" (oldest tag the bundle builder supports)
//   DOCS_AUTOSYNC_FORCE comma list of versions to (re)import even if present
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CONTENT_DIR = join(ROOT, "src", "content", "docs");
const VERSIONS_FILE = join(CONTENT_DIR, "versions.json");

const REPO = process.env.DOCS_ENGINE_REPO || "znasllc-io/memql";
const FLOOR = process.env.DOCS_AUTOSYNC_FLOOR || "0.12.0";
const FORCE = (process.env.DOCS_AUTOSYNC_FORCE || "").split(",").map((s) => s.trim()).filter(Boolean);
const CACHE = join(process.env.XDG_CACHE_HOME || join(homedir(), ".cache"), "memql-docs-autosync");
const ENGINE_DIR = join(CACHE, "engine");
const SEMVER = /^\d+\.\d+\.\d+$/;

const run = (cmd, args, opts = {}) =>
  exec(cmd, args, { maxBuffer: 64 * 1024 * 1024, ...opts });

function cmpSemver(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}

async function readRegistry() {
  if (!existsSync(VERSIONS_FILE)) return { latest: null, versions: [] };
  try {
    return JSON.parse(await readFile(VERSIONS_FILE, "utf8"));
  } catch {
    return { latest: null, versions: [] };
  }
}

async function registerVersion(version, engineVersion) {
  const reg = await readRegistry();
  reg.versions = (reg.versions || []).filter((v) => v.version !== version);
  reg.versions.push({ version, engineVersion });
  reg.versions.sort((a, b) => cmpSemver(b.version, a.version));
  reg.latest = reg.versions[0].version;
  await writeFile(VERSIONS_FILE, `${JSON.stringify(reg, null, 2)}\n`, "utf8");
}

async function listEngineReleaseTags() {
  // gh api --paginate concatenates the array pages into one JSON array.
  const { stdout } = await run("gh", [
    "api", "--paginate", `/repos/${REPO}/tags?per_page=100`, "-q", ".[].name",
  ]);
  return stdout.split("\n").map((s) => s.trim()).filter((s) => SEMVER.test(s));
}

let engineReady = false;
async function ensureEngineClone() {
  if (engineReady) return;
  await mkdir(CACHE, { recursive: true });
  if (!existsSync(join(ENGINE_DIR, ".git"))) {
    console.log(`[autosync] cloning ${REPO} (blobless) into ${ENGINE_DIR}…`);
    await run("gh", ["repo", "clone", REPO, ENGINE_DIR, "--", "--filter=blob:none"]);
  }
  await run("git", ["-C", ENGINE_DIR, "fetch", "--tags", "--force", "--prune", "origin"]);
  engineReady = true;
}

// Return path to a docs-<version>.tgz, or throw. Tries the release asset first,
// then builds from the tag with the engine's own bundle script.
async function obtainBundle(version) {
  const dest = join(CACHE, `docs-${version}.tgz`);
  await mkdir(CACHE, { recursive: true });
  await rm(dest, { force: true });

  // fast path — release asset
  try {
    const { stdout } = await run("gh", ["release", "view", version, "--repo", REPO, "--json", "assets", "-q", ".assets[].name"]);
    if (stdout.split("\n").map((s) => s.trim()).includes(`docs-${version}.tgz`)) {
      await run("gh", ["release", "download", version, "--repo", REPO, "--pattern", `docs-${version}.tgz`, "--dir", CACHE, "--clobber"]);
      if (existsSync(dest)) {
        console.log(`[autosync] ${version}: downloaded release asset`);
        return { tgz: dest, source: "release-asset" };
      }
    }
  } catch {
    /* no release / no asset — fall through to build */
  }

  // fallback — build from the tag
  await ensureEngineClone();
  console.log(`[autosync] ${version}: building from tag (engine build-docs-bundle.sh)…`);
  await run("git", ["-C", ENGINE_DIR, "checkout", "--detach", "--force", version]);
  await run("bash", [join(ENGINE_DIR, "scripts/docs/build-docs-bundle.sh"), `--version=${version}`], {
    cwd: ENGINE_DIR,
    env: { ...process.env, GOWORK: "off" },
  });
  const built = join(ENGINE_DIR, `docs-${version}.tgz`);
  if (!existsSync(built)) throw new Error("build produced no tarball");
  await rename(built, dest).catch(async () => {
    await run("cp", [built, dest]);
  });
  return { tgz: dest, source: "built-from-tag" };
}

async function importVersion(version) {
  const { tgz, source } = await obtainBundle(version);
  const tmp = join(CONTENT_DIR, `.tmp-${version}`);
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });
  await run("tar", ["xzf", tgz, "-C", tmp]);

  const manifest = JSON.parse(await readFile(join(tmp, "manifest.json"), "utf8"));
  if (!manifest.version || !(manifest.pageCount > 0)) {
    await rm(tmp, { recursive: true, force: true });
    throw new Error(`invalid manifest (version=${manifest.version} pageCount=${manifest.pageCount})`);
  }

  const outDir = join(CONTENT_DIR, version);
  await rm(outDir, { recursive: true, force: true });
  await rename(tmp, outDir);
  await registerVersion(manifest.version, manifest.engineVersion);
  console.log(`[autosync] imported ${manifest.version} (engine ${manifest.engineVersion}, ${manifest.pageCount} pages, ${source})`);
}

async function main() {
  let tags;
  try {
    tags = await listEngineReleaseTags();
  } catch (e) {
    console.warn(`[autosync] could not list engine tags (${e?.message ?? e}); keeping committed versions.`);
    console.log("AUTOSYNC_RESULT added= failed= note=list-tags-failed");
    return;
  }

  const reg = await readRegistry();
  const present = new Set((reg.versions || []).map((v) => v.version));
  const wanted = tags
    .filter((t) => cmpSemver(t, FLOOR) >= 0)
    .filter((t) => FORCE.includes(t) || !present.has(t))
    .sort(cmpSemver);

  if (wanted.length === 0) {
    console.log(`[autosync] up to date — latest ${reg.latest}, ${present.size} versions present.`);
    console.log("AUTOSYNC_RESULT added= failed=");
    return;
  }

  console.log(`[autosync] to import: ${wanted.join(", ")}`);
  const added = [], failed = [];
  for (const v of wanted) {
    try {
      await importVersion(v);
      added.push(v);
    } catch (e) {
      console.warn(`[autosync] ${v} FAILED: ${e?.message ?? e}`);
      failed.push(v);
    }
  }
  console.log(`AUTOSYNC_RESULT added=${added.join(",")} failed=${failed.join(",")}`);
}

main().catch((e) => {
  console.warn(`[autosync] fatal: ${e?.message ?? e}`);
  console.log("AUTOSYNC_RESULT added= failed= note=fatal");
});

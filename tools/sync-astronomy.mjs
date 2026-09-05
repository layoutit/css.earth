#!/usr/bin/env node
// Vendors @galaxio/astronomy into src/astronomy as a byte-identical copy.
//
// The script copies every file under galaxio's packages/astronomy/src, carries
// the MIT licence across, and writes upstream.json: the upstream commit, the
// sync date, and a per-file SHA-256 manifest. The manifest is what the test in
// tools/sync-astronomy.test.mjs checks, so any local edit to a vendored file
// fails loudly instead of silently diverging from upstream.
//
// Re-run it to pull upstream fixes:
//
//   node tools/sync-astronomy.mjs
//   GALAXIO_ASTRONOMY_SRC=/path/to/galaxio/packages/astronomy/src node tools/sync-astronomy.mjs
//
// Never hand-edit src/astronomy: the sync overwrites it. Nothing is rewritten
// on the way in; see upstream.json for the open question about Node-side
// consumption of the `.js` specifiers.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const DEFAULT_ASTRONOMY_SRC =
  "/Users/apresmoi/Documents/galaxio/packages/astronomy/src";

export const VENDOR_DIR = fileURLToPath(new URL("../src/astronomy/", import.meta.url));
export const PROVENANCE_FILE = "upstream.json";
export const LICENSE_FILE = "LICENSE.GALAXIO-MIT";

// Files cssEarth owns inside the vendor directory. Everything else there is
// upstream material and is replaced wholesale on every sync.
export const OWNED_FILES = Object.freeze([PROVENANCE_FILE, LICENSE_FILE, "SOURCE.md", "NOTICE.md"]);

const IMPORT_NOTE =
  "The TypeScript source imports relative modules as `./x.js` while the files " +
  "are `./x.ts` (the TS/ESM convention). Vite and Astro resolve that natively, " +
  "so browser-side consumption works verbatim. Node does not: importing " +
  "index.ts directly fails on the first `.js` specifier. When a Node-side " +
  "consumer is wired (tools/prepare-solar-geometry.mjs is the obvious first), " +
  "one of these is needed: a sync-time specifier rewrite of `.js` to `.ts`, a " +
  "small module-resolver hook, or a build step. None is chosen yet; the tree " +
  "stays byte-identical to upstream until that decision is made.";

export async function listFiles(root) {
  const files = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) files.push(path);
    }
  }
  await walk(root);
  return files;
}

const toPosix = (path) => path.split(sep).join("/");

export async function listVendoredFiles(dir = VENDOR_DIR) {
  const files = await listFiles(dir);
  return files.filter((path) => !OWNED_FILES.includes(relative(dir, path)));
}

export async function sha256File(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

// Per-file manifest: { "relative/path.ts": { sha256, bytes } }, sorted by path.
export async function buildManifest(dir = VENDOR_DIR) {
  const files = {};
  for (const path of await listVendoredFiles(dir)) {
    const content = await readFile(path);
    files[toPosix(relative(dir, path))] = {
      sha256: createHash("sha256").update(content).digest("hex"),
      bytes: content.length,
    };
  }
  return files;
}

export async function readProvenance(dir = VENDOR_DIR) {
  return JSON.parse(await readFile(join(dir, PROVENANCE_FILE), "utf8"));
}

// Compares the vendored tree against the manifest in upstream.json. Returns a
// list of problems; an empty list means the copy is pristine.
export async function manifestProblems(dir = VENDOR_DIR) {
  const provenance = await readProvenance(dir);
  const expected = provenance.files ?? {};
  const actual = await buildManifest(dir);
  const problems = [];
  for (const [path, entry] of Object.entries(expected)) {
    if (!(path in actual)) problems.push(`${path} is listed in ${PROVENANCE_FILE} but missing`);
    else if (actual[path].sha256 !== entry.sha256) problems.push(`${path} differs from upstream`);
  }
  for (const path of Object.keys(actual)) {
    if (!(path in expected)) problems.push(`${path} is not listed in ${PROVENANCE_FILE}`);
  }
  return problems;
}

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
    .trim();
}

function upstreamIdentity(src) {
  const root = git(src, "rev-parse", "--show-toplevel");
  let remote = null;
  try {
    remote = git(src, "remote", "get-url", "origin").replace(
      /^git@github\.com:/,
      "https://github.com/",
    );
  } catch {
    // A checkout without an origin still has a commit to record.
  }
  return {
    root,
    remote,
    directory: toPosix(relative(root, src)),
    dirty: git(src, "status", "--porcelain", "--", ".") !== "",
    headCommit: git(src, "rev-parse", "HEAD"),
    subtreeCommit: git(src, "log", "-1", "--format=%H", "--", "."),
    subtreeCommitDate: git(src, "log", "-1", "--format=%cI", "--", "."),
  };
}

async function removeEmptyDirectories(root) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(root, entry.name);
    await removeEmptyDirectories(path);
    if ((await readdir(path)).length === 0) await rm(path, { recursive: true });
  }
}

export async function syncAstronomy({
  src = process.env.GALAXIO_ASTRONOMY_SRC ?? DEFAULT_ASTRONOMY_SRC,
  dest = VENDOR_DIR,
  allowDirty = false,
  log = console.log,
} = {}) {
  src = resolve(src);
  if (!existsSync(join(src, "index.ts"))) {
    throw new Error(
      `No astronomy source at ${src}. Set GALAXIO_ASTRONOMY_SRC to the galaxio ` +
        `packages/astronomy/src directory.`,
    );
  }
  const upstream = upstreamIdentity(src);
  if (upstream.dirty && !allowDirty) {
    throw new Error(
      `${src} has uncommitted changes; commit them upstream so the recorded ` +
        `commit is truthful, or pass --allow-dirty.`,
    );
  }
  const licensePath = join(upstream.root, "LICENSE");
  const license = await readFile(licensePath, "utf8");
  if (!/MIT License/.test(license)) {
    throw new Error(`${licensePath} does not read as the expected MIT licence.`);
  }

  let previous = null;
  try {
    previous = await readProvenance(dest);
  } catch {
    // First sync.
  }

  // Replace every upstream file. Owned files (provenance, licence, notices)
  // survive; stale upstream files do not.
  await mkdir(dest, { recursive: true });
  for (const path of await listVendoredFiles(dest)) await rm(path);
  await removeEmptyDirectories(dest);

  for (const path of await listFiles(src)) {
    const rel = relative(src, path);
    if (OWNED_FILES.includes(rel)) {
      throw new Error(`Upstream now ships ${rel}, which collides with a cssEarth-owned file.`);
    }
    const target = join(dest, rel);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, await readFile(path));
  }
  await writeFile(join(dest, LICENSE_FILE), license);

  const files = await buildManifest(dest);
  const byteCount = Object.values(files).reduce((sum, entry) => sum + entry.bytes, 0);
  const fileCount = Object.keys(files).length;
  const unchanged =
    previous !== null &&
    previous.subtreeCommit === upstream.subtreeCommit &&
    JSON.stringify(previous.files) === JSON.stringify(files);

  const provenance = {
    package: "@galaxio/astronomy",
    license: "MIT",
    licenseFile: LICENSE_FILE,
    repository: upstream.remote ?? "https://github.com/apresmoi/galaxio.git",
    directory: upstream.directory,
    subtreeCommit: upstream.subtreeCommit,
    subtreeCommitDate: upstream.subtreeCommitDate,
    headCommit: upstream.headCommit,
    upstreamDirty: upstream.dirty,
    syncedAt: unchanged ? previous.syncedAt : new Date().toISOString(),
    syncScript: "tools/sync-astronomy.mjs",
    transform: "none: every file is byte-identical to upstream",
    importNote: IMPORT_NOTE,
    fileCount,
    byteCount,
    files,
  };
  await writeFile(join(dest, PROVENANCE_FILE), `${JSON.stringify(provenance, null, 2)}\n`);

  const problems = await manifestProblems(dest);
  if (problems.length > 0) {
    throw new Error(`Manifest does not match the copied tree:\n  ${problems.join("\n  ")}`);
  }

  log(
    `Vendored @galaxio/astronomy@${upstream.subtreeCommit.slice(0, 12)} ` +
      `(${fileCount} files, ${byteCount} bytes) into ` +
      `${relative(process.cwd(), dest) || "."}${unchanged ? " — unchanged" : ""}`,
  );
  return provenance;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await syncAstronomy({ allowDirty: process.argv.includes("--allow-dirty") }).catch((error) => {
    console.error(`sync-astronomy failed: ${error.message}`);
    process.exit(1);
  });
}

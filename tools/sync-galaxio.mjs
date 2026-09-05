#!/usr/bin/env node
// Vendors galaxio's astronomy and catalog packages and its prepared point
// catalogues into cssEarth, mirroring galaxio's own layout so a sync is a
// directory-to-directory copy:
//
//   packages/astronomy   <-  <galaxio>/packages/astronomy   (git-tracked files)
//   packages/catalog     <-  <galaxio>/packages/catalog     (git-tracked files)
//   data/catalogs/<name> <-  <galaxio>/data/catalogs/<name> (VENDORED_CATALOGS)
//
// Package files are copied byte-for-byte except for one deliberate rewrite:
// galaxio's identity becomes cssEarth's in the package name and in prose
// (IDENTITY_RULES). Code, import specifiers, data, and every other file are
// untouched; the per-file manifest in each upstream.json records both the
// vendored hash and, for rewritten files, the upstream hash, so the claim
// "byte-identical apart from the identity replacements" is checkable.
//
// The catalogues are generated output that galaxio does not commit (its
// data/ directory is gitignored and built by pipeline/), so they carry no
// upstream commit of their own. Their provenance records the galaxio checkout
// that held them, the manifest entry each was published under, and their
// hashes. Two catalogues are deliberately not vendored; see EXCLUDED_CATALOGS.
//
// Re-run to pull upstream changes (idempotent; unchanged input is a no-op):
//
//   node tools/sync-galaxio.mjs
//   GALAXIO_ROOT=/path/to/galaxio node tools/sync-galaxio.mjs
//
// Never hand-edit the vendored trees: the sync overwrites them and
// tools/sync-galaxio.test.mjs fails on any drift.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync } from "node:fs";
import { mkdir, readdir, readFile, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const DEFAULT_GALAXIO_ROOT = "/Users/apresmoi/Documents/galaxio";
export const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));

export const PROVENANCE_FILE = "upstream.json";
export const LICENSE_FILE = "LICENSE.GALAXIO-MIT";
export const GALAXIO_REPOSITORY = "https://github.com/apresmoi/galaxio";
export const CSSEARTH_REPOSITORY = "https://github.com/layoutit/cssEarth";

// The only edit applied to upstream files: galaxio's identity becomes
// cssEarth's in package names and in prose. Each rule names the files it may
// touch; nothing under src/, tools/, or scripts/ is matched.
export const IDENTITY_RULES = Object.freeze([
  {
    id: "package-name",
    files: /^package\.json$/,
    from: /^(\s*"name":\s*")@galaxio\//m,
    to: "$1@cssearth/",
    description: 'package.json "name": @galaxio/<pkg> -> @cssearth/<pkg>',
  },
  {
    id: "prose-package-name",
    files: /(^|\/)[^/]+\.md$/,
    from: /@galaxio\//g,
    to: "@cssearth/",
    description: "*.md: @galaxio/<pkg> -> @cssearth/<pkg> (headings, install and import examples)",
  },
  {
    id: "prose-project-link",
    files: /(^|\/)[^/]+\.md$/,
    from: /\[Galaxio\]\(https:\/\/github\.com\/apresmoi\/galaxio\)/g,
    to: `[cssEarth](${CSSEARTH_REPOSITORY})`,
    description: "*.md: the [Galaxio](repo) project link -> [cssEarth](repo)",
  },
]);

export const PACKAGES = Object.freeze([
  {
    id: "astronomy",
    upstreamDirectory: "packages/astronomy",
    directory: "packages/astronomy",
    upstreamPackage: "@galaxio/astronomy",
    package: "@cssearth/astronomy",
    entry: "src/index.ts",
  },
  {
    id: "catalog",
    upstreamDirectory: "packages/catalog",
    directory: "packages/catalog",
    upstreamPackage: "@galaxio/catalog",
    package: "@cssearth/catalog",
    entry: "src/index.ts",
  },
]);

export const CATALOGS_DIRECTORY = "data/catalogs";
export const CATALOGS_MANIFEST_FILE = "manifest.json";

// Catalogues copied whole from <galaxio>/data/catalogs/<name>, every v<N>
// directory included, with the galaxio builder that produced each one.
export const VENDORED_CATALOGS = Object.freeze({
  "stars-hyg": "pipeline/galaxio_pipeline/builders/stars.py",
  "constellations-iau": "pipeline/galaxio_pipeline/builders/constellations.py",
  deepsky: "pipeline/galaxio_pipeline/builders/deepsky.py",
  globulars: "pipeline/galaxio_pipeline/builders/globulars.py",
  "nebulae-planetary": "pipeline/galaxio_pipeline/builders/nebulae.py",
  snr: "pipeline/galaxio_pipeline/builders/snr.py",
  "hii-regions": "pipeline/galaxio_pipeline/builders/hii.py",
  exoplanets: "pipeline/galaxio_pipeline/builders/exoplanets.py",
});

// Catalogues present upstream and deliberately left out. The sync records
// their manifest entries (terms, source, size) so the exclusion is auditable
// without the data.
export const EXCLUDED_CATALOGS = Object.freeze({
  galaxies:
    "Deferred pending a licensing decision: its terms are VizieR scientific-use " +
    "terms plus a clause that commercial redistribution of the pre-2021 AAS " +
    "J/AJ/144/4 table requires permission, and css.earth is a public site. Not " +
    "vendored until that is resolved.",
  "nebula-imagery":
    "Not self-contained: a 15-row placement index for the textures/nebula-* and " +
    "volumes/nebula-* imagery assets, which stay upstream. Vendoring the index " +
    "without the imagery it places would be dead data.",
});

const IMPORT_NOTE =
  "The TypeScript source imports relative modules as `./x.js` while the files " +
  "are `./x.ts` (the TS/ESM convention). Vite and Astro resolve that natively, " +
  "so browser-side consumption works verbatim. Node does not: importing " +
  "src/index.ts directly fails on the first `.js` specifier. When a Node-side " +
  "consumer is wired (tools/prepare-solar-geometry.mjs is the obvious first), " +
  "one of these is needed: a sync-time specifier rewrite of `.js` to `.ts`, a " +
  "small module-resolver hook, or a build step. None is chosen yet; the source " +
  "stays as upstream wrote it until that decision is made.";

const toPosix = (path) => path.split(sep).join("/");

// Directories that are never upstream material: pnpm links a workspace
// package's devDependencies into its own node_modules, and a local build
// would emit dist. Both are gitignored and invisible to the manifest.
const IGNORED_DIRECTORIES = new Set(["node_modules", "dist"]);

function packageOwnedFiles() {
  return [PROVENANCE_FILE, LICENSE_FILE, "SOURCE.md", "NOTICE.md"];
}

// cssEarth-owned files inside a vendored directory. Everything else there is
// upstream material and is replaced wholesale on every sync.
export function isOwnedFile(target, rel) {
  rel = toPosix(rel);
  if (target.kind === "catalogs") {
    if (rel === PROVENANCE_FILE || rel === CATALOGS_MANIFEST_FILE) return true;
    if (rel === "SOURCE.md" || rel === "NOTICE.md") return true;
    return /^LICENSE\.[^/]+$/.test(rel);
  }
  return packageOwnedFiles().includes(rel);
}

export function targetFor(id) {
  const pkg = PACKAGES.find((entry) => entry.id === id);
  if (pkg) return { kind: "package", ...pkg, dest: join(REPO_ROOT, pkg.directory) };
  if (id === "catalogs") {
    return { kind: "catalogs", id, directory: CATALOGS_DIRECTORY, dest: join(REPO_ROOT, CATALOGS_DIRECTORY) };
  }
  throw new Error(`Unknown sync target ${id}`);
}

export const TARGETS = Object.freeze([...PACKAGES.map((pkg) => pkg.id), "catalogs"]);

export async function listFiles(root) {
  const files = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;
      const path = join(dir, entry.name);
      if (entry.isSymbolicLink()) files.push(path);
      else if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) files.push(path);
    }
  }
  await walk(root);
  return files;
}

export async function listVendoredFiles(target) {
  const files = await listFiles(target.dest);
  return files.filter((path) => !isOwnedFile(target, relative(target.dest, path)));
}

export function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

async function describeFile(path) {
  if (lstatSync(path).isSymbolicLink()) return { symlink: toPosix(await readlink(path)) };
  const content = await readFile(path);
  return { sha256: sha256(content), bytes: content.length };
}

// Per-file manifest from disk: { "relative/path": { sha256, bytes } | { symlink } },
// sorted by path. Provenance-only fields (upstreamSha256, identityRules) are
// not part of what disk can tell us and are added by the sync.
export async function buildManifest(target) {
  const files = {};
  for (const path of await listVendoredFiles(target)) {
    files[toPosix(relative(target.dest, path))] = await describeFile(path);
  }
  return files;
}

export async function readProvenance(target) {
  return JSON.parse(await readFile(join(target.dest, PROVENANCE_FILE), "utf8"));
}

const onDisk = ({ sha256, bytes, symlink }) => (symlink ? { symlink } : { sha256, bytes });

// Compares the vendored tree against the manifest in upstream.json. Returns a
// list of problems; an empty list means the copy is pristine.
export async function manifestProblems(target) {
  const provenance = await readProvenance(target);
  const expected = provenance.files ?? {};
  const actual = await buildManifest(target);
  const problems = [];
  for (const [path, entry] of Object.entries(expected)) {
    if (!(path in actual)) problems.push(`${path} is listed in ${PROVENANCE_FILE} but missing`);
    else if (JSON.stringify(onDisk(actual[path])) !== JSON.stringify(onDisk(entry))) {
      problems.push(`${path} differs from the recorded copy`);
    }
  }
  for (const path of Object.keys(actual)) {
    if (!(path in expected)) problems.push(`${path} is not listed in ${PROVENANCE_FILE}`);
  }
  return problems;
}

// Applies IDENTITY_RULES to one upstream file. Returns the (possibly
// unchanged) content and the ids of the rules that changed it.
export function applyIdentityRules(rel, content) {
  rel = toPosix(rel);
  const applied = [];
  let text = null;
  for (const rule of IDENTITY_RULES) {
    if (!rule.files.test(rel)) continue;
    text ??= content.toString("utf8");
    const next = text.replace(rule.from, rule.to);
    if (next !== text) {
      applied.push(rule.id);
      text = next;
    }
  }
  return applied.length > 0 ? { content: Buffer.from(text, "utf8"), applied } : { content, applied };
}

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
    .trim();
}

function upstreamIdentity(root) {
  let remote = null;
  try {
    remote = git(root, "remote", "get-url", "origin").replace(
      /^git@github\.com:/,
      "https://github.com/",
    );
  } catch {
    // A checkout without an origin still has a commit to record.
  }
  return {
    root: git(root, "rev-parse", "--show-toplevel"),
    remote,
    headCommit: git(root, "rev-parse", "HEAD"),
    headCommitDate: git(root, "log", "-1", "--format=%cI"),
  };
}

function subtreeIdentity(root, directory) {
  return {
    dirty: git(root, "status", "--porcelain", "--", directory) !== "",
    subtreeCommit: git(root, "log", "-1", "--format=%H", "--", directory),
    subtreeCommitDate: git(root, "log", "-1", "--format=%cI", "--", directory),
    trackedFiles: git(root, "ls-files", "-z", "--", directory).split("\0").filter(Boolean),
  };
}

async function removeEmptyDirectories(root) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || IGNORED_DIRECTORIES.has(entry.name)) continue;
    const path = join(root, entry.name);
    await removeEmptyDirectories(path);
    if ((await readdir(path)).length === 0) await rm(path, { recursive: true });
  }
}

async function clearVendored(target) {
  await mkdir(target.dest, { recursive: true });
  for (const path of await listVendoredFiles(target)) await rm(path);
  await removeEmptyDirectories(target.dest);
}

async function readPrevious(target) {
  try {
    return await readProvenance(target);
  } catch {
    return null;
  }
}

async function writeProvenance(target, provenance) {
  await writeFile(join(target.dest, PROVENANCE_FILE), `${JSON.stringify(provenance, null, 2)}\n`);
  const problems = await manifestProblems(target);
  if (problems.length > 0) {
    throw new Error(
      `${target.directory}: manifest does not match the copied tree:\n  ${problems.join("\n  ")}`,
    );
  }
}

const sumBytes = (files) =>
  Object.values(files).reduce((sum, entry) => sum + (entry.bytes ?? 0), 0);

function unchangedSince(previous, files, commitKey, commit) {
  return (
    previous !== null &&
    previous[commitKey] === commit &&
    JSON.stringify(previous.files) === JSON.stringify(files)
  );
}

async function syncPackage(pkg, { root, upstream, license, allowDirty, log }) {
  const target = targetFor(pkg.id);
  const upstreamDir = join(root, pkg.upstreamDirectory);
  if (!existsSync(join(upstreamDir, pkg.entry))) {
    throw new Error(`No ${pkg.upstreamPackage} source at ${upstreamDir}.`);
  }
  const subtree = subtreeIdentity(root, pkg.upstreamDirectory);
  if (subtree.dirty && !allowDirty) {
    throw new Error(
      `${upstreamDir} has uncommitted changes; commit them upstream so the recorded ` +
        `commit is truthful, or pass --allow-dirty.`,
    );
  }
  const previous = await readPrevious(target);
  await clearVendored(target);

  const files = {};
  const rewritten = {};
  for (const tracked of subtree.trackedFiles) {
    const rel = toPosix(relative(pkg.upstreamDirectory, tracked));
    if (isOwnedFile(target, rel)) {
      throw new Error(`Upstream now ships ${rel}, which collides with a cssEarth-owned file.`);
    }
    const source = join(root, tracked);
    const dest = join(target.dest, rel);
    await mkdir(dirname(dest), { recursive: true });
    if (lstatSync(source).isSymbolicLink()) {
      const link = await readlink(source);
      await symlink(link, dest);
      files[rel] = { symlink: toPosix(link) };
      continue;
    }
    const upstreamContent = await readFile(source);
    const { content, applied } = applyIdentityRules(rel, upstreamContent);
    await writeFile(dest, content);
    files[rel] = { sha256: sha256(content), bytes: content.length };
    if (applied.length > 0) {
      files[rel].upstreamSha256 = sha256(upstreamContent);
      files[rel].upstreamBytes = upstreamContent.length;
      files[rel].identityRules = applied;
      rewritten[rel] = applied;
    }
  }
  await writeFile(join(target.dest, LICENSE_FILE), license);

  const unchanged = unchangedSince(previous, files, "subtreeCommit", subtree.subtreeCommit);
  const provenance = {
    package: pkg.package,
    upstreamPackage: pkg.upstreamPackage,
    license: "MIT",
    licenseFile: LICENSE_FILE,
    repository: upstream.remote ?? `${GALAXIO_REPOSITORY}.git`,
    directory: pkg.upstreamDirectory,
    subtreeCommit: subtree.subtreeCommit,
    subtreeCommitDate: subtree.subtreeCommitDate,
    headCommit: upstream.headCommit,
    upstreamDirty: subtree.dirty,
    syncedAt: unchanged ? previous.syncedAt : new Date().toISOString(),
    syncScript: "tools/sync-galaxio.mjs",
    transform:
      "identity only: files listed under identityRules had galaxio's identity " +
      "replaced by cssEarth's (see rules); every other file is byte-identical to upstream",
    identityRules: Object.fromEntries(
      IDENTITY_RULES.map((rule) => [rule.id, rule.description]),
    ),
    rewrittenFiles: rewritten,
    importNote: IMPORT_NOTE,
    fileCount: Object.keys(files).length,
    byteCount: sumBytes(files),
    files,
  };
  await writeProvenance(target, provenance);
  log(
    `Vendored ${pkg.upstreamPackage}@${subtree.subtreeCommit.slice(0, 12)} as ${pkg.package} ` +
      `(${provenance.fileCount} files, ${provenance.byteCount} bytes, ` +
      `${Object.keys(rewritten).length} identity-rewritten) into ${pkg.directory}` +
      `${unchanged ? " — unchanged" : ""}`,
  );
  return provenance;
}

async function syncCatalogs({ root, upstream, log }) {
  const target = targetFor("catalogs");
  const manifestPath = join(root, "data", "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`No data manifest at ${manifestPath}; build galaxio's data/ first.`);
  }
  const manifestBytes = await readFile(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const assets = manifest.assets ?? {};

  const entryFor = (name) => {
    const entry = assets[`catalogs/${name}`];
    if (!entry) throw new Error(`galaxio data/manifest.json has no entry for catalogs/${name}.`);
    return entry;
  };
  for (const [name, builder] of Object.entries(VENDORED_CATALOGS)) {
    if (!existsSync(join(root, "data", "catalogs", name))) {
      throw new Error(`No catalogue directory at ${join(root, "data", "catalogs", name)}.`);
    }
    if (!existsSync(join(root, builder))) {
      throw new Error(`Builder ${builder} for ${name} is missing upstream; update VENDORED_CATALOGS.`);
    }
    entryFor(name);
  }

  const previous = await readPrevious(target);
  await clearVendored(target);

  const files = {};
  const catalogs = {};
  for (const [name, builder] of Object.entries(VENDORED_CATALOGS)) {
    const entry = entryFor(name);
    const upstreamDir = join(root, "data", "catalogs", name);
    const catalogFiles = [];
    for (const path of await listFiles(upstreamDir)) {
      const rel = toPosix(relative(join(root, "data", "catalogs"), path));
      const dest = join(target.dest, rel);
      await mkdir(dirname(dest), { recursive: true });
      const content = await readFile(path);
      await writeFile(dest, content);
      files[rel] = { sha256: sha256(content), bytes: content.length };
      catalogFiles.push(rel);
    }
    const current = toPosix(relative("catalogs", entry.path));
    if (!(current in files)) {
      throw new Error(`Manifest path ${entry.path} for ${name} was not found under ${upstreamDir}.`);
    }
    catalogs[name] = {
      key: entry.key,
      current,
      currentSha256: files[current].sha256,
      supersededVersions: catalogFiles.filter((rel) => rel !== current),
      builder,
      manifestEntry: entry,
    };
  }

  const subset = {
    version: manifest.version,
    assets: Object.fromEntries(
      Object.keys(VENDORED_CATALOGS).map((name) => [`catalogs/${name}`, assets[`catalogs/${name}`]]),
    ),
  };
  await writeFile(
    join(target.dest, CATALOGS_MANIFEST_FILE),
    `${JSON.stringify(subset, null, 2)}\n`,
  );

  const excluded = Object.fromEntries(
    Object.entries(EXCLUDED_CATALOGS).map(([name, reason]) => {
      const entry = assets[`catalogs/${name}`];
      return [
        name,
        {
          reason,
          manifestEntry: entry
            ? {
                key: entry.key,
                path: entry.path,
                bytes: entry.bytes,
                source: entry.source,
                license: entry.license,
                url: entry.url,
                built: entry.built,
              }
            : null,
        },
      ];
    }),
  );

  const unchanged = unchangedSince(previous, files, "galaxioHeadCommit", upstream.headCommit);
  const provenance = {
    dataset: "galaxio data/catalogs (prepared .gxct point catalogues)",
    format: "@cssearth/catalog .gxct (packages/catalog/FORMAT.md)",
    repository: upstream.remote ?? `${GALAXIO_REPOSITORY}.git`,
    directory: "data/catalogs",
    upstreamTracked: false,
    upstreamTrackingNote:
      "galaxio gitignores data/ (only data/manifest.example.json is committed); the " +
      "catalogues are generated by galaxio's pipeline/ and published to its CDN. There " +
      "is no upstream commit for the data itself. galaxioHeadCommit is the checkout " +
      "whose data/ directory was copied, and each catalogue records the builder and " +
      "the manifest entry (with its built date) it was published under.",
    galaxioHeadCommit: upstream.headCommit,
    galaxioHeadCommitDate: upstream.headCommitDate,
    upstreamManifest: {
      path: "data/manifest.json",
      sha256: sha256(manifestBytes),
      bytes: manifestBytes.length,
      version: manifest.version,
    },
    syncedAt: unchanged ? previous.syncedAt : new Date().toISOString(),
    syncScript: "tools/sync-galaxio.mjs",
    transform:
      "none: every catalogue file is byte-identical to the upstream data/catalogs " +
      "directory; manifest.json is the catalogs/* subset of galaxio's data/manifest.json " +
      "restricted to the vendored catalogues",
    licenseNote:
      "These datasets are not MIT. Each catalogue carries its own terms, recorded per " +
      "catalogue below under manifestEntry.license / .url and spelled out with the " +
      "required attribution in NOTICE.md and the LICENSE.* files beside this manifest.",
    catalogs,
    excluded,
    fileCount: Object.keys(files).length,
    byteCount: sumBytes(files),
    files,
  };
  await writeProvenance(target, provenance);
  log(
    `Vendored ${Object.keys(catalogs).length} catalogues from galaxio@` +
      `${upstream.headCommit.slice(0, 12)} (${provenance.fileCount} files, ` +
      `${provenance.byteCount} bytes) into ${CATALOGS_DIRECTORY}` +
      `${unchanged ? " — unchanged" : ""}; excluded: ${Object.keys(excluded).join(", ")}`,
  );
  return provenance;
}

export async function syncGalaxio({
  root = process.env.GALAXIO_ROOT ?? DEFAULT_GALAXIO_ROOT,
  allowDirty = false,
  log = console.log,
} = {}) {
  root = resolve(root);
  if (!existsSync(join(root, "packages", "astronomy", "src", "index.ts"))) {
    throw new Error(`No galaxio checkout at ${root}. Set GALAXIO_ROOT to the galaxio repository root.`);
  }
  const upstream = upstreamIdentity(root);
  const licensePath = join(upstream.root, "LICENSE");
  const license = await readFile(licensePath, "utf8");
  if (!/MIT License/.test(license)) {
    throw new Error(`${licensePath} does not read as the expected MIT licence.`);
  }
  const results = {};
  for (const pkg of PACKAGES) {
    results[pkg.id] = await syncPackage(pkg, { root, upstream, license, allowDirty, log });
  }
  results.catalogs = await syncCatalogs({ root, upstream, log });
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await syncGalaxio({ allowDirty: process.argv.includes("--allow-dirty") }).catch((error) => {
    console.error(`sync-galaxio failed: ${error.message}`);
    process.exit(1);
  });
}

#!/usr/bin/env node
import { sha256 } from '../../src/platform/sha256.mts';
import {requireRecord,requireString,requireFiniteNumber} from '../sources/source-values.mts';
import {shape,optional,dictionary,text} from '../objects/terrestrial-layers/source-records.mts';
interface FileRecord {sha256?:string;bytes?:number;symlink?:string;upstreamSha256?:string;upstreamBytes?:number;identityRules?:string[];}
type FileManifest=Record<string,FileRecord>;
type SyncPackage=typeof PACKAGES[number];
type SyncTarget={kind:'package';dest:string}&SyncPackage | {kind:'catalogs';id:string;directory:string;dest:string};
interface SyncContext {root:string;upstream:ReturnType<typeof upstreamIdentity>;log:(message:string)=>void;}
const parseFileRecord=(value:unknown):FileRecord=>{const input=requireRecord(value);return input.symlink!==undefined?{...input,symlink:requireString(input.symlink)}:{...input,sha256:requireString(input.sha256),bytes:requireFiniteNumber(input.bytes)};};
const parseProvenance=(value:unknown)=>Object.assign({},requireRecord(value),shape({files:optional(dictionary(parseFileRecord)),syncedAt:optional(text)})(value));
const parseAssetEntry=(value:unknown)=>Object.assign({},requireRecord(value),shape({key:text,path:text})(value));
// Mirrors astronomy files outside locally maintained sections, and prepared point
// catalogues, from the author's other project (galaxio) into cssEarth. Both
// projects are Juan Cruz Fortunatti's; the packages are his own MIT code, so
// they are presented here as cssEarth's own packages and this sync is an
// engineering mirror (one source of truth, two repositories), not a
// third-party vendoring. The catalogue DATA is different: it is third-party
// science data whose licences travel with it untouched (data/catalogs/NOTICE.md).
//
// The upstream layout is mirrored so a sync is a directory-to-directory copy:
//
//   packages/astronomy   <-  <upstream>/packages/astronomy   (git-tracked files)
//   packages/catalog is maintained locally; the sync never writes it.
//   data/catalogs/<name> <-  <upstream>/data/catalogs/<name> (VENDORED_CATALOGS)
//
// Package files are copied byte-for-byte except for one deliberate rewrite:
// the upstream project's identity becomes cssEarth's (IDENTITY_RULES) — the
// package name, repository URLs, prose, paths into upstream-only directories,
// and the three identity strings in src/modelAccuracy.ts. No rule changes
// behaviour: every code rule matches a string literal only. Two upstream files
// are not mirrored at all (EXCLUDED_FILES). The per-file manifest in each
// upstream.json records both the mirrored hash and, for rewritten files, the
// upstream hash, so the claim "byte-identical apart from the identity
// replacements" is checkable.
//
// The catalogues are generated output that upstream does not commit (its
// data/ directory is gitignored and built by pipeline/), so they carry no
// upstream commit of their own. Their provenance records the upstream checkout
// that held them, the manifest entry each was published under, and their
// hashes. Two catalogues are deliberately not vendored; see EXCLUDED_CATALOGS.
//
// Re-run to pull upstream changes (idempotent; unchanged input is a no-op):
//
//   node tools/ci/sync-upstream.mts
//   UPSTREAM_ROOT=/path/to/checkout node tools/ci/sync-upstream.mts
//
// Never hand-edit mirrored files outside the declared local sections: sync overwrites them and
// tools/sync-upstream.test.mjs fails on any drift — including any upstream
// identity that leaks back in.

import { execFileSync } from "node:child_process";
import { existsSync, lstatSync } from "node:fs";
import { mkdir, readdir, readFile, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const DEFAULT_UPSTREAM_ROOT = "/Users/apresmoi/Documents/galaxio";
export const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

export const PROVENANCE_FILE = "upstream.json";
export const LICENSE_FILE = "LICENSE";
export const UPSTREAM_REPOSITORY = "https://github.com/apresmoi/galaxio";
export const CSSEARTH_REPOSITORY = "https://github.com/layoutit/cssEarth";
export const UPSTREAM_NAME = "galaxio";
export const AUTHOR = "Juan Cruz Fortunatti";

// The upstream project is the same author's other repository. This record
// exists so the mirror can be refreshed and drift detected; it is not an
// attribution to an outside party.
export const ORIGIN_NOTE =
  `Shared source, same author: this package is maintained in ${AUTHOR}'s other ` +
  `project (${UPSTREAM_NAME}, ${UPSTREAM_REPOSITORY}) and mirrored here by ` +
  `tools/sync-upstream.mts. Both projects are his, and the package is MIT under ` +
  `his copyright either way, so it is presented as cssEarth's own package. This ` +
  `file is an engineering sync record (upstream path, commit, per-file hashes), ` +
  `not a third-party attribution.`;

const PROSE = /(^|\/)[^/]+\.md$/;
const EXTERNAL_PIPELINE = "the external catalogue pipeline (not part of this repository)";

// The only edit applied to upstream files: the upstream project's identity
// becomes cssEarth's. Each rule names the files it may touch. The two rules
// that reach into src/ match string literals in src/modelAccuracy.ts only —
// a source label and a documentation URL — and change no behaviour.
export const IDENTITY_RULES = Object.freeze([
  {
    id: "package-name",
    files: /^package\.json$/,
    from: /^(\s*"name":\s*")@galaxio\//m,
    to: "$1@cssearth/",
    description: 'package.json "name": @galaxio/<pkg> -> @cssearth/<pkg>',
  },
  {
    id: "package-urls",
    files: /^package\.json$/,
    from: /https:\/\/github\.com\/apresmoi\/galaxio/g,
    to: CSSEARTH_REPOSITORY,
    description: "package.json repository, bugs, homepage: the upstream repository URL -> the cssEarth repository URL",
  },
  {
    id: "prose-package-name",
    files: PROSE,
    from: /@galaxio\//g,
    to: "@cssearth/",
    description: "*.md: @galaxio/<pkg> -> @cssearth/<pkg> (headings, install and import examples)",
  },
  {
    id: "prose-project-link",
    files: PROSE,
    from: /\[Galaxio\]\(https:\/\/github\.com\/apresmoi\/galaxio\)/g,
    to: `[cssEarth](${CSSEARTH_REPOSITORY})`,
    description: "*.md: the [Galaxio](repo) project link -> [cssEarth](repo)",
  },
  {
    id: "prose-pipeline-writer-path",
    files: PROSE,
    from: /`pipeline\/galaxio_pipeline\/formats\/catalog\.py`/g,
    to: `\`formats/catalog.py\` of ${EXTERNAL_PIPELINE}`,
    description:
      "*.md: the Python writer's path inside the upstream pipeline/ (absent here) -> " +
      "`formats/catalog.py` of the external catalogue pipeline (not part of this repository)",
  },
  {
    id: "prose-pipeline-directory",
    files: PROSE,
    from: /A Python writer lives in the repo's `pipeline\/`;/g,
    to: `The Python writer lives in ${EXTERNAL_PIPELINE};`,
    description:
      "*.md: \"A Python writer lives in the repo's `pipeline/`\" (absent here) -> " +
      "the external catalogue pipeline (not part of this repository)",
  },
  {
    id: "prose-architecture-doc",
    files: PROSE,
    from: /See `ARCHITECTURE\.md §2` in the repo root for why that matters/g,
    to: 'See "The frame tree is the whole point" in `AGENTS.md` for why that matters',
    description:
      "*.md: the upstream root ARCHITECTURE.md §2 reference (absent here) -> " +
      'the "The frame tree is the whole point" section of AGENTS.md',
  },
  {
    id: "prose-claude-symlink",
    files: /^AGENTS\.md$/,
    from: / ?`CLAUDE\.md` is a symlink to this file\./g,
    to: "",
    description:
      "AGENTS.md: drop the sentence announcing the CLAUDE.md symlink, which is not mirrored (EXCLUDED_FILES)",
  },
  {
    id: "code-project-url",
    files: /^src\/modelAccuracy\.ts$/,
    from: /'https:\/\/github\.com\/apresmoi\/galaxio\/blob\/main\/ARCHITECTURE\.md'/g,
    to: `'${CSSEARTH_REPOSITORY}/blob/main/packages/astronomy/AGENTS.md'`,
    description:
      "src/modelAccuracy.ts: PROJECT_SOURCE_URL string literal, the upstream ARCHITECTURE.md -> " +
      "this package's AGENTS.md in the cssEarth repository (a documentation URL; no behaviour change)",
  },
  {
    id: "code-convention-label",
    files: /^src\/modelAccuracy\.ts$/,
    from: /'Galaxio (reference-frame convention|solar-system frame definition)'/g,
    to: "'cssEarth $1'",
    description:
      "src/modelAccuracy.ts: the two 'Galaxio … convention/definition' sourceLabel string literals -> " +
      "'cssEarth …' (labels only; no behaviour change)",
  },
]);

// Upstream files that are not mirrored at all, with the reason. Recorded in
// upstream.json under excludedFiles so the omission is auditable.
export const EXCLUDED_FILES = Object.freeze({
  "scripts/gen_fixture.py":
    "Imports the upstream Python pipeline (galaxio_pipeline), which is not part of this " +
    "repository, so it cannot run here. scripts/check-parity.mjs, which invokes it, is " +
    "mirrored as inert reference; the parity check runs where the pipeline lives.",
});

export const PACKAGES = Object.freeze([
  {
    id: "astronomy",
    upstreamDirectory: "packages/astronomy",
    directory: "packages/astronomy",
    upstreamPackage: "@galaxio/astronomy",
    package: "@cssearth/astronomy",
    entry: "src/index.ts",
  },
]);

export const CATALOGS_DIRECTORY = "data/catalogs";
export const CATALOGS_MANIFEST_FILE = "manifest.json";

// Catalogues copied whole from <upstream>/data/catalogs/<name>, every v<N>
// directory included, with the upstream builder that produced each one.
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
  "are `./x.ts` (the TS/ESM convention). Vite and Astro resolve that " +
  "natively, so browser-side consumption works verbatim. Node does not: " +
  "importing src/index.ts directly fails on the first `.js` specifier. " +
  "Decision: a package is consumed through its own build step, never a " +
  "specifier rewrite or a resolver hook, so the source stays byte-identical " +
  "to its origin. For the astronomy package `pnpm build:astronomy` runs its " +
  "tsup config into the gitignored dist/, which the workspace link resolves " +
  "as `@cssearth/astronomy` (`pnpm install` runs it as postinstall); " +
  "Node-side consumers go through src/platform/astronomy-package.mts " +
  "(tools/prepare/prepare-solar-geometry.mts first). A catalog consumer would be " +
  "wired the same way.";

const toPosix = (path:string) => path.split(sep).join("/");

// Directories that are never upstream material: pnpm links a workspace
// package's devDependencies into its own node_modules, and a local build
// would emit dist. Both are gitignored and invisible to the manifest.
const IGNORED_DIRECTORIES = new Set(["node_modules", "dist", ".cache", "coverage"]);

// Local body models, their checks, guides and scientific records survive refreshes.
export function locallyMaintainedFile(target:Pick<SyncTarget,'id'>, rel:string) {
  rel=rel.replace(/\.mts$/,'.mjs');
  if (target.id !== "astronomy") return false;
  return ["tools/verify-sn263-orbits.py", "tools/body-records.mjs", "tools/generate-heliocentric.mjs", "src/data/dwarfPlanetElements.data.ts", "README.md", "AGENTS.md", "CLAUDE.md", "package.json", "tools/tsconfig.json",
    // Typed generator owners retain their last mirrored identities in upstream.json.
    "tools/generate-dwarf-planets.mjs", "tools/generate-series.mjs",
    "tools/lib/elp2000.mjs", "tools/lib/horizons.mjs", "tools/lib/sources.mjs", "tools/lib/vsop87.mjs",
    "tools/lib/source-records.test.mjs", "tools/lib/source-validation.mjs", "tools/lib/ephemeris-records.mjs", "tools/lib/generator-records.mjs", "tools/lib/satellite-fit.mjs", "tools/fetch-fixtures.mjs",
    "src/index.ts", "src/asteroids.ts", "src/asteroids.test.ts", "src/data/asteroidElements.data.ts", "tools/generate-asteroids.mjs",
    "src/comets.ts", "src/comets.test.ts", "src/data/cometElements.data.ts", "tools/generate-comets.mjs",
    "tools/generate-satellites.mjs", "tools/lib/write-record-sections.mjs", "tools/lib/fit-libration.mjs",
    "tools/lib/fit-harmonics.mjs", "tools/lib/fit-harmonics.test.mjs", "tools/lib/fit-position-correction.mjs",
    "tools/lib/fit-cosine-series.mjs", "tools/lib/fit-cosine-series.test.mjs",
    "src/periodicCorrection.ts", "src/periodicCorrection.test.ts",
    "tools/scene-ephemeris.mjs", "tools/acquire-scene-ephemeris.mjs",
    // The local fixed-epoch companion path includes its solar-system integration.
    // Shared frame transforms and VSOP ephemeris math remain mirrored. Hyperbolic Kepler support is a local extension.
    "tools/body-epoch-ephemeris.mjs", "tools/generate-scene-satellites.mjs",
    "src/sceneSatellites.ts", "src/sceneSatellites.test.ts", "src/data/sceneSatelliteStates.data.ts",
    "src/solarSystem.ts",
    "tools/fetch-rotation-fixtures.mjs", "src/__fixtures__/rotation.ts",
    "src/kepler.ts", "src/kepler.test.ts", "src/kepler-hyperbolic.test.ts",
    "src/bodies.ts", "src/body-types.ts", "src/body-data.ts", "src/bodies.test.ts", "src/dwarfPlanets.ts", "src/dwarfPlanets.test.ts",
    "src/modelAccuracy.ts", "src/modelAccuracy.test.ts", "src/satellites.ts", "src/rotation.ts", "src/rotation-neptune.ts", "src/satellites.test.ts", "src/solarSystem.test.ts"].includes(rel) ||
    rel.startsWith("data/") || rel.startsWith("src/data/generated/") ||
    rel.startsWith("source/scene-epoch/") ||
    /^src\/(?:data\/satelliteElements\.data|__fixtures__\/horizons)(?:\.[a-z0-9-]+)?\.ts$/.test(rel);
}

function packageOwnedFiles() {
  return [PROVENANCE_FILE, LICENSE_FILE, "SOURCE.md", "NOTICE.md"];
}

// cssEarth-owned files inside a vendored directory. Everything else there is
// upstream material and is replaced wholesale on every sync.
export function isOwnedFile(target:Pick<SyncTarget,'id'|'kind'>, rel:string) {
  rel = toPosix(rel);
  if (target.kind === "catalogs") {
    if (rel === PROVENANCE_FILE || rel === CATALOGS_MANIFEST_FILE) return true;
    if (rel === "SOURCE.md" || rel === "NOTICE.md") return true;
    return /^LICENSE\.[^/]+$/.test(rel);
  }
  return packageOwnedFiles().includes(rel) || locallyMaintainedFile(target, rel);
}

export function targetFor(id:string):SyncTarget {
  const pkg = PACKAGES.find((entry) => entry.id === id);
  if (pkg) return { kind: "package", ...pkg, dest: join(REPO_ROOT, pkg.directory) };
  if (id === "catalogs") {
    return { kind: "catalogs", id, directory: CATALOGS_DIRECTORY, dest: join(REPO_ROOT, CATALOGS_DIRECTORY) };
  }
  throw new Error(`Unknown sync target ${id}`);
}

export const TARGETS = Object.freeze([...PACKAGES.map((pkg) => pkg.id), "catalogs"]);

export async function listFiles(root:string) {
  const files:string[] = [];
  async function walk(dir:string) {
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

export async function listVendoredFiles(target:SyncTarget) {
  const files = await listFiles(target.dest);
  return files.filter((path) => !isOwnedFile(target, relative(target.dest, path)));
}



async function describeFile(path:string) {
  if (lstatSync(path).isSymbolicLink()) return { symlink: toPosix(await readlink(path)) };
  const content = await readFile(path);
  return { sha256: sha256(content), bytes: content.length };
}

// Per-file manifest from disk: { "relative/path": { sha256, bytes } | { symlink } },
// sorted by path. Provenance-only fields (upstreamSha256, identityRules) are
// not part of what disk can tell us and are added by the sync.
export async function buildManifest(target:SyncTarget) {
  const files:FileManifest = {};
  for (const path of await listVendoredFiles(target)) {
    files[toPosix(relative(target.dest, path))] = await describeFile(path);
  }
  return files;
}

export async function readProvenance(target:SyncTarget) {
  return parseProvenance(JSON.parse(await readFile(join(target.dest, PROVENANCE_FILE), "utf8")));
}

const onDisk = ({ sha256, bytes, symlink }:FileRecord) => (symlink ? { symlink } : { sha256, bytes });

// Compares the vendored tree against the manifest in upstream.json. Returns a
// list of problems; an empty list means the copy is pristine.
export async function manifestProblems(target:SyncTarget) {
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
export function applyIdentityRules(rel:string, content:Buffer) {
  rel = toPosix(rel);
  const applied = [];
  let text = null;
  for (const rule of IDENTITY_RULES) {
    if (!rule.files.test(rel)) continue;
    text ??= content.toString("utf8");
    const next:string = text.replace(rule.from, rule.to);
    if (next !== text) {
      applied.push(rule.id);
      text = next;
    }
  }
  return applied.length > 0 ? { content: Buffer.from(requireString(text), "utf8"), applied } : { content, applied };
}

function git(cwd:string, ...args:string[]) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
    .trim();
}

function upstreamIdentity(root:string) {
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

function subtreeIdentity(root:string, directory:string) {
  return {
    dirty: git(root, "status", "--porcelain", "--", directory) !== "",
    subtreeCommit: git(root, "log", "-1", "--format=%H", "--", directory),
    subtreeCommitDate: git(root, "log", "-1", "--format=%cI", "--", directory),
    trackedFiles: git(root, "ls-files", "-z", "--", directory).split("\0").filter(Boolean),
  };
}

async function removeEmptyDirectories(root:string):Promise<void> {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || IGNORED_DIRECTORIES.has(entry.name)) continue;
    const path = join(root, entry.name);
    await removeEmptyDirectories(path);
    if ((await readdir(path)).length === 0) await rm(path, { recursive: true });
  }
}

async function clearVendored(target:SyncTarget) {
  await mkdir(target.dest, { recursive: true });
  for (const path of await listVendoredFiles(target)) await rm(path);
  await removeEmptyDirectories(target.dest);
}

async function readPrevious(target:SyncTarget) {
  try {
    return await readProvenance(target);
  } catch {
    return null;
  }
}

async function writeProvenance(target:SyncTarget, provenance:unknown) {
  await writeFile(join(target.dest, PROVENANCE_FILE), `${JSON.stringify(provenance, null, 2)}\n`);
  const problems = await manifestProblems(target);
  if (problems.length > 0) {
    throw new Error(
      `${target.directory}: manifest does not match the copied tree:\n  ${problems.join("\n  ")}`,
    );
  }
}

const sumBytes = (files:FileManifest) =>
  Object.values(files).reduce((sum, entry) => sum + (entry.bytes ?? 0), 0);

function unchangedSince(previous:ReturnType<typeof parseProvenance>|null, files:FileManifest, commitKey:string, commit:string) {
  return (
    previous !== null &&
    previous[commitKey] === commit &&
    JSON.stringify(previous.files) === JSON.stringify(files)
  );
}

async function syncPackage(pkg:SyncPackage, { root, upstream, license, allowDirty, log }:SyncContext & {license:string;allowDirty:boolean}) {
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

  const files:FileManifest = {};
  const rewritten:Record<string,string[]> = {};
  const excluded:Record<string,string> = {};
  for (const tracked of subtree.trackedFiles) {
    const rel = toPosix(relative(pkg.upstreamDirectory, tracked));
    if (locallyMaintainedFile(target, rel)) continue;
    if (isOwnedFile(target, rel)) {
      throw new Error(`Upstream now ships ${rel}, which collides with a cssEarth-owned file.`);
    }
    if (rel in EXCLUDED_FILES) {
      excluded[rel] = requireString(Reflect.get(EXCLUDED_FILES,rel));
      continue;
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
    author: AUTHOR,
    origin: ORIGIN_NOTE,
    repository: upstream.remote ?? `${UPSTREAM_REPOSITORY}.git`,
    directory: pkg.upstreamDirectory,
    subtreeCommit: subtree.subtreeCommit,
    subtreeCommitDate: subtree.subtreeCommitDate,
    headCommit: upstream.headCommit,
    upstreamDirty: subtree.dirty,
    syncedAt: unchanged ? previous?.syncedAt : new Date().toISOString(),
    syncScript: "tools/ci/sync-upstream.mts",
    transform:
      "identity only: files listed under identityRules had the upstream project's " +
      "identity replaced by cssEarth's (see rules; the src/ rules touch string literals " +
      "only); files listed under excludedFiles are not mirrored; every other file is " +
      "byte-identical to upstream",
    identityRules: Object.fromEntries(
      IDENTITY_RULES.map((rule) => [rule.id, rule.description]),
    ),
    localMaintenance: "Body models, their checks, guides and scientific records are maintained locally and preserved by sync.",
    ...(previous?.locallyMaintainedOrigins ? {locallyMaintainedOrigins:previous.locallyMaintainedOrigins} : {}),
    locallyMaintainedDirectories: ["data/", "src/data/generated/"],
    locallyMaintainedFiles: (await listFiles(target.dest)).map(file => toPosix(relative(target.dest, file))).filter(rel => locallyMaintainedFile(target, rel) && !rel.startsWith("data/") && !rel.startsWith("src/data/generated/")),
    rewrittenFiles: rewritten,
    excludedFiles: excluded,
    importNote: IMPORT_NOTE,
    fileCount: Object.keys(files).length,
    byteCount: sumBytes(files),
    files,
  };
  await writeProvenance(target, provenance);
  log(
    `Mirrored ${pkg.upstreamPackage}@${subtree.subtreeCommit.slice(0, 12)} as ${pkg.package} ` +
      `(${provenance.fileCount} files, ${provenance.byteCount} bytes, ` +
      `${Object.keys(rewritten).length} identity-rewritten, ${Object.keys(excluded).length} excluded) ` +
      `into ${pkg.directory}` +
      `${unchanged ? " — unchanged" : ""}`,
  );
  return provenance;
}

async function syncCatalogs({ root, upstream, log }:SyncContext) {
  const target = targetFor("catalogs");
  const manifestPath = join(root, "data", "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`No data manifest at ${manifestPath}; build galaxio's data/ first.`);
  }
  const manifestBytes = await readFile(manifestPath);
  const manifest = requireRecord(JSON.parse(manifestBytes.toString("utf8")));
  const assets = dictionary(parseAssetEntry)(manifest.assets ?? {});

  const entryFor = (name:string) => {
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

  const files:FileManifest = {};
  const catalogs:Record<string,{key:string;current:string;currentSha256:string|undefined;supersededVersions:string[];builder:string;manifestEntry:ReturnType<typeof parseAssetEntry>}> = {};
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
    repository: upstream.remote ?? `${UPSTREAM_REPOSITORY}.git`,
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
    syncedAt: unchanged ? previous?.syncedAt : new Date().toISOString(),
    syncScript: "tools/ci/sync-upstream.mts",
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

export async function syncUpstream({
  root = process.env.UPSTREAM_ROOT ?? DEFAULT_UPSTREAM_ROOT,
  allowDirty = false,
  log = console.log,
}: {root?:string;allowDirty?:boolean;log?:(message:string)=>void} = {}) {
  root = resolve(root);
  if (!existsSync(join(root, "packages", "astronomy", "src", "index.ts"))) {
    throw new Error(`No ${UPSTREAM_NAME} checkout at ${root}. Set UPSTREAM_ROOT to the ${UPSTREAM_NAME} repository root.`);
  }
  const upstream = upstreamIdentity(root);
  const licensePath = join(upstream.root, "LICENSE");
  const license = await readFile(licensePath, "utf8");
  if (!/MIT License/.test(license)) {
    throw new Error(`${licensePath} does not read as the expected MIT licence.`);
  }
  const results:Record<string,Awaited<ReturnType<typeof syncPackage>>|Awaited<ReturnType<typeof syncCatalogs>>> = {};
  for (const pkg of PACKAGES) {
    results[pkg.id] = await syncPackage(pkg, { root, upstream, license, allowDirty, log });
  }
  results.catalogs = await syncCatalogs({ root, upstream, log });
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await syncUpstream({ allowDirty: process.argv.includes("--allow-dirty") }).catch((error) => {
    console.error(`sync-upstream failed: ${error.message}`);
    process.exit(1);
  });
}

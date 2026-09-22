import { sha256 } from './sha256.mts';
import { isArray } from './is-array.mts';
export interface RuntimeAsset { filename: string; bytes: number; sha256: string; location?: 'public'; }
export interface RuntimeAssetManifest { schema: string; resourceRoot?: 'prepared'; assets: readonly RuntimeAsset[]; }
/** `runtime-assets` covers public scene textures (and, via the `prepared` resourceRoot, a handful of legacy
 * context bundles). `prepared-assets` inventories baked `prepared/*` outputs that git no longer tracks: either an
 * explicit small filename list (`runtime.json`/`scene.json` for a body prepared through the runtime pipeline) or
 * the full nested closure of a context/nebula object's `prepared/` directory. Both kinds share one schema shape,
 * validator and closure verifier; only the schema suffix differs. */
export type AssetManifestKind = 'runtime-assets' | 'prepared-assets';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, readdir, rename, rm, stat, lstat, unlink, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const SAFE_FILENAME = /^[a-z0-9][a-z0-9@._-]*$/u;

let cachedRepoRoot: Promise<string | null> | undefined;
function repoRoot(): Promise<string | null> {
  cachedRepoRoot ??= execFileAsync("git", ["rev-parse", "--show-toplevel"]).then(({ stdout }) => stdout.trim(), () => null);
  return cachedRepoRoot;
}

/**
 * Which of these absolute paths git currently tracks, batched into one `git ls-files` call regardless of how many
 * paths are checked. Fails open (reports nothing tracked) when there is no git repository to ask — an isolated
 * test fixture, or tooling run outside a checkout — rather than making every prepare/publish step depend on git
 * being available; the writers below still call this by default, and remain the read backstop everywhere a real
 * checkout runs them.
 */
async function defaultGitTrackedPaths(paths: readonly string[]): Promise<Set<string>> {
  if (!paths.length) return new Set();
  const root = await repoRoot();
  if (!root) return new Set();
  const tracked = await execFileAsync("git", ["ls-files", "-z", "--full-name", "--", ...paths], { maxBuffer: 1024 * 1024 * 64 })
    .then(({ stdout }) => new Set(stdout.split("\0").filter(Boolean).map(name => resolve(root, name))), () => new Set<string>());
  return new Set(paths.filter(path => tracked.has(resolve(path))));
}

/**
 * Guard shared by both manifest writers below (the P2 gap that let a git-tracked file — e.g. a body's
 * `prepared/provenance.json` — end up inside a `runtime-assets.json`/`prepared-assets.json` inventory: `setup:assets`
 * would then silently overwrite a contributor's tracked, committed bytes with whatever R2 happens to hold).
 */
async function rejectGitTrackedAssets(planetId: string, root: string, filenames: readonly string[],
  gitTrackedPaths: (paths: readonly string[]) => Promise<Set<string>>): Promise<void> {
  const absolute = filenames.map(name => resolve(root, name));
  const tracked = await gitTrackedPaths(absolute);
  if (!tracked.size) return;
  const trackedNames = filenames.filter(name => tracked.has(resolve(root, name)));
  if (!trackedNames.length) return;
  throw new TypeError(`Planet ${planetId} inventory includes git-tracked file(s), which setup:assets/setup:prepared ` +
    `would silently overwrite: ${trackedNames.join(", ")}.`);
}

const SHA256 = /^[0-9a-f]{64}$/u;

function manifestSchema(kind: AssetManifestKind, planetId: string): string {
  return `css${planetId}-${kind}@1`;
}

export function normalizeRuntimeAssetUrls({ planetId, urls }: { planetId: string; urls: readonly string[] }) {
  if (!/^[a-z][a-z0-9-]*$/u.test(planetId) || !isArray(urls) || urls.length === 0) {
    throw new TypeError("Runtime asset inventory is incompatible.");
  }
  const prefix = `/scenes/${planetId}/`;
  const filenames = [];
  const seenUrls = new Set();
  const seenFilenames = new Set();
  for (const url of urls) {
    if (typeof url !== "string" || !url.startsWith(prefix) ||
        url.slice(prefix.length) !== basename(url) ||
        !SAFE_FILENAME.test(basename(url))) {
      throw new TypeError(`Planet ${planetId} has an unsafe runtime asset URL.`);
    }
    const filename = basename(url);
    if (seenUrls.has(url) || seenFilenames.has(filename)) {
      throw new TypeError(`Planet ${planetId} repeats runtime asset ${filename}.`);
    }
    seenUrls.add(url);
    seenFilenames.add(filename);
    filenames.push(filename);
  }
  return Object.freeze(filenames.sort((left, right) => left.localeCompare(right)));
}

export async function prepareRuntimeAssetManifest({
  planetId,
  urls,
  publicRoot,
  manifestPath,
  allowPreparationArtifacts = false,
}: { planetId: string; urls: readonly string[]; publicRoot: string; manifestPath: string | URL; allowPreparationArtifacts?: boolean }) {
  const filenames = normalizeRuntimeAssetUrls({ planetId, urls });
  // Offline baking may emit intermediate densities. They are not shipped;
  // production assembly and verification still enforce exact closure. Unlike prepared-assets.json below, a
  // handful of legacy context bundles (e.g. m31, galaxy-clusters) intentionally list git-tracked files here
  // under the `prepared` resourceRoot, so this writer does not reject a tracked path the way that one does.
  if (!allowPreparationArtifacts) await assertDirectoryClosure(publicRoot, filenames, planetId);
  const assets = [];
  for (const filename of filenames) {
    if (!(await lstat(resolve(publicRoot, filename))).isFile()) throw new Error(`Runtime asset is not a regular file: ${filename}.`);
    const bytes = await readFile(resolve(publicRoot, filename));
    assets.push(Object.freeze({
      filename,
      bytes: bytes.byteLength,
      sha256: sha256(bytes),
    }));
  }
  const manifest = Object.freeze({
    schema: `css${planetId}-runtime-assets@1`,
    assets: Object.freeze(assets),
  });
  await writeManifestAtomically(manifestPath, manifest);
  return manifest;
}

async function writeManifestAtomically(manifestPath: string | URL, manifest: unknown): Promise<void> {
  const outputPath = manifestPath instanceof URL
    ? fileURLToPath(manifestPath)
    : manifestPath;
  const temporary = `${outputPath}.partial-${process.pid}-${randomUUID()}`;
  try {
    await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
    await rename(temporary, outputPath);
  } finally {
    await rm(temporary, { force: true });
  }
}

/**
 * Write the `prepared-assets.json` inventory for one object: either an explicit `filenames` list (a body's
 * `prepared/runtime.json` + `prepared/scene.json`, whichever exist — every other `prepared/*` file stays a
 * tracked contract file, not part of this inventory) or, when `filenames` is omitted, the full nested closure of
 * `preparedRoot` minus `exclude` (a context/nebula object with no `runtime-assets.json`, such as a nebula bake or
 * milky-way/heliosphere/stellar-neighbourhood/lmc).
 */
/**
 * Files under a body's `prepared/` that a checkout regenerates itself, so they are never inventoried or published:
 * the JSON transport and page written from the restored runtime, the provenance record generated from the manifest,
 * and the radial-terrain reports and source-index rasters that only the audits read.
 */
export function isRegeneratedPreparedFile(filename: string): boolean {
  return ['object.json', 'page.json', 'provenance.json'].includes(filename) || /^terrain(-[a-z0-9-]+)?\.json$/u.test(filename) || /-source-index\.json$/u.test(filename);
}

/** Every baked file under a body's `prepared/`: what the inventory publishes and `setup:prepared` restores. */
export async function bakedPreparedFiles(preparedRoot: string, planetId: string): Promise<string[]> {
  return (await runtimeFiles(preparedRoot, planetId, true)).filter(name => !isRegeneratedPreparedFile(name));
}

export async function preparePreparedAssetManifest({
  planetId,
  preparedRoot,
  manifestPath,
  filenames,
  exclude = [],
  gitTrackedPaths = defaultGitTrackedPaths,
}: { planetId: string; preparedRoot: string; manifestPath: string | URL; filenames?: readonly string[]; exclude?: readonly string[];
  gitTrackedPaths?: (paths: readonly string[]) => Promise<Set<string>> }): Promise<Readonly<RuntimeAssetManifest>> {
  let names: string[];
  if (filenames) {
    names = [...filenames];
    for (const name of names) {
      if (!(await lstat(resolve(preparedRoot, name)).catch(() => undefined))?.isFile()) {
        throw new Error(`Prepared asset is not a regular file: ${planetId}/${name}.`);
      }
    }
  } else {
    const excluded = new Set(exclude);
    names = (await runtimeFiles(preparedRoot, planetId, true)).filter(name => !excluded.has(name));
  }
  if (names.length === 0) throw new TypeError(`Planet ${planetId} has no prepared assets to inventory.`);
  names.sort((left, right) => left.localeCompare(right));
  for (const name of names) {
    if (!name.split("/").every(component => SAFE_FILENAME.test(component))) {
      throw new TypeError(`Planet ${planetId} has an unsafe prepared asset path: ${name}.`);
    }
  }
  if (new Set(names).size !== names.length) throw new TypeError(`Planet ${planetId} repeats a prepared asset path.`);
  await rejectGitTrackedAssets(planetId, preparedRoot, names, gitTrackedPaths);
  const assets = [];
  for (const filename of names) {
    const bytes = await readFile(resolve(preparedRoot, filename));
    assets.push(Object.freeze({ filename, bytes: bytes.byteLength, sha256: sha256(bytes) }));
  }
  const manifest = Object.freeze({
    schema: `css${planetId}-prepared-assets@1`,
    resourceRoot: "prepared" as const,
    assets: Object.freeze(assets),
  });
  await writeManifestAtomically(manifestPath, manifest);
  return manifest;
}

export async function assembleRuntimeAssetClosure({
  planetId,
  manifestPath,
  productionRoot,
}: { planetId: string; manifestPath: string | URL; productionRoot: string }) {
  const manifest: RuntimeAssetManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  validateRuntimeAssetManifest(planetId, manifest);
  if (manifest.resourceRoot === "prepared") throw new TypeError("Prepared resources cannot be assembled by the public-scene asset assembler.");
  const expected = new Set(manifest.assets.map(({ filename }) => filename));
  const entries = await runtimeFiles(productionRoot, planetId, false);
  for (const name of entries) if (!expected.has(name)) await unlink(resolve(productionRoot, name));
  await verifyRuntimeAssetClosure({ planetId, manifest, root: productionRoot });
  return manifest;
}

/**
 * `closure` (default true) asserts the target directory contains exactly the manifest's files (plus `exclude`,
 * which may be present on disk without being declared — used for files that stay outside this inventory, such
 * as a sibling context object's own `manifest.json`, or pre-existing local drift called out by name). Body
 * manifests that only cover a subset of `prepared/` (`runtime.json`/`scene.json` beside tracked contract files)
 * pass `closure: false`: every listed file must exist and match its hash, but undeclared neighbors are expected.
 */
export async function verifyAssetClosure(kind: AssetManifestKind, { planetId, manifest, root, publicRoot, closure = true, exclude = [] }: {
  planetId: string; manifest: RuntimeAssetManifest; root: string; publicRoot?: string; closure?: boolean; exclude?: readonly string[];
}) {
  validateAssetManifest(kind, planetId, manifest);
  const publicAssets = manifest.assets.filter(asset => asset.location === "public");
  if (publicAssets.length && !publicRoot) throw new TypeError("Public runtime assets require an explicit publicRoot for verification.");
  const prepared = manifest.resourceRoot === "prepared";
  if (closure) {
    await assertDirectoryClosure(root, manifest.assets.filter(asset => asset.location !== "public").map(({ filename }) => filename), planetId, prepared,
      prepared ? [...exclude, "manifest.json"] : exclude);
    if (publicAssets.length) await assertDirectoryClosure(publicRoot!, publicAssets.map(({ filename }) => filename), planetId, true);
  } else {
    for (const asset of manifest.assets.filter(asset => asset.location !== "public")) {
      const target = resolve(root, asset.filename);
      if (!(await lstat(target).catch(() => undefined))?.isFile()) {
        throw new Error(`Planet ${planetId} ${kind} closure mismatch. Missing: ${asset.filename}.`);
      }
    }
  }
  for (const asset of manifest.assets) {
    const bytes = await readFile(resolve(asset.location === "public" ? publicRoot! : root, asset.filename));
    const digest = sha256(bytes);
    if (bytes.byteLength !== asset.bytes || digest !== asset.sha256) {
      throw new Error(`Planet ${planetId} ${kind === "prepared-assets" ? "prepared" : "runtime"} asset drifted: ${asset.filename}.`);
    }
  }
  return true;
}

export async function verifyRuntimeAssetClosure(args: { planetId: string; manifest: RuntimeAssetManifest; root: string; publicRoot?: string }) {
  return verifyAssetClosure("runtime-assets", args);
}

export async function verifyPreparedAssetClosure(args: { planetId: string; manifest: RuntimeAssetManifest; root: string; closure?: boolean; exclude?: readonly string[] }) {
  return verifyAssetClosure("prepared-assets", args);
}

export function validateAssetManifest(kind: AssetManifestKind, planetId: string, input: unknown): true {
  const manifest = input as RuntimeAssetManifest;
  if (!manifest || typeof manifest !== "object" || isArray(manifest) ||
      manifest.schema !== manifestSchema(kind, planetId) ||
      (manifest.resourceRoot !== undefined && manifest.resourceRoot !== "prepared") ||
      !isArray(manifest.assets) || manifest.assets.length === 0) {
    throw new TypeError(`Planet ${planetId} ${kind} manifest is incompatible.`);
  }
  const filenames = new Set();
  for (const asset of manifest.assets) {
    if (!asset || typeof asset !== "object" ||
        typeof asset.filename !== "string" ||
        (asset.location !== undefined && (manifest.resourceRoot !== "prepared" || asset.location !== "public")) ||
        !(manifest.resourceRoot === "prepared"
          ? asset.filename.split("/").every(component => SAFE_FILENAME.test(component))
          : SAFE_FILENAME.test(asset.filename)) ||
        !Number.isSafeInteger(asset.bytes) || asset.bytes <= 0 ||
        !SHA256.test(asset.sha256 ?? "")) {
      throw new TypeError(`Planet ${planetId} has an invalid runtime asset entry.`);
    }
    if (filenames.has(asset.filename)) {
      throw new TypeError(`Planet ${planetId} repeats runtime asset ${asset.filename}.`);
    }
    filenames.add(asset.filename);
  }
  return true;
}

export function validateRuntimeAssetManifest(planetId: string, input: unknown): true {
  return validateAssetManifest("runtime-assets", planetId, input);
}

export function validatePreparedAssetManifest(planetId: string, input: unknown): true {
  return validateAssetManifest("prepared-assets", planetId, input);
}

export function requireAssetManifest(kind: AssetManifestKind, planetId: string, input: unknown): Readonly<RuntimeAssetManifest> {
  validateAssetManifest(kind, planetId, input);
  return input as RuntimeAssetManifest;
}

export function requireRuntimeAssetManifest(planetId: string, input: unknown): Readonly<RuntimeAssetManifest> {
  return requireAssetManifest("runtime-assets", planetId, input);
}

export function requirePreparedAssetManifest(planetId: string, input: unknown): Readonly<RuntimeAssetManifest> {
  return requireAssetManifest("prepared-assets", planetId, input);
}

async function runtimeFiles(root: string, planetId: string, nested: boolean, prefix = ""): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const name = `${prefix}${entry.name}`;
    if (entry.isFile()) files.push(name);
    else if (nested && entry.isDirectory() && SAFE_FILENAME.test(entry.name)) {
      files.push(...await runtimeFiles(resolve(root, entry.name), planetId, true, `${name}/`));
    } else throw new Error(`Unexpected ${planetId} asset directory: ${name}.`);
  }
  return files;
}

async function assertDirectoryClosure(root: string, filenames: readonly string[], planetId: string, nested = false, metadata: readonly string[] = []) {
  const actual = (await runtimeFiles(root, planetId, nested)).filter(filename => !metadata.includes(filename) || filenames.includes(filename));
  const expected = [...filenames].sort((left, right) => left.localeCompare(right));
  actual.sort((left, right) => left.localeCompare(right));
  if (expected.join("\0") !== actual.join("\0")) {
    const expectedSet = new Set(expected);
    const actualSet = new Set(actual);
    const missing = expected.filter((filename) => !actualSet.has(filename));
    const undeclared = actual.filter((filename) => !expectedSet.has(filename));
    throw new Error(
      `Planet ${planetId} runtime asset closure mismatch. Missing: ${missing.join(", ") || "none"}. Undeclared: ${undeclared.join(", ") || "none"}.`,
    );
  }
  for (const filename of actual) {
    const fileStat = await stat(resolve(root, filename));
    if (!fileStat.isFile()) throw new Error(`Planet ${planetId} runtime asset is not a file: ${filename}.`);
  }
}

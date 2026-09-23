import { sha256 } from './sha256.mts';
import { isArray } from './is-array.mts';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, readdir, rename, rm, lstat, unlink, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { promisify } from "node:util";

/**
 * One inventory per object, `src/objects/<id>/inventory.json`: every baked file the object ships that git does not
 * hold, with the bytes and hash R2 serves it under. A `public` asset lives at `public/scenes/<id>/<filename>`; a
 * `prepared` asset lives at `src/objects/<id>/prepared/<filename>` and may be nested. The inventory is the only
 * thing a bake commits; `setup:assets` restores from it and `publish:runtime-assets` uploads from it. The R2 key
 * is `runtime-assets/<sha256>/<filename>`, whichever location the file has.
 */
export type AssetLocation = 'public' | 'prepared';
export interface InventoryAsset { location: AssetLocation; filename: string; bytes: number; sha256: string; }
export interface Inventory { schema: typeof INVENTORY_SCHEMA; assets: readonly InventoryAsset[]; }
export const INVENTORY_SCHEMA = 'cssearth-inventory@1';
export const INVENTORY_FILE = 'inventory.json';
export const ASSET_LOCATIONS: readonly AssetLocation[] = ['public', 'prepared'];

const execFileAsync = promisify(execFile);
const SAFE_FILENAME = /^[a-z0-9][a-z0-9@._-]*$/u;
const SHA256 = /^[0-9a-f]{64}$/u;

let cachedRepoRoot: Promise<string | null> | undefined;
function repoRoot(): Promise<string | null> {
  cachedRepoRoot ??= execFileAsync("git", ["rev-parse", "--show-toplevel"]).then(({ stdout }) => stdout.trim(), () => null);
  return cachedRepoRoot;
}

/**
 * Which of these absolute paths git currently tracks, batched into one `git ls-files` call. Fails open (reports
 * nothing tracked) when there is no git repository to ask, such as an isolated test fixture.
 */
async function defaultGitTrackedPaths(paths: readonly string[]): Promise<Set<string>> {
  if (!paths.length) return new Set();
  const root = await repoRoot();
  if (!root) return new Set();
  const tracked = await execFileAsync("git", ["ls-files", "-z", "--full-name", "--", ...paths], { maxBuffer: 1024 * 1024 * 64 })
    .then(({ stdout }) => new Set(stdout.split("\0").filter(Boolean).map(name => resolve(root, name))), () => new Set<string>());
  return new Set(paths.filter(path => tracked.has(resolve(path))));
}

/** A tracked file in an inventory is a bug: `setup:assets` would overwrite a contributor's committed bytes with R2's. */
async function rejectGitTrackedAssets(objectId: string, root: string, filenames: readonly string[],
  gitTrackedPaths: (paths: readonly string[]) => Promise<Set<string>>): Promise<void> {
  const tracked = await gitTrackedPaths(filenames.map(name => resolve(root, name)));
  if (!tracked.size) return;
  const trackedNames = filenames.filter(name => tracked.has(resolve(root, name)));
  if (!trackedNames.length) return;
  throw new TypeError(`Object ${objectId} inventory includes git-tracked file(s), which setup:assets would silently overwrite: ${trackedNames.join(", ")}.`);
}

export function normalizeRuntimeAssetUrls({ objectId, urls }: { objectId: string; urls: readonly string[] }) {
  if (!/^[a-z][a-z0-9-]*$/u.test(objectId) || !isArray(urls) || urls.length === 0) {
    throw new TypeError("Runtime asset inventory is incompatible.");
  }
  const prefix = `/scenes/${objectId}/`;
  const filenames = [];
  const seenUrls = new Set();
  const seenFilenames = new Set();
  for (const url of urls) {
    if (typeof url !== "string" || !url.startsWith(prefix) ||
        url.slice(prefix.length) !== basename(url) ||
        !SAFE_FILENAME.test(basename(url))) {
      throw new TypeError(`Object ${objectId} has an unsafe runtime asset URL.`);
    }
    const filename = basename(url);
    if (seenUrls.has(url) || seenFilenames.has(filename)) {
      throw new TypeError(`Object ${objectId} repeats runtime asset ${filename}.`);
    }
    seenUrls.add(url);
    seenFilenames.add(filename);
    filenames.push(filename);
  }
  return Object.freeze(filenames.sort((left, right) => left.localeCompare(right)));
}

/** A relative path of safe components. A body's textures are flat; a volume's dataset previews sit under `datasets/`. */
function safeAssetPath(_location: AssetLocation, filename: string): boolean {
  return filename.split('/').every(component => SAFE_FILENAME.test(component));
}

const order = (left: InventoryAsset, right: InventoryAsset) =>
  left.location === right.location ? left.filename.localeCompare(right.filename) : left.location === 'public' ? -1 : 1;

export function validateInventory(objectId: string, input: unknown): true {
  const inventory = input as Inventory;
  if (!inventory || typeof inventory !== "object" || isArray(inventory) || inventory.schema !== INVENTORY_SCHEMA ||
      !isArray(inventory.assets) || inventory.assets.length === 0) {
    throw new TypeError(`Object ${objectId} inventory is incompatible.`);
  }
  const seen = new Set<string>();
  for (const asset of inventory.assets) {
    if (!asset || typeof asset !== "object" || !ASSET_LOCATIONS.includes(asset.location) || typeof asset.filename !== "string" ||
        !safeAssetPath(asset.location, asset.filename) || !Number.isSafeInteger(asset.bytes) || asset.bytes <= 0 || !SHA256.test(asset.sha256 ?? "")) {
      throw new TypeError(`Object ${objectId} has an invalid inventory entry.`);
    }
    const key = `${asset.location}/${asset.filename}`;
    if (seen.has(key)) throw new TypeError(`Object ${objectId} repeats inventory entry ${key}.`);
    seen.add(key);
  }
  return true;
}

export function requireInventory(objectId: string, input: unknown): Readonly<Inventory> {
  validateInventory(objectId, input);
  return input as Inventory;
}

/** The object's inventory, or null when it ships nothing baked. */
export async function readInventory(objectId: string, objectDirectory: string): Promise<Readonly<Inventory> | null> {
  const text = await readFile(resolve(objectDirectory, INVENTORY_FILE), 'utf8').catch((error: unknown) => {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null; throw error;
  });
  return text === null ? null : requireInventory(objectId, JSON.parse(text));
}

/** The inventory with one location's entries replaced; the other location's entries are kept as they were. */
export function mergeInventory(current: Readonly<Inventory> | null, location: AssetLocation,
  assets: readonly { filename: string; bytes: number; sha256: string }[]): Readonly<Inventory> {
  const kept = (current?.assets ?? []).filter(asset => asset.location !== location);
  const next = [...kept, ...assets.map(asset => ({ location, filename: asset.filename, bytes: asset.bytes, sha256: asset.sha256 }))].sort(order);
  return Object.freeze({ schema: INVENTORY_SCHEMA, assets: Object.freeze(next) });
}

export const inventoryText = (inventory: Readonly<Inventory>) => `${JSON.stringify(inventory, null, 2)}\n`;

/**
 * Record one location's baked files in the object's inventory. The bake's stages call this independently: the
 * scene stage for `public` textures, finalization for `prepared/`. With no assets left in either location the
 * inventory file is removed; the object ships nothing baked.
 */
export async function updateInventory({ objectId, objectDirectory, location, assets }: {
  objectId: string; objectDirectory: string; location: AssetLocation; assets: readonly { filename: string; bytes: number; sha256: string }[];
}): Promise<Readonly<Inventory> | null> {
  const merged = mergeInventory(await readInventory(objectId, objectDirectory), location, assets);
  const path = resolve(objectDirectory, INVENTORY_FILE);
  if (!merged.assets.length) { await rm(path, { force: true }); return null; }
  validateInventory(objectId, merged);
  const temporary = `${path}.partial-${process.pid}-${randomUUID()}`;
  try {
    await writeFile(temporary, inventoryText(merged), { flag: "wx" });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
  return merged;
}

async function hashedAssets(root: string, filenames: readonly string[], objectId: string) {
  const assets = [];
  for (const filename of filenames) {
    if (!(await lstat(resolve(root, filename)).catch(() => undefined))?.isFile()) throw new Error(`Inventoried asset is not a regular file: ${objectId}/${filename}.`);
    const bytes = await readFile(resolve(root, filename));
    assets.push(Object.freeze({ filename, bytes: bytes.byteLength, sha256: sha256(bytes) }));
  }
  return assets;
}

/** Inventory the object's public scene textures from the URLs its runtime references. */
export async function inventoryPublicAssets({ objectId, objectDirectory, urls, publicRoot, allowPreparationArtifacts = false,
  gitTrackedPaths = defaultGitTrackedPaths }: {
  objectId: string; objectDirectory: string; urls: readonly string[]; publicRoot: string; allowPreparationArtifacts?: boolean;
  gitTrackedPaths?: (paths: readonly string[]) => Promise<Set<string>>;
}) {
  const filenames = normalizeRuntimeAssetUrls({ objectId, urls });
  // Offline baking may emit intermediate densities. They are not shipped; production assembly still enforces closure.
  if (!allowPreparationArtifacts) await assertDirectoryClosure(publicRoot, filenames, objectId);
  await rejectGitTrackedAssets(objectId, publicRoot, filenames, gitTrackedPaths);
  return updateInventory({ objectId, objectDirectory, location: 'public', assets: await hashedAssets(publicRoot, filenames, objectId) });
}

/**
 * Files under a body's `prepared/` that a checkout regenerates itself, so they are never inventoried or published:
 * the staging-only inventory, JSON transport and page written from the restored runtime, the provenance record `prepare-provenance` generates
 * from the manifest (for scene bodies only), and the radial-terrain reports and source-index rasters that only the
 * audits read.
 */
export function isRegeneratedPreparedFile(filename: string, provenanceRegenerated = true): boolean {
  return ['inventory.json', 'object.json', 'page.json'].includes(filename) || (provenanceRegenerated && filename === 'provenance.json') ||
    /^terrain(-[a-z0-9-]+)?\.json$/u.test(filename) || /-source-index\.json$/u.test(filename);
}

/**
 * `prepare-provenance` regenerates the provenance of scene bodies (layered bodies) only. A volume, image-layer or
 * catalogue package's `provenance.json` comes from its bake, so it is inventoried and published like its other files.
 */
export async function provenanceIsRegenerated(objectDirectory: string): Promise<boolean> {
  const text = await readFile(resolve(objectDirectory, 'object.json'), 'utf8').catch((error: unknown) => {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null; throw error;
  });
  if (text === null) return true;
  const descriptor: unknown = JSON.parse(text);
  return !!descriptor && typeof descriptor === 'object' && (descriptor as { type?: unknown }).type === 'layered-body';
}

/** Every baked file under an object's `prepared/`: what the inventory publishes and `setup:assets` restores. */
export async function bakedPreparedFiles(preparedRoot: string, objectId: string, provenanceRegenerated = true): Promise<string[]> {
  return (await runtimeFiles(preparedRoot, objectId, true)).filter(name => !isRegeneratedPreparedFile(name, provenanceRegenerated));
}

/** Inventory the object's baked `prepared/` files: an explicit list, or everything baked under `preparedRoot`. */
export async function inventoryPreparedAssets({ objectId, objectDirectory, preparedRoot = resolve(objectDirectory, 'prepared'), filenames,
  exclude = [], gitTrackedPaths = defaultGitTrackedPaths }: {
  objectId: string; objectDirectory: string; preparedRoot?: string; filenames?: readonly string[]; exclude?: readonly string[];
  gitTrackedPaths?: (paths: readonly string[]) => Promise<Set<string>>;
}) {
  const excluded = new Set(exclude);
  const names = [...(filenames ?? (await bakedPreparedFiles(preparedRoot, objectId, await provenanceIsRegenerated(objectDirectory))).filter(name => !excluded.has(name)))]
    .sort((left, right) => left.localeCompare(right));
  for (const name of names) if (!safeAssetPath('prepared', name)) throw new TypeError(`Object ${objectId} has an unsafe prepared asset path: ${name}.`);
  if (new Set(names).size !== names.length) throw new TypeError(`Object ${objectId} repeats a prepared asset path.`);
  await rejectGitTrackedAssets(objectId, preparedRoot, names, gitTrackedPaths);
  return updateInventory({ objectId, objectDirectory, location: 'prepared', assets: await hashedAssets(preparedRoot, names, objectId) });
}

/** Production assembly: the public scene directory holds exactly the inventoried public textures. */
export async function assembleRuntimeAssetClosure({ objectId, objectDirectory, productionRoot }: {
  objectId: string; objectDirectory: string; productionRoot: string;
}) {
  const inventory = await readInventory(objectId, objectDirectory);
  const expected = new Set((inventory?.assets ?? []).filter(asset => asset.location === 'public').map(({ filename }) => filename));
  for (const name of await runtimeFiles(productionRoot, objectId, false)) if (!expected.has(name)) await unlink(resolve(productionRoot, name));
  if (inventory) await verifyInventory({ objectId, inventory, publicRoot: productionRoot, locations: ['public'] });
  return inventory;
}

/**
 * Every inventoried file exists with its bytes and hash. With `closure` (default true) a location's directory
 * holds exactly the inventoried files plus `exclude`; without it, undeclared neighbours are expected (a body's
 * `prepared/` also holds the files a checkout regenerates).
 */
export async function verifyInventory({ objectId, inventory, preparedRoot, publicRoot, locations = ASSET_LOCATIONS, closure = true, exclude = [] }: {
  objectId: string; inventory: Readonly<Inventory>; preparedRoot?: string; publicRoot?: string; locations?: readonly AssetLocation[];
  closure?: boolean; exclude?: readonly string[];
}) {
  validateInventory(objectId, inventory);
  for (const location of locations) {
    const assets = inventory.assets.filter(asset => asset.location === location);
    if (!assets.length) continue;
    const root = location === 'public' ? publicRoot : preparedRoot;
    if (!root) throw new TypeError(`Verifying ${location} inventory entries needs their directory.`);
    if (closure) await assertDirectoryClosure(root, assets.map(({ filename }) => filename), objectId, location === 'prepared', exclude);
    for (const asset of assets) {
      const bytes = await readFile(resolve(root, asset.filename)).catch(() => null);
      if (!bytes) throw new Error(`Object ${objectId} inventory closure mismatch. Missing: ${asset.filename}.`);
      if (bytes.byteLength !== asset.bytes || sha256(bytes) !== asset.sha256) throw new Error(`Object ${objectId} ${location} asset drifted: ${asset.filename}.`);
    }
  }
  return true;
}

async function runtimeFiles(root: string, objectId: string, nested: boolean, prefix = ""): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const name = `${prefix}${entry.name}`;
    if (entry.isFile()) files.push(name);
    else if (nested && entry.isDirectory() && SAFE_FILENAME.test(entry.name)) {
      files.push(...await runtimeFiles(resolve(root, entry.name), objectId, true, `${name}/`));
    } else throw new Error(`Unexpected ${objectId} asset directory: ${name}.`);
  }
  return files;
}

async function assertDirectoryClosure(root: string, filenames: readonly string[], objectId: string, nested = false, exclude: readonly string[] = []) {
  const excluded = new Set(exclude);
  const actual = (await runtimeFiles(root, objectId, nested)).filter(filename => !excluded.has(filename) || filenames.includes(filename));
  const expected = [...filenames].sort((left, right) => left.localeCompare(right));
  actual.sort((left, right) => left.localeCompare(right));
  if (expected.join("\0") !== actual.join("\0")) {
    const expectedSet = new Set(expected), actualSet = new Set(actual);
    const missing = expected.filter(filename => !actualSet.has(filename)), undeclared = actual.filter(filename => !expectedSet.has(filename));
    throw new Error(`Object ${objectId} inventory closure mismatch. Missing: ${missing.join(", ") || "none"}. Undeclared: ${undeclared.join(", ") || "none"}.`);
  }
}

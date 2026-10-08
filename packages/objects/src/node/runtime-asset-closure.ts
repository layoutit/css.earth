import { sha256, discoverGitRoot } from '@cssearth/core/node';
import { isArray, isRecord, hasErrorCode } from '@cssearth/core';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, readdir, rename, rm, lstat, unlink, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { promisify } from "node:util";
import { deliveredPreparedFiles, isWorkingPreparedFile, preparedDeliveryContext } from './prepared-delivery.js';
import { storePreparedRuntime } from './prepared-runtime-files.js';

/**
 * One inventory per object, `src/objects/<id>/inventory.json`: every baked file the object ships that git does not
 * hold, with the bytes and hash R2 serves it under. A `public` asset lives at `site/public/scenes/<id>/<filename>`; a
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
  cachedRepoRoot ??= discoverGitRoot({ missing: { behavior: 'undefined' } }).then(root => root ?? null);
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
export async function inventoryPublicAssets({ objectId, objectDirectory, preparedDirectory = resolve(objectDirectory, 'prepared'), urls, publicRoot, allowPreparationArtifacts = false,
  gitTrackedPaths = defaultGitTrackedPaths }: {
  objectId: string; objectDirectory: string; preparedDirectory?: string; urls: readonly string[]; publicRoot: string; allowPreparationArtifacts?: boolean;
  gitTrackedPaths?: (paths: readonly string[]) => Promise<Set<string>>;
}) {
  // The arrival image belongs to navigation, so it is absent from the detail
  // runtime's texture entries. Keep its explicit prepared reference on rebakes.
  const arrival: unknown = await readFile(resolve(preparedDirectory, 'arrival-billboard.json'), 'utf8')
    .then(JSON.parse, error => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
  const references = [...urls];
  if (arrival !== null) {
    if (!isRecord(arrival) || typeof arrival.url !== 'string') throw new TypeError('Invalid prepared arrival asset.');
    if (!references.includes(arrival.url)) references.push(arrival.url);
    // The world billboard is that photograph at billboard size (packages/bake/src/site-assets/world-billboard.ts), written
    // with it and named by no runtime either: a rebake that carries the published set keeps it.
    const billboard = `${objectId}-billboard.webp`, billboardUrl = `/scenes/${objectId}/${billboard}`;
    if (!references.includes(billboardUrl) && (await lstat(resolve(publicRoot, billboard)).catch(() => undefined))?.isFile()) references.push(billboardUrl);
  }
  const filenames = normalizeRuntimeAssetUrls({ objectId, urls: references });
  // Offline baking may emit intermediate densities. They are not shipped; production assembly still enforces closure.
  if (!allowPreparationArtifacts) await assertDirectoryClosure(publicRoot, filenames, objectId);
  await rejectGitTrackedAssets(objectId, publicRoot, filenames, gitTrackedPaths);
  return updateInventory({ objectId, objectDirectory, location: 'public', assets: await hashedAssets(publicRoot, filenames, objectId) });
}

/** Every delivered file under an object's `prepared/`: what the inventory publishes and `setup:assets` restores. The
 * delivery ledger decides it (prepared-delivery.ts): working records are left out, and an undeclared record is refused. */
export async function bakedPreparedFiles(preparedRoot: string, objectId: string, objectDirectory = resolve(preparedRoot, '..')): Promise<string[]> {
  return deliveredPreparedFiles(await runtimeFiles(preparedRoot, objectId, true), objectId, await deliveryContext(objectDirectory));
}

/** What the object's own descriptor says about its delivery; a directory without one (a fixture, a stage) retains nothing. */
async function deliveryContext(objectDirectory: string) {
  const descriptor: unknown = await readFile(resolve(objectDirectory, 'object.json'), 'utf8').then(text => JSON.parse(text) as unknown, () => null);
  return preparedDeliveryContext(descriptor);
}

/** Re-inventory part of an object's `prepared/`: the rows `owns` selects are replaced by the baked files it selects, and
 * every other row stays as it is, so a file that is not restored on this machine keeps its row. For files a shared step
 * writes into many packages (the world's members, places and system views). */
export async function inventoryPreparedSubset({ objectId, objectDirectory, owns }: { objectId: string; objectDirectory: string; owns(filename: string): boolean }) {
  const preparedRoot = resolve(objectDirectory, 'prepared');
  const found = await runtimeFiles(preparedRoot, objectId, true).catch((error: unknown) => {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return [] as string[];
    throw error;
  });
  // Only the files this step owns pass the ledger: a leftover of another step in the same package is not this pin's to refuse.
  const names = deliveredPreparedFiles(found.filter(owns), objectId, await deliveryContext(objectDirectory)).sort((left, right) => left.localeCompare(right));
  const kept = ((await readInventory(objectId, objectDirectory))?.assets ?? []).filter(asset => asset.location === 'prepared' && !owns(asset.filename));
  return updateInventory({ objectId, objectDirectory, location: 'prepared', assets: [...kept, ...await hashedAssets(preparedRoot, names, objectId)] });
}

/** Inventory the object's baked `prepared/` files: an explicit list, or everything baked under `preparedRoot`. */
export async function inventoryPreparedAssets({ objectId, objectDirectory, preparedRoot = resolve(objectDirectory, 'prepared'), filenames,
  exclude = [], gitTrackedPaths = defaultGitTrackedPaths }: {
  objectId: string; objectDirectory: string; preparedRoot?: string; filenames?: readonly string[]; exclude?: readonly string[];
  gitTrackedPaths?: (paths: readonly string[]) => Promise<Set<string>>;
}) {
  const excluded = new Set(exclude);
  // A baked runtime is listed in its stored form: its leaf boxes in their own file (prepared-runtime-files.ts).
  if (!filenames) await storePreparedRuntime(preparedRoot);
  const names = [...(filenames ?? (await bakedPreparedFiles(preparedRoot, objectId, objectDirectory)).filter(name => !excluded.has(name)))]
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
  // A working record beside the delivered files is the checkout's own (prepared-delivery.ts), not a gap in the inventory.
  const actual = (await runtimeFiles(root, objectId, nested)).filter(filename => filenames.includes(filename) || !excluded.has(filename) && !(nested && isWorkingPreparedFile(filename)));
  const expected = [...filenames].sort((left, right) => left.localeCompare(right));
  actual.sort((left, right) => left.localeCompare(right));
  if (expected.join("\0") !== actual.join("\0")) {
    const expectedSet = new Set(expected), actualSet = new Set(actual);
    const missing = expected.filter(filename => !actualSet.has(filename)), undeclared = actual.filter(filename => !expectedSet.has(filename));
    throw new Error(`Object ${objectId} inventory closure mismatch. Missing: ${missing.join(", ") || "none"}. Undeclared: ${undeclared.join(", ") || "none"}.`);
  }
}

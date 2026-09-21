import type { RuntimeAsset } from '../src/platform/runtime-asset-closure.mts';
export interface RuntimeAssetLocation extends RuntimeAsset { id: string; key: string; url: string; file: string; }
import { readFile, lstat } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { SCENE_OBJECTS } from "../site/objects.mts";
import { requireRuntimeAssetManifest, requirePreparedAssetManifest } from "../src/platform/runtime-asset-closure.mts";

import { RUNTIME_ASSET_ORIGIN } from './asset-origin.mts';
export { RUNTIME_ASSET_ORIGIN };

function parseObjectArgs(args: readonly string[]): string[] {
  return args.filter(arg => arg !== "--").map(arg => {
    if (!arg.startsWith("--object=")) throw new Error(`Unknown setup argument: ${arg}`);
    return arg.slice("--object=".length);
  });
}

export function setupObjectIds(args: readonly string[], root = resolve(import.meta.dirname, "..")) {
  const ids = parseObjectArgs(args);
  const selected = ids.length ? ids : SCENE_OBJECTS.map(({ id }) => id);
  if (new Set(selected).size !== selected.length ||
      selected.some(id => !/^[a-z][a-z0-9-]*$/u.test(id) || (!SCENE_OBJECTS.some(object => object.id === id) &&
        !existsSync(resolve(root, `src/objects/${id}/runtime-assets.json`)) &&
        !existsSync(resolve(root, `src/objects/${id}/prepared-assets.json`))))) {
    throw new Error("Choose an existing scene or an explicitly inventoried context resource with --object=<id>.");
  }
  return selected;
}

/**
 * `prepared-assets.json` inventories baked `prepared/*` output: either a body's `runtime.json`/`scene.json`
 * subset, or a context/nebula object's whole nested `prepared/` closure.
 * Unlike `setupObjectIds`, the default set is discovered by scanning `src/objects/*` (an open-ended registry,
 * not a second hardcoded list), so a newly inventoried object needs no change here.
 */
export function preparedAssetObjectIds(args: readonly string[], root = resolve(import.meta.dirname, "..")) {
  const ids = parseObjectArgs(args);
  const hasInventory = (id: string) => existsSync(resolve(root, `src/objects/${id}/prepared-assets.json`));
  const selected = ids.length ? ids : readdirSync(resolve(root, "src/objects"), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^[a-z][a-z0-9-]*$/u.test(entry.name) && hasInventory(entry.name))
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right));
  if (new Set(selected).size !== selected.length ||
      selected.some(id => !/^[a-z][a-z0-9-]*$/u.test(id) || !hasInventory(id))) {
    throw new Error("Choose an object with a prepared-assets.json inventory with --object=<id>.");
  }
  return selected;
}

async function locatedAssets<T extends RuntimeAsset>(root: string, id: string, assetRoot: string, assets: readonly T[]): Promise<(T & { id: string; key: string; url: string; file: string })[]> {
  const located = [];
  for (const asset of assets) {
    // Missing paths may be restored, but existing symlinks must never redirect installation.
    let current = resolve(root);
    for (const component of [...relative(root, assetRoot).split("/"), ...asset.filename.split("/")]) {
      current = resolve(current, component);
      const entry = await lstat(current).catch((error: unknown) => {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
        throw error;
      });
      if (entry?.isSymbolicLink()) throw new Error(`Runtime asset path is a symbolic link: ${id}/${asset.filename}`);
    }
    const key = `runtime-assets/${asset.sha256}/${asset.filename}`;
    located.push({ ...asset, id, key, url: `${RUNTIME_ASSET_ORIGIN}/${key}`, file: resolve(assetRoot, asset.filename) });
  }
  return located;
}

export async function runtimeAssets(root: string, objectIds: readonly string[],
  { filenames }: { filenames?: readonly string[] } = {}): Promise<RuntimeAssetLocation[]> {
  const assets: RuntimeAssetLocation[] = [];
  const selectedFilenames = filenames ? new Set(filenames) : null;
  for (const id of objectIds) {
    if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError(`Unsafe runtime object identity: ${id}`);
    const base = resolve(root, `src/objects/${id}`);
    const bytes = await readFile(resolve(base, "runtime-assets.json"));
    const manifest = requireRuntimeAssetManifest(id, JSON.parse(bytes.toString("utf8")));
    for (const asset of manifest.assets.filter(asset => !selectedFilenames || selectedFilenames.has(asset.filename))) {
      const assetRoot = manifest.resourceRoot === "prepared" && asset.location !== "public" ? resolve(base, "prepared") : resolve(root, `public/scenes/${id}`);
      assets.push(...await locatedAssets(root, id, assetRoot, [asset]));
    }
  }
  return assets;
}

/** Counterpart of `runtimeAssets` for `prepared-assets.json`: always resourceRoot `prepared`, never public. */
export async function preparedAssets(root: string, objectIds: readonly string[],
  { filenames }: { filenames?: readonly string[] } = {}): Promise<RuntimeAssetLocation[]> {
  const assets: RuntimeAssetLocation[] = [];
  const selectedFilenames = filenames ? new Set(filenames) : null;
  for (const id of objectIds) {
    if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError(`Unsafe prepared object identity: ${id}`);
    const base = resolve(root, `src/objects/${id}`);
    const bytes = await readFile(resolve(base, "prepared-assets.json"));
    const manifest = requirePreparedAssetManifest(id, JSON.parse(bytes.toString("utf8")));
    assets.push(...await locatedAssets(root, id, resolve(base, "prepared"),
      manifest.assets.filter(asset => !selectedFilenames || selectedFilenames.has(asset.filename))));
  }
  return assets;
}

function hasRuntimeAssets(root: string, id: string) { return existsSync(resolve(root, `src/objects/${id}/runtime-assets.json`)); }
function hasPreparedAssets(root: string, id: string) { return existsSync(resolve(root, `src/objects/${id}/prepared-assets.json`)); }

/**
 * Maintainer surface (publish, `check:assets-published`): every object id inventoried by either manifest kind,
 * without hardcoding which ids belong to which kind — an id may have `runtime-assets.json`, `prepared-assets.json`,
 * or (most bodies) both.
 */
export function inventoriedObjectIds(args: readonly string[], root = resolve(import.meta.dirname, "..")): string[] {
  const ids = parseObjectArgs(args);
  const hasEither = (id: string) => hasRuntimeAssets(root, id) || hasPreparedAssets(root, id);
  const selected = ids.length ? ids : readdirSync(resolve(root, "src/objects"), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^[a-z][a-z0-9-]*$/u.test(entry.name) && hasEither(entry.name))
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right));
  if (new Set(selected).size !== selected.length || selected.some(id => !/^[a-z][a-z0-9-]*$/u.test(id) || !hasEither(id))) {
    throw new Error("Choose an object inventoried by runtime-assets.json or prepared-assets.json with --object=<id>.");
  }
  return selected;
}

export async function inventoriedAssets(root: string, objectIds: readonly string[]): Promise<RuntimeAssetLocation[]> {
  const assets: RuntimeAssetLocation[] = [];
  for (const id of objectIds) {
    if (hasRuntimeAssets(root, id)) assets.push(...await runtimeAssets(root, [id]));
    if (hasPreparedAssets(root, id)) assets.push(...await preparedAssets(root, [id]));
  }
  return assets;
}

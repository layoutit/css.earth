import type { InventoryAsset, AssetLocation } from '../../src/platform/runtime-asset-closure.mts';
/** An inventoried file with where it is served from and where it lives in this checkout. */
export interface RuntimeAssetLocation extends InventoryAsset { id: string; key: string; url: string; file: string; }
import { readFile, lstat } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { INVENTORY_FILE, readInventory } from "../../src/platform/runtime-asset-closure.mts";

import { RUNTIME_ASSET_ORIGIN } from './asset-origin.mts';
export { RUNTIME_ASSET_ORIGIN };

function parseObjectArgs(args: readonly string[]): string[] {
  return args.filter(arg => arg !== "--").map(arg => {
    if (!arg.startsWith("--object=")) throw new Error(`Unknown setup argument: ${arg}`);
    return arg.slice("--object=".length);
  });
}

const hasInventory = (root: string, id: string) => existsSync(resolve(root, `src/objects/${id}/${INVENTORY_FILE}`));

/**
 * The objects with an inventory, or the `--object=<id>` selection. Discovered by scanning `src/objects/*`, an
 * open-ended registry, so a newly inventoried object needs no change here.
 */
export function inventoriedObjectIds(args: readonly string[], root = resolve(import.meta.dirname, "../..")): string[] {
  const ids = parseObjectArgs(args);
  const selected = ids.length ? ids : readdirSync(resolve(root, "src/objects"), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^[a-z][a-z0-9-]*$/u.test(entry.name) && hasInventory(root, entry.name))
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right));
  if (new Set(selected).size !== selected.length || selected.some(id => !/^[a-z][a-z0-9-]*$/u.test(id) || !hasInventory(root, id))) {
    throw new Error(`Choose an object with an ${INVENTORY_FILE} with --object=<id>.`);
  }
  return selected;
}

/** `--object=<id>` names any object package (its sources may precede a first bake); the default is every inventoried object. */
export function selectedObjectIds(args: readonly string[], root = resolve(import.meta.dirname, "../..")): string[] {
  const ids = parseObjectArgs(args);
  if (!ids.length) return inventoriedObjectIds([], root);
  if (new Set(ids).size !== ids.length || ids.some(id => !/^[a-z][a-z0-9-]*$/u.test(id) || !existsSync(resolve(root, `src/objects/${id}/object.json`)))) {
    throw new Error("Choose an existing object package with --object=<id>.");
  }
  return ids;
}

/** Where an inventoried file lives in this checkout. */
export function assetRoot(root: string, id: string, location: AssetLocation): string {
  return location === 'public' ? resolve(root, `public/scenes/${id}`) : resolve(root, `src/objects/${id}/prepared`);
}

/**
 * The inventoried files of these objects, located: the R2 key and URL they are served from, and the file they
 * restore to. `location` and `filenames` narrow the selection.
 */
export async function inventoryAssets(root: string, objectIds: readonly string[],
  { location, filenames }: { location?: AssetLocation; filenames?: readonly string[] } = {}): Promise<RuntimeAssetLocation[]> {
  const assets: RuntimeAssetLocation[] = [];
  const selectedFilenames = filenames ? new Set(filenames) : null;
  for (const id of objectIds) {
    if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError(`Unsafe object identity: ${id}`);
    const inventory = await readInventory(id, resolve(root, `src/objects/${id}`));
    if (!inventory) throw new Error(`No ${INVENTORY_FILE} for ${id}.`);
    for (const asset of inventory.assets) {
      if (location && asset.location !== location) continue;
      if (selectedFilenames && !selectedFilenames.has(asset.filename)) continue;
      const directory = assetRoot(root, id, asset.location);
      // Missing paths may be restored, but existing symlinks must never redirect installation.
      let current = resolve(root);
      for (const component of [...relative(root, directory).split("/"), ...asset.filename.split("/")]) {
        current = resolve(current, component);
        const entry = await lstat(current).catch((error: unknown) => {
          if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
          throw error;
        });
        if (entry?.isSymbolicLink()) throw new Error(`Runtime asset path is a symbolic link: ${id}/${asset.filename}`);
      }
      const key = `runtime-assets/${asset.sha256}/${asset.filename}`;
      assets.push({ ...asset, id, key, url: `${RUNTIME_ASSET_ORIGIN}/${key}`, file: resolve(directory, asset.filename) });
    }
  }
  return assets;
}

/** The small package metadata a deploy catalogue compiles from: each volume or context object's prepared record and presentation. */
export const VOLUME_METADATA_FILENAMES = ['presentation.json', 'provenance.json'] as const;

/** The volume and context objects, whose bulk data stays on R2 while a deploy catalogue reads only their metadata. */
export async function volumeMetadataObjectIds(root = resolve(import.meta.dirname, "..")): Promise<string[]> {
  const ids: string[] = [];
  for (const id of inventoriedObjectIds([], root)) {
    const text = await readFile(resolve(root, 'src/objects', id, 'source/presentation.json'), 'utf8').catch(() => null);
    if (text === null) continue;
    const presentation = JSON.parse(text) as { schema?: unknown; objectId?: unknown; provenance?: unknown };
    const volume = presentation.schema === 'cssearth-volume-presentation-source@1';
    if (!volume && presentation.provenance === undefined) continue;
    if (volume && presentation.objectId !== id) throw new TypeError(`Mismatched volume presentation object: ${id}.`);
    ids.push(id);
  }
  return ids;
}

/** Only the metadata a deploy catalogue needs; restoring every volume's bank here would be tens of gigabytes. */
export async function volumeMetadataAssets(root = resolve(import.meta.dirname, "..")) {
  const ids = await volumeMetadataObjectIds(root);
  const assets = await inventoryAssets(root, ids, { location: 'prepared', filenames: VOLUME_METADATA_FILENAMES });
  for (const id of ids) for (const filename of VOLUME_METADATA_FILENAMES) {
    if (assets.filter(asset => asset.id === id && asset.filename === filename).length !== 1) {
      throw new TypeError(`Catalogue package ${id} must inventory exactly one prepared/${filename}.`);
    }
  }
  return { ids, assets };
}

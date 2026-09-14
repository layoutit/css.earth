import type { RuntimeAsset, RuntimeManifest } from './objects/operations.ts';
export interface RuntimeAssetLocation extends RuntimeAsset { id: string; key: string; url: string; file: string; }
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { SCENE_OBJECTS } from "../site/objects.mts";
import { validateRuntimeAssetManifest } from "../src/platform/runtime-asset-closure.mts";

export const RUNTIME_ASSET_ORIGIN = "https://earth-assets.lowpoly.cc";

export function setupObjectIds(args: readonly string[]) {
  const ids = args.filter(arg => arg !== "--").map(arg => {
    if (!arg.startsWith("--object=")) throw new Error(`Unknown setup argument: ${arg}`);
    return arg.slice("--object=".length);
  });
  const selected = ids.length ? ids : SCENE_OBJECTS.map(({ id }) => id);
  if (new Set(selected).size !== selected.length ||
      selected.some(id => !SCENE_OBJECTS.some(object => object.id === id))) {
    throw new Error("Choose existing objects from SCENE_OBJECTS with --object=<id>.");
  }
  return selected;
}

export async function runtimeAssets(root: string, objectIds: readonly string[]): Promise<RuntimeAssetLocation[]> {
  const assets: RuntimeAssetLocation[] = [];
  for (const id of objectIds) {
    const manifest: unknown = JSON.parse(await readFile(resolve(root, `src/objects/${id}/runtime-assets.json`), "utf8"));
    validateRuntimeAssetManifest(id, manifest);
    // The validator above checks filenames, byte counts and hashes for every asset.
    for (const asset of (manifest as RuntimeManifest).assets) {
      const key = `runtime-assets/${asset.sha256}/${asset.filename}`;
      assets.push({ ...asset, id, key, url: `${RUNTIME_ASSET_ORIGIN}/${key}`,
        file: resolve(root, `public/scenes/${id}/${asset.filename}`) });
    }
  }
  return assets;
}

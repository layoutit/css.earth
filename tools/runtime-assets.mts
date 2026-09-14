import type { RuntimeAsset } from '../src/platform/runtime-asset-closure.mts';
export interface RuntimeAssetLocation extends RuntimeAsset { id: string; key: string; url: string; file: string; }
import { readFile, lstat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { SCENE_OBJECTS } from "../site/objects.mts";
import { requireRuntimeAssetManifest } from "../src/platform/runtime-asset-closure.mts";

export const RUNTIME_ASSET_ORIGIN = "https://earth-assets.lowpoly.cc";

export function setupObjectIds(args: readonly string[], root = resolve(import.meta.dirname, "..")) {
  const ids = args.filter(arg => arg !== "--").map(arg => {
    if (!arg.startsWith("--object=")) throw new Error(`Unknown setup argument: ${arg}`);
    return arg.slice("--object=".length);
  });
  const selected = ids.length ? ids : SCENE_OBJECTS.map(({ id }) => id);
  if (new Set(selected).size !== selected.length ||
      selected.some(id => !/^[a-z][a-z0-9-]*$/u.test(id) || (!SCENE_OBJECTS.some(object => object.id === id) &&
        !existsSync(resolve(root, `src/objects/${id}/runtime-assets.json`))))) {
    throw new Error("Choose an existing scene or an explicitly inventoried context resource with --object=<id>.");
  }
  return selected;
}

export async function runtimeAssets(root: string, objectIds: readonly string[]): Promise<RuntimeAssetLocation[]> {
  const assets: RuntimeAssetLocation[] = [];
  for (const id of objectIds) {
    if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError(`Unsafe runtime object identity: ${id}`);
    const base = resolve(root, `src/objects/${id}`);
    const bytes = await readFile(resolve(base, "runtime-assets.json"));
    const manifest = requireRuntimeAssetManifest(id, JSON.parse(bytes.toString("utf8")));
    const mirror = await readFile(resolve(base, "prepared/runtime-assets.json")).catch((error: unknown) => {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
      throw error;
    });
    if (mirror && !mirror.equals(bytes)) throw new Error(`Runtime asset inventory mirrors differ: ${id}`);
    // Missing paths may be restored, but existing symlinks must never redirect installation.
    for (const asset of manifest.assets) {
      const assetRoot = manifest.resourceRoot === "prepared" && asset.location !== "public" ? resolve(base, "prepared") : resolve(root, `public/scenes/${id}`);
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
      assets.push({ ...asset, id, key, url: `${RUNTIME_ASSET_ORIGIN}/${key}`,
        file: resolve(assetRoot, asset.filename) });
    }
  }
  return assets;
}

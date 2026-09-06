import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { OBJECTS } from "../site/objects.mjs";
import { validateRuntimeAssetManifest } from "../src/platform/runtime-asset-closure.mjs";

export const RUNTIME_ASSET_ORIGIN = "https://earth-assets.lowpoly.cc";

export function setupObjectIds(args) {
  const ids = args.filter(arg => arg !== "--").map(arg => {
    if (!arg.startsWith("--object=")) throw new Error(`Unknown setup argument: ${arg}`);
    return arg.slice("--object=".length);
  });
  const selected = ids.length ? ids : OBJECTS.map(({ id }) => id);
  if (new Set(selected).size !== selected.length ||
      selected.some(id => !OBJECTS.some(object => object.id === id))) {
    throw new Error("Choose existing objects from OBJECTS with --object=<id>.");
  }
  return selected;
}

export async function runtimeAssets(root, objectIds) {
  const assets = [];
  for (const id of objectIds) {
    const manifest = JSON.parse(await readFile(resolve(root, `src/planets/${id}/runtime-assets.json`), "utf8"));
    validateRuntimeAssetManifest(id, manifest);
    for (const asset of manifest.assets) {
      const key = `runtime-assets/${asset.sha256}/${asset.filename}`;
      assets.push({ ...asset, id, key, url: `${RUNTIME_ASSET_ORIGIN}/${key}`,
        file: resolve(root, `public/scenes/${id}/${asset.filename}`) });
    }
  }
  return assets;
}

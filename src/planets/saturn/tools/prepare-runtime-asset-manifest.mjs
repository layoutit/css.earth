import { prepareRuntimeAssetManifest } from "../../../platform/runtime-asset-closure.mjs";
import { SATURN_PUBLIC_ROOT } from "./preparation-paths.mjs";
import { SATURN_RUNTIME_ASSET_URLS } from "./runtime-asset-inventory.mjs";

const manifest = await prepareRuntimeAssetManifest({
  planetId: "saturn",
  urls: SATURN_RUNTIME_ASSET_URLS,
  publicRoot: SATURN_PUBLIC_ROOT,
  manifestPath: new URL("../runtime-assets.json", import.meta.url),
});
console.log(`Prepared ${manifest.assets.length} Saturn runtime assets.`);

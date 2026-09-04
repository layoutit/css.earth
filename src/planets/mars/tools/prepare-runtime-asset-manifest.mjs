import { prepareRuntimeAssetManifest } from "../../../platform/runtime-asset-closure.mjs";
import { MARS_PUBLIC_ROOT } from "./preparation-paths.mjs";
import { MARS_RUNTIME_ASSET_URLS } from "./runtime-asset-inventory.mjs";

const manifest = await prepareRuntimeAssetManifest({
  planetId: "mars",
  urls: MARS_RUNTIME_ASSET_URLS,
  publicRoot: MARS_PUBLIC_ROOT,
  manifestPath: new URL("../runtime-assets.json", import.meta.url),
});
console.log(`Prepared ${manifest.assets.length} Mars runtime assets.`);

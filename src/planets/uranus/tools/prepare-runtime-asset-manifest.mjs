import { prepareRuntimeAssetManifest } from "../../../platform/runtime-asset-closure.mjs";
import { URANUS_PUBLIC_ROOT } from "./preparation-paths.mjs";
import { URANUS_RUNTIME_ASSET_URLS } from "./runtime-asset-inventory.mjs";

const manifest = await prepareRuntimeAssetManifest({
  planetId: "uranus",
  urls: URANUS_RUNTIME_ASSET_URLS,
  publicRoot: URANUS_PUBLIC_ROOT,
  manifestPath: new URL("../runtime-assets.json", import.meta.url),
});
console.log(`Prepared ${manifest.assets.length} Uranus runtime assets.`);

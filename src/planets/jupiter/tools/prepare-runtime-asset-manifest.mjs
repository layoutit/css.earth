import { prepareRuntimeAssetManifest } from "../../../platform/runtime-asset-closure.mjs";
import { JUPITER_PUBLIC_ROOT } from "./preparation-paths.mjs";
import { JUPITER_RUNTIME_ASSET_URLS } from "./runtime-asset-inventory.mjs";

const manifest = await prepareRuntimeAssetManifest({
  planetId: "jupiter",
  urls: JUPITER_RUNTIME_ASSET_URLS,
  publicRoot: JUPITER_PUBLIC_ROOT,
  manifestPath: new URL("../runtime-assets.json", import.meta.url),
});
console.log(`Prepared ${manifest.assets.length} Jupiter runtime assets.`);

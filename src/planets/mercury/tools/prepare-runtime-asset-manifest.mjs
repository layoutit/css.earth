import { prepareRuntimeAssetManifest } from "../../../platform/runtime-asset-closure.mjs";

import { MERCURY_PUBLIC_ROOT } from "./preparation-paths.mjs";
import { MERCURY_RUNTIME_ASSET_URLS } from "./runtime-asset-inventory.mjs";

const manifest = await prepareRuntimeAssetManifest({
  planetId: "mercury",
  urls: MERCURY_RUNTIME_ASSET_URLS,
  publicRoot: MERCURY_PUBLIC_ROOT,
  manifestPath: new URL("../runtime-assets.json", import.meta.url),
});
console.log(`Prepared ${manifest.assets.length} Mercury runtime assets.`);

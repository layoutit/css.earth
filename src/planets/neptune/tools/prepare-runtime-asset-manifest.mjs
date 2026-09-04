import { resolve } from "node:path";

import { prepareRuntimeAssetManifest } from "../../../platform/runtime-asset-closure.mjs";
import { NEPTUNE_RUNTIME_ASSET_URLS } from "./runtime-asset-inventory.mjs";

const manifest = await prepareRuntimeAssetManifest({
  planetId: "neptune",
  urls: NEPTUNE_RUNTIME_ASSET_URLS,
  publicRoot: resolve(import.meta.dirname, "../../../../public/scenes/neptune"),
  manifestPath: new URL("../runtime-assets.json", import.meta.url),
});
console.log(`Prepared ${manifest.assets.length} Neptune runtime assets.`);


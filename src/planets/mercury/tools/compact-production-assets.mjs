import { resolve } from "node:path";

import { assembleRuntimeAssetClosure } from "../../../platform/runtime-asset-closure.mjs";

const manifest = await assembleRuntimeAssetClosure({
  planetId: "mercury",
  manifestPath: new URL("../runtime-assets.json", import.meta.url),
  productionRoot: resolve("dist/scenes/mercury"),
});
console.log(`Assembled ${manifest.assets.length} Mercury production assets.`);

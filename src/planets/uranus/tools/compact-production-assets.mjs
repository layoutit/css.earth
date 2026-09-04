import { resolve } from "node:path";

import { assembleRuntimeAssetClosure } from "../../../platform/runtime-asset-closure.mjs";

const manifest = await assembleRuntimeAssetClosure({
  planetId: "uranus",
  manifestPath: new URL("../runtime-assets.json", import.meta.url),
  productionRoot: resolve("dist/scenes/uranus"),
});
console.log(`Assembled ${manifest.assets.length} Uranus production assets.`);

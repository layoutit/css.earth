import { resolve } from "node:path";

import { assembleRuntimeAssetClosure } from "../../../platform/runtime-asset-closure.mjs";

const manifest = await assembleRuntimeAssetClosure({
  planetId: "jupiter",
  manifestPath: new URL("../runtime-assets.json", import.meta.url),
  productionRoot: resolve("dist/scenes/jupiter"),
});
console.log(`Assembled ${manifest.assets.length} Jupiter production assets.`);

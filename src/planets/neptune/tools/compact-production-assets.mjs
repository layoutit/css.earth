import { resolve } from "node:path";

import { assembleRuntimeAssetClosure } from "../../../platform/runtime-asset-closure.mjs";

const manifest = await assembleRuntimeAssetClosure({
  planetId: "neptune",
  manifestPath: new URL("../runtime-assets.json", import.meta.url),
  productionRoot: resolve("dist/scenes/neptune"),
});
console.log(`Assembled ${manifest.assets.length} Neptune production assets.`);


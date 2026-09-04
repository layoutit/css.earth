import { resolve } from "node:path";
import { assembleRuntimeAssetClosure } from "../../../platform/runtime-asset-closure.mjs";

const manifest = await assembleRuntimeAssetClosure({
  planetId: "earth",
  manifestPath: new URL("../runtime-assets.json", import.meta.url),
  productionRoot: resolve("dist/scenes/earth"),
});
console.log(`Assembled ${manifest.assets.length} Earth production assets.`);

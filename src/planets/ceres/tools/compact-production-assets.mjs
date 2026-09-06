#!/usr/bin/env node

import { resolve } from "node:path";

import { assembleRuntimeAssetClosure } from
  "../../../platform/runtime-asset-closure.mjs";

const manifest = await assembleRuntimeAssetClosure({
  planetId: "ceres",
  manifestPath: new URL("../runtime-assets.json", import.meta.url),
  productionRoot: resolve("dist/scenes/ceres"),
});
console.log(`Assembled ${manifest.assets.length} Ceres production assets.`);

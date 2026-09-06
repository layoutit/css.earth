#!/usr/bin/env node

import { resolve } from "node:path";

import { assembleRuntimeAssetClosure } from
  "../../../platform/runtime-asset-closure.mjs";

const manifest = await assembleRuntimeAssetClosure({
  planetId: "ganymede",
  manifestPath: new URL("../runtime-assets.json", import.meta.url),
  productionRoot: resolve("dist/scenes/ganymede"),
});
console.log(`Assembled ${manifest.assets.length} Ganymede production assets.`);

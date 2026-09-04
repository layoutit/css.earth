#!/usr/bin/env node

import { resolve } from "node:path";

import { assembleRuntimeAssetClosure } from
  "../../../platform/runtime-asset-closure.mjs";

const manifest = await assembleRuntimeAssetClosure({
  planetId: "pluto",
  manifestPath: new URL("../runtime-assets.json", import.meta.url),
  productionRoot: resolve("dist/scenes/pluto"),
});
console.log(`Assembled ${manifest.assets.length} Pluto production assets.`);

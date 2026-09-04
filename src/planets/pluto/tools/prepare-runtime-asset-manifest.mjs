#!/usr/bin/env node

import { prepareRuntimeAssetManifest } from
  "../../../platform/runtime-asset-closure.mjs";
import { PLUTO_PUBLIC_ROOT } from "./preparation-paths.mjs";
import { PLUTO_RUNTIME_ASSET_URLS } from "./runtime-asset-inventory.mjs";

const manifest = await prepareRuntimeAssetManifest({
  planetId: "pluto",
  urls: PLUTO_RUNTIME_ASSET_URLS,
  publicRoot: PLUTO_PUBLIC_ROOT,
  manifestPath: new URL("../runtime-assets.json", import.meta.url),
});
console.log(`Prepared ${manifest.assets.length} Pluto runtime assets.`);

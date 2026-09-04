#!/usr/bin/env node

import { prepareRuntimeAssetManifest } from "../../../platform/runtime-asset-closure.mjs";
import { EARTH_PUBLIC_ROOT } from "./preparation-paths.mjs";
import { EARTH_RUNTIME_ASSET_URLS } from "./runtime-asset-inventory.mjs";

const manifest = await prepareRuntimeAssetManifest({
  planetId: "earth",
  urls: EARTH_RUNTIME_ASSET_URLS,
  publicRoot: EARTH_PUBLIC_ROOT,
  manifestPath: new URL("../runtime-assets.json", import.meta.url),
});
console.log(`Prepared ${manifest.assets.length} Earth runtime assets.`);

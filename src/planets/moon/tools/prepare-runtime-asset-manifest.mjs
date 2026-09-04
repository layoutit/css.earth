#!/usr/bin/env node

import { prepareRuntimeAssetManifest } from
  "../../../platform/runtime-asset-closure.mjs";
import { MOON_PUBLIC_ROOT } from "./preparation-paths.mjs";
import { MOON_RUNTIME_ASSET_URLS } from "./runtime-asset-inventory.mjs";

const manifest = await prepareRuntimeAssetManifest({
  planetId: "moon",
  urls: MOON_RUNTIME_ASSET_URLS,
  publicRoot: MOON_PUBLIC_ROOT,
  manifestPath: new URL("../runtime-assets.json", import.meta.url),
});
console.log(`Prepared ${manifest.assets.length} Moon runtime assets.`);

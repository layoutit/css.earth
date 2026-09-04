#!/usr/bin/env node

import { prepareRuntimeAssetManifest } from "../../../platform/runtime-asset-closure.mjs";
import { SUN_PUBLIC_ROOT } from "./preparation-paths.mjs";
import { SUN_RUNTIME_ASSET_URLS } from "./runtime-asset-inventory.mjs";

const manifest = await prepareRuntimeAssetManifest({
  planetId: "sun",
  urls: SUN_RUNTIME_ASSET_URLS,
  publicRoot: SUN_PUBLIC_ROOT,
  manifestPath: new URL("../runtime-assets.json", import.meta.url),
});
console.log(`Prepared ${manifest.assets.length} Sun runtime assets.`);

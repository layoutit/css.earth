#!/usr/bin/env node

import { prepareRuntimeAssetManifest } from "../../../platform/runtime-asset-closure.mjs";
import { VENUS_PUBLIC_ROOT } from "./preparation-paths.mjs";
import { VENUS_RUNTIME_ASSET_URLS } from "./runtime-asset-inventory.mjs";

const manifest = await prepareRuntimeAssetManifest({
  planetId: "venus",
  urls: VENUS_RUNTIME_ASSET_URLS,
  publicRoot: VENUS_PUBLIC_ROOT,
  manifestPath: new URL("../runtime-assets.json", import.meta.url),
});
console.log(`Prepared ${manifest.assets.length} Venus runtime assets.`);

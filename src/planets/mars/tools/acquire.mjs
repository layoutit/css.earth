#!/usr/bin/env node

import { verifyMarsSourceManifest } from "./source-manifest.mjs";

const refresh = process.argv.includes("--refresh");
const verifyOnly = process.argv.includes("--verify-only");
if (refresh && verifyOnly) {
  throw new TypeError("Mars acquisition accepts either --refresh or --verify-only.");
}
if (refresh) {
  await import("./acquire-sources.mjs");
} else {
  console.log(JSON.stringify(await verifyMarsSourceManifest(), null, 2));
}

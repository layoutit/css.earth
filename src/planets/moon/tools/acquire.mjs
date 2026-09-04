#!/usr/bin/env node

import { verifyMoonSourceManifest } from "./source-manifest.mjs";

const unsupported = process.argv.slice(2).filter((argument) =>
  !new Set(["--", "--verify-only"]).has(argument));
if (unsupported.length > 0) {
  throw new TypeError(`Unsupported Moon acquisition option: ${unsupported[0]}.`);
}
console.log(JSON.stringify(await verifyMoonSourceManifest(), null, 2));

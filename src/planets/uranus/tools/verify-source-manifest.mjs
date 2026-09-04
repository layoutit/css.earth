#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  assertUranusSourceBytes,
  uranusSourceManifest,
  verifyUranusSourceManifest,
} from "./source-manifest.mjs";

const result = await verifyUranusSourceManifest();
if (process.argv.includes("--probe")) {
  const entry = uranusSourceManifest().inputs[0];
  const bytes = Buffer.from(await readFile(resolve(
    import.meta.dirname,
    "../source",
    entry.path,
  )));
  bytes[0] ^= 1;
  let rejected = false;
  try {
    assertUranusSourceBytes(entry, bytes);
  } catch (error) {
    rejected = error.message.includes(entry.path) &&
      error.message.includes(entry.expectedSha256);
  }
  if (!rejected) throw new Error("Uranus source mutation probe was not rejected.");
}
console.log(JSON.stringify(result, null, 2));

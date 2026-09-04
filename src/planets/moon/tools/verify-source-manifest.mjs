#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  assertMoonSourceBytes,
  moonSourceManifest,
  verifyMoonSourceManifest,
} from "./source-manifest.mjs";

const result = await verifyMoonSourceManifest();
if (process.argv.includes("--probe")) {
  const entry = moonSourceManifest().inputs[0];
  const bytes = Buffer.from(await readFile(resolve(
    import.meta.dirname,
    "../source",
    entry.path,
  )));
  bytes[0] ^= 1;
  let rejected = false;
  try {
    assertMoonSourceBytes(entry, bytes);
  } catch (error) {
    rejected = error.message.includes(entry.path) &&
      error.message.includes(entry.expectedSha256);
  }
  if (!rejected) throw new Error("Moon source mutation probe was not rejected.");
}
console.log(JSON.stringify(result, null, 2));

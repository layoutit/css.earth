#!/usr/bin/env node

import { spawn } from "node:child_process";
import { resolve } from "node:path";

import { verifyJupiterSourceManifest } from "./source-manifest.mjs";

const refresh = process.argv.includes("--refresh");
const verifyOnly = process.argv.includes("--verify-only");
if (refresh && verifyOnly) {
  throw new TypeError("Jupiter acquisition accepts either --refresh or --verify-only.");
}
if (refresh) {
  await run(resolve(import.meta.dirname, "acquire-moon-catalog.mjs"), ["--refresh"]);
  await run(resolve(import.meta.dirname, "acquire-sources.mjs"), ["--refresh"]);
} else {
  await run(resolve(import.meta.dirname, "acquire-moon-catalog.mjs"), ["--verify-only"]);
  console.log(JSON.stringify(await verifyJupiterSourceManifest(), null, 2));
}

function run(script, argumentsList) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [script, ...argumentsList], {
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolvePromise();
      else reject(new Error(
        `Jupiter acquisition failed with ${signal ?? `exit ${code}`}.`,
      ));
    });
  });
}

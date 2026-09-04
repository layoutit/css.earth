#!/usr/bin/env node

import { spawn } from "node:child_process";
import { resolve } from "node:path";

import { verifySaturnSourceManifest } from "./source-manifest.mjs";

const refresh = process.argv.includes("--refresh");
const verifyOnly = process.argv.includes("--verify-only");
if (refresh && verifyOnly) {
  throw new TypeError("Saturn acquisition accepts either --refresh or --verify-only.");
}
const verificationScripts = [
  "acquire-lens-sources.mjs",
  "acquire-moon-sources.mjs",
  "acquire-moon-catalog.mjs",
  "acquire-atmosphere-spectrum.mjs",
];
if (verifyOnly) {
  for (const script of verificationScripts) {
    await run(resolve(import.meta.dirname, script), ["--verify-only"]);
  }
} else {
  const scripts = refresh ? verificationScripts : ["acquire-lens-sources.mjs"];
  for (const script of scripts) {
    await run(resolve(import.meta.dirname, script), refresh ? ["--refresh"] : []);
  }
}
console.log(JSON.stringify(await verifySaturnSourceManifest(), null, 2));

function run(script, argumentsList) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [script, ...argumentsList], {
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolvePromise();
      else reject(new Error(
        `Saturn acquisition failed with ${signal ?? `exit ${code}`}.`,
      ));
    });
  });
}

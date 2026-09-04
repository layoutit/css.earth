#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { SUN_PUBLIC_ROOT } from "./preparation-paths.mjs";
import { SUN_RUNTIME_ASSET_URLS } from "./runtime-asset-inventory.mjs";

export async function verifySunRasterReproduction() {
  const outputRoot = await mkdtemp(resolve(tmpdir(), "csssun-reproduction-"));
  try {
    await run("prepare-assets.mjs", [`--output=${outputRoot}`]);
    await run("prepare-starfield.mjs", [`--output=${outputRoot}`]);
    const digest = createHash("sha256");
    let totalBytes = 0;
    for (const url of SUN_RUNTIME_ASSET_URLS) {
      const filename = basename(url);
      const [accepted, reproduced] = await Promise.all([
        readFile(resolve(SUN_PUBLIC_ROOT, filename)),
        readFile(resolve(outputRoot, filename)),
      ]);
      if (!accepted.equals(reproduced)) {
        throw new Error(`Sun isolated reproduction drifted: ${filename}.`);
      }
      totalBytes += reproduced.byteLength;
      digest.update(filename);
      digest.update(reproduced);
    }
    return Object.freeze({
      schema: "csssun-isolated-raster-reproduction@1",
      assetCount: SUN_RUNTIME_ASSET_URLS.length,
      totalBytes,
      aggregateSha256: digest.digest("hex"),
      byteIdentical: true,
    });
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
}

function run(script, argumentsList) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      process.execPath,
      [resolve(import.meta.dirname, script), ...argumentsList],
      { stdio: ["ignore", "ignore", "inherit"] },
    );
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolvePromise();
      else reject(new Error(
        `Sun isolated reproduction failed with ${signal ?? `exit ${code}`}.`,
      ));
    });
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  console.log(JSON.stringify(await verifySunRasterReproduction(), null, 2));
}

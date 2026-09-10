#!/usr/bin/env node

import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { lstat } from "node:fs/promises";
import { setupObjectIds } from "./runtime-assets.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const ids = setupObjectIds(process.argv.slice(2));
for (const id of ids) {
  if (id === "earth") {
    const scienceDirectory = resolve(projectRoot, "src/planets/earth/source/science");
    try {
      await lstat(resolve(scienceDirectory, "mur-gibs.png"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await run(process.execPath, [
        resolve(projectRoot, "tools/objects/paged-ellipsoid/mur-imagery.mjs"), "restore", scienceDirectory,
      ]);
    }
  }
  // The acquisition plan owns formats and URLs. Default acquisition restores
  // only missing pins and verifies existing inputs without refreshing them.
  await run(process.execPath, [
    resolve(projectRoot, "tools/objects/dist/operations.js"), "acquire", id,
  ]);
  console.log(`${id}: source inputs restored and verified`);
}

if (ids.includes("earth")) await run(process.execPath, [
  resolve(projectRoot, "tools/objects/geographic-pages/operations/acquire-pinned-global-wmts.mjs"), "--object=earth",
]);

function run(command, argumentsList) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, argumentsList, { cwd: projectRoot, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`Source restoration failed with ${signal ?? `exit ${code}`}.`));
    });
  });
}

#!/usr/bin/env node

import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { setupObjectIds } from "./runtime-assets.mts";

const projectRoot = resolve(import.meta.dirname, "..");
const ids = setupObjectIds(process.argv.slice(2));
for (const id of ids) {
  // The acquisition plan owns formats and URLs. Default acquisition restores
  // only missing pins and verifies existing inputs without refreshing them.
  await run(process.execPath, [
    resolve(projectRoot, "tools/objects/dist/operations.js"), "acquire", id,
  ]);
  console.log(`${id}: source inputs restored and verified`);
}

if (ids.includes("earth")) await run(process.execPath, [
  resolve(projectRoot, "tools/objects/geographic-pages/operations/acquire-pinned-global-wmts.mts"), "--object=earth",
]);

function run(command: string, argumentsList: string[]) {
  return new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, argumentsList, { cwd: projectRoot, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`Source restoration failed with ${signal ?? `exit ${code}`}.`));
    });
  });
}

#!/usr/bin/env node
import { hasErrorCode } from './source-values.mts';
import { lstat, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { parseVolumeRecipe } from '@cssearth/volume-core/contracts/volume-recipe';
import { verifiedBytes } from '@cssearth/volume-bake/compact-inputs/density-grid';
import { acquireVolumeSource } from '../src/preparation/volume/acquisition.ts';
import { setupObjectIds } from "./runtime-assets.mts";

const projectRoot = resolve(import.meta.dirname, "..");
const ids = setupObjectIds(process.argv.slice(2));
for (const id of ids) {
  const volumeSource = resolve(projectRoot, 'src/objects', id, 'source');
  const volumeRecipeBytes = await readFile(resolve(volumeSource, 'volume.json')).catch(error => {
    if (hasErrorCode(error, 'ENOENT')) return undefined;
    throw error;
  });
  if (volumeRecipeBytes) {
    const recipe = parseVolumeRecipe(JSON.parse(volumeRecipeBytes.toString('utf8')) as unknown);
    if (recipe.grid.acquisition) {
      try {
        await verifiedBytes(volumeSource, recipe.grid);
      } catch (error) {
        if (!hasErrorCode(error, 'ENOENT')) throw error;
        const cache = await mkdtemp(resolve(tmpdir(), `cssearth-${id}-volume-`));
        try { await acquireVolumeSource(volumeSource, recipe, cache); }
        finally { await rm(cache, { recursive:true, force:true }); }
      }
      console.log(`${id}: pinned volume source restored and verified`);
      continue;
    }
  }
  if (id === "earth") {
    const scienceDirectory = resolve(projectRoot, "src/objects/earth/source/science");
    try {
      await lstat(resolve(scienceDirectory, "mur-gibs.png"));
    } catch (error) {
      if (!hasErrorCode(error, "ENOENT")) throw error;
      await run(process.execPath, [
        resolve(projectRoot, "tools/objects/paged-ellipsoid/mur-imagery.mts"), "restore", scienceDirectory,
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

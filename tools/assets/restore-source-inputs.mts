#!/usr/bin/env node
import { hasErrorCode } from '@cssearth/core';
import { lstat, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { parseVolumeRecipe } from '@cssearth/bake/volume';
import { sourceBytes } from '@cssearth/bake/volume/node';
import { publishSourceBytes } from '../../src/platform/source-acquisition.mts';
import { sourceArray, sourceObject, sourcePath } from '../../src/platform/source-catalog.mts';
import { fetchWithRetry, RUNTIME_ASSET_ORIGIN, sourceCacheUrl } from './source-mirror.mts';

const projectRoot = resolve(import.meta.dirname, "../..");
const argumentsList = process.argv.slice(2);
const repositoryVolumeMode = argumentsList.length === 1 && argumentsList[0] === '--repository-volumes';

async function repositoryVolumeObjectIds(): Promise<string[]> {
  const ids = [];
  for (const entry of await readdir(resolve(projectRoot, 'src/objects'), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sourceRoot = resolve(projectRoot, 'src/objects', entry.name, 'source');
    const manifest = await readFile(resolve(sourceRoot, 'manifest.json')).catch(error => {
      if (hasErrorCode(error, 'ENOENT')) return undefined;
      throw error;
    });
    const presentation = await readFile(resolve(sourceRoot, 'presentation.json')).catch(error => {
      if (hasErrorCode(error, 'ENOENT')) return undefined;
      throw error;
    });
    if (!manifest || !presentation) continue;
    if (sourceObject(JSON.parse(manifest.toString('utf8'))).schema === 'cssearth-volume-source-manifest@1' &&
        sourceObject(JSON.parse(presentation.toString('utf8'))).schema === 'cssearth-volume-presentation-source@1') ids.push(entry.name);
  }
  return ids.sort((left, right) => left.localeCompare(right));
}

async function restoreRepositoryVolumeInputs(id: string, sourceRoot: string): Promise<boolean> {
  const manifestBytes = await readFile(resolve(sourceRoot, 'manifest.json'));
  const manifest = sourceObject(JSON.parse(manifestBytes.toString('utf8')));
  if (manifest.schema !== 'cssearth-volume-source-manifest@1') return false;
  if (manifest.pathBase !== 'repository') throw new TypeError(`Invalid repository volume source manifest: ${id}.`);
  const entries = ['inputs', 'documents', 'generatedIntermediates'].flatMap(section =>
    sourceArray(manifest[section] ?? [], sourceObject).map(raw => ({ raw, generated: section === 'generatedIntermediates' })));
  for (const { raw, generated } of entries) {
    const path = sourcePath(raw.path);
    if (path.startsWith('.local/')) continue;
    // A tracked file arrives with the checkout; a download is fetched only while it is missing.
    const destination = resolve(projectRoot, path);
    const present = await lstat(destination).then(() => true, error => { if (hasErrorCode(error, 'ENOENT')) return false; throw error; });
    if (present) continue;
    const origin = typeof raw.origin === 'string' && raw.origin ? raw.origin : null;
    // A generated intermediate is written by the step the manifest names, not restored. It is ignored, so a
    // fresh checkout never holds one; the step that needs it fails on its own terms if it was never produced.
    if (!origin && generated) continue;
    if (!origin) throw new Error(`Repository volume source is missing and has no origin: ${id}/${path}.`);
    let lastError: unknown;
    for (const url of [sourceCacheUrl(RUNTIME_ASSET_ORIGIN, id, path), origin]) {
      try {
        await publishSourceBytes({ destination, bytes: await fetchWithRetry(fetch, url) });
        lastError = undefined;
        break;
      } catch (error) { lastError = error; }
    }
    if (lastError) throw lastError;
  }
  return true;
}

// Repository-volume restoration runs before the generated site catalogue exists in the nebula CI lane.
// Keep the body registry lazy: that mode discovers its packages directly from src/objects instead.
const ids = repositoryVolumeMode ? await repositoryVolumeObjectIds() :
  (await import('./runtime-assets.mts')).selectedObjectIds(argumentsList);
for (const id of ids) {
  const volumeSource = resolve(projectRoot, 'src/objects', id, 'source');
  if (repositoryVolumeMode) {
    await restoreRepositoryVolumeInputs(id, volumeSource);
    console.log(`${id}: repository volume source inputs restored and verified`);
    continue;
  }
  const volumeRecipeBytes = await readFile(resolve(volumeSource, 'volume.json')).catch(error => {
    if (hasErrorCode(error, 'ENOENT')) return undefined;
    throw error;
  });
  if (volumeRecipeBytes) {
    const recipe = parseVolumeRecipe(JSON.parse(volumeRecipeBytes.toString('utf8')) as unknown);
    if (recipe.grid.acquisition) {
      try {
        await sourceBytes(volumeSource, recipe.grid);
      } catch (error) {
        if (!hasErrorCode(error, 'ENOENT')) throw error;
        const cache = await mkdtemp(resolve(tmpdir(), `cssearth-${id}-volume-`));
        try {
          const { acquireVolumeSource } = await import('@cssearth/bake/density');
          await acquireVolumeSource(volumeSource, recipe, cache);
        }
        finally { await rm(cache, { recursive:true, force:true }); }
      }
      if (recipe.sky) {
        const [{ parseSkyRecipe }, { installRuntimeAssets }, { inventoryAssets }] = await Promise.all([
          import('@cssearth/bake/sky'), import('./setup.mts'), import('./runtime-assets.mts'),
        ]);
        const skyRecipe = parseSkyRecipe(JSON.parse((await sourceBytes(volumeSource, recipe.sky)).toString('utf8')) as unknown);
        if (skyRecipe.stars) {
          const starDirectory = resolve(projectRoot, 'src/objects', skyRecipe.stars.object);
          const assets = await inventoryAssets(projectRoot, [skyRecipe.stars.object], { location: 'prepared' });
          const result = await installRuntimeAssets(assets);
          console.log(`${id}: ${skyRecipe.stars.object} prepared dependency restored (${result.installed} downloaded, ${result.reused} reused)`);
        }
      }
      console.log(`${id}: pinned volume source restored and verified`);
      continue;
    }
  }
  if (await restoreRepositoryVolumeInputs(id, volumeSource)) {
    console.log(`${id}: repository volume source inputs restored and verified`);
    continue;
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

import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { hasErrorCode } from '@cssearth/core';
import { lstat, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { VOLUME_SOURCE_MANIFEST_SCHEMA, VOLUME_PRESENTATION_SOURCE_SCHEMA, parseVolumeSourceManifest, parseVolumeRecipe } from '@cssearth/objects';
import { sourceBytes } from '../volume/node/index.ts';
import { publishSourceBytes } from '../delivery/index.ts';
import { sourceArray, sourceObject, sourcePath } from '@cssearth/objects/sources';
import { RUNTIME_ASSET_ORIGIN, fetchWithRetry, sourceCacheUrl, sourceFileFormatProblem, sourceFormatProblem } from '../objects/sources/index.ts';

/**
 * Restore and verify the declared source inputs of the objects `argumentsList` selects (`--object=<id>`, or every one), in the
 * checkout at `root`: a volume's pinned grid and the prepared star bank its sky reads, a repository volume's downloads (from
 * the source mirror at `assetOrigin` first; an input with a `generator` only from there), Earth's MUR imagery, and every
 * other body through its acquisition plan (`packages/bake/cli/object-operations.mts acquire`). `--repository-volumes` restores only the repository volumes, found
 * from `src/objects` before the scene catalogue exists. `assetOrigin` is the asset host; a test points it at a local server.
 * A repository volume file is written only when its bytes are the format its extension names (`sourceFormatProblem`), so a
 * publisher page answering HTTP 200 is refused rather than saved as the image.
 */
export async function restoreSourceInputs(argumentsList: readonly string[], { root: projectRoot = checkoutProjectRoot(import.meta.url), assetOrigin = RUNTIME_ASSET_ORIGIN } = {}) {
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
      if (sourceObject(JSON.parse(manifest.toString('utf8'))).schema === VOLUME_SOURCE_MANIFEST_SCHEMA &&
          sourceObject(JSON.parse(presentation.toString('utf8'))).schema === VOLUME_PRESENTATION_SOURCE_SCHEMA) ids.push(entry.name);
    }
    return ids.sort((left, right) => left.localeCompare(right));
  }

  async function restoreRepositoryVolumeInputs(id: string, sourceRoot: string): Promise<boolean> {
    const manifestBytes = await readFile(resolve(sourceRoot, 'manifest.json'));
    const manifest = parseVolumeSourceManifest(JSON.parse(manifestBytes.toString('utf8')), { reader: 'restoration', objectId: id });
    if (manifest === null) return false;
    const entries = (['inputs', 'documents', 'generatedIntermediates'] as const).flatMap(section =>
      sourceArray(manifest[section] ?? [], sourceObject).map(raw => ({ raw, section })));
    for (const { raw, section } of entries) {
      const path = sourcePath(raw.path);
      if (path.startsWith('.local/')) continue;
      const entry = `${id}: ${path} (source/manifest.json ${section}, id ${JSON.stringify(raw.id ?? null)})`;
      // A tracked file arrives with the checkout; a download is fetched only while it is missing. A present file is never
      // replaced, but one whose bytes are not what its name says (a web page saved as an image) is refused before a bake reads it.
      const destination = resolve(projectRoot, path);
      const present = await lstat(destination).then(() => true, error => { if (hasErrorCode(error, 'ENOENT')) return false; throw error; });
      if (present) {
        const problem = await sourceFileFormatProblem(path, destination).catch(error => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
        if (problem) throw new Error(`${entry} holds ${problem}. Delete it and restore again.`);
        continue;
      }
      const mirror = sourceCacheUrl(assetOrigin, id, path);
      // A file this repository builds (a composite, a crop) has no publisher download: its origin names the material, not
      // the file. Only the source mirror holds it; otherwise its generator must make it.
      if (raw.generator !== undefined) {
        const generator = sourcePath(raw.generator), failure = await restore(path, destination, mirror);
        if (failure) throw new Error(`${entry} is built by field "generator" = "${generator}" and the source mirror has no usable copy: ` +
          `${mirror} ${failure}. Run ${/^\S+\.py(?:\s|$)/u.test(generator) ? 'python3' : 'node'} ${generator}, then publish it with node packages/bake/cli/publish-source-cache.mts --object=${id}.`);
        continue;
      }
      const origin = typeof raw.origin === 'string' && raw.origin ? raw.origin : null;
      // A generated intermediate is written by the step the manifest names, not restored. It is ignored, so a
      // fresh checkout never holds one; the step that needs it fails on its own terms if it was never produced.
      if (!origin && section === 'generatedIntermediates') continue;
      if (!origin) throw new Error(`${entry} is missing and has no field "origin" to restore it from.`);
      const mirrorFailure = await restore(path, destination, mirror);
      if (!mirrorFailure) continue;
      const originFailure = await restore(path, destination, origin);
      if (originFailure) throw new Error(`${entry} could not be restored. Source mirror ${mirror} ${mirrorFailure}. ` +
        `Field "origin" = "${origin}" ${originFailure}. If the origin is a publisher page rather than the file, give the entry a "generator" ` +
        `or publish the file with node packages/bake/cli/publish-source-cache.mts --object=${id}.`);
    }
    return true;
  }

  /** Fetch `url` and write it to `destination` when its bytes are the format `path` names; otherwise say why not. */
  async function restore(path: string, destination: string, url: string): Promise<string | null> {
    let bytes: Buffer;
    try { bytes = await fetchWithRetry(fetch, url); }
    catch (error) { return `failed: ${error instanceof Error ? error.message : String(error)}`; }
    const problem = sourceFormatProblem(path, bytes);
    if (problem) return `returned ${problem}`;
    await publishSourceBytes({ destination, bytes });
    return null;
  }

  // Repository-volume restoration runs before the generated site catalogue exists in the nebula CI lane.
  // Keep the body registry lazy: that mode discovers its packages directly from src/objects instead.
  const ids = repositoryVolumeMode ? await repositoryVolumeObjectIds() :
    (await import('../delivery/index.ts')).selectedObjectIds([...argumentsList], projectRoot);
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
            const { acquireVolumeSource } = await import('../density/index.ts');
            await acquireVolumeSource(volumeSource, recipe, cache);
          }
          finally { await rm(cache, { recursive:true, force:true }); }
        }
        console.log(`${id}: pinned volume source restored and verified`);
        continue;
      }
    }
    if (await restoreRepositoryVolumeInputs(id, volumeSource)) {
      console.log(`${id}: repository volume source inputs restored and verified`);
      continue;
    }
    // Earth's ENSO mosaics are rebuilt from their dated tile archives, which the restore fetches from the source mirror;
    // a date whose mosaic is present is left alone.
    if (id === "earth") {
      await run(process.execPath, [resolve(projectRoot, "packages/bake/authoring/earth/mur-imagery.mts"), "restore",
        resolve(projectRoot, "src/objects/earth/source/science"), assetOrigin]);
    }
    // The acquisition plan owns formats and URLs. Default acquisition restores
    // only missing pins and verifies existing inputs without refreshing them.
    await run(process.execPath, [
      resolve(projectRoot, "packages/bake/cli/object-operations.mts"), "acquire", id,
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
}

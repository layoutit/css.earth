/** Published plates share the site's source of truth. The recipe the lab edits is the tracked
 * `src/objects/<id>/source/recipe.json`; a full bake runs the site's own preparation of that object where the site
 * runs it, writing its `prepared/` files, presentation, inventory and its host's page; publishing is a separate,
 * explicit command. Only a draft (a coarser bake of the same recipe, to preview an edit) is lab scratch, in
 * `src/objects/<id>/.local/lab/draft`. */
import { isRecord } from '@cssearth/core';
import { validatePreparedImageLayerBank } from '@cssearth/objects';
import { readInventory, verifyInventory } from '@cssearth/objects/node';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, readdir, rename, rm, stat, symlink, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { draftBake, platesDirectory, plateObjectId, type PlateQuality } from '../../../features/plates/plates-paths.ts';
import { PLATE_BAKE_SCHEMA, readPlateQuality, type PlateBakeReceipt } from '../../../features/plates/plates-receipt.ts';
import { workingRecipeText } from './working-copy.ts';

export interface PlateBakeRequest { action: 'apply'; imageId: string; object: string; quality: PlateQuality }
/** The site's commands, relative to the repository root, in the order an object's README gives them. */
const RESTORE = 'packages/bake/cli/restore-source-inputs.mts', LAYERS = 'packages/bake/cli/prepare-image-layers.mts',
  BACKING = 'packages/bake/cli/prepare-galaxy-backing.mts', PRESENTATION = 'site/build/prepare/catalog/prepare-volume-presentation.mts',
  SETUP = 'packages/bake/cli/setup-assets.mts', OBJECTS = 'packages/bake/cli/prepare-objects.mts',
  CHECK_PUBLISHED = 'packages/bake/cli/check-assets-published.mts', PUBLISH = 'packages/bake/cli/publish-runtime-assets.mts', STALE_BUILDS = 'packages/bake/cli/check-stale-builds.mts';

export function readPlateBakeRequest(value: unknown, configured: readonly string[]): PlateBakeRequest {
  if (!isRecord(value) || Object.keys(value).some(key => !['action', 'imageId', 'object', 'quality'].includes(key)) || value.action !== 'apply' ||
      typeof value.object !== 'string' || value.imageId !== value.object) throw new TypeError('Expected a plate bake request for one image-layer object.');
  plateObjectId(value.object);
  if (!configured.includes(value.object)) throw new TypeError(`${value.object} is not a configured published-plates object.`);
  return { action: 'apply', imageId: value.object, object: value.object, quality: readPlateQuality(value.quality) };
}
/** Subjects configured with the plates method name the objects the lab may edit, bake and publish. */
export function configuredPlateObjects(root: string): string[] {
  const records: unknown = JSON.parse(readFileSync(resolve(root, 'labs/nebula/packages/lab/src/state/subjects.json'), 'utf8'));
  if (!Array.isArray(records)) throw new TypeError('Lab subjects must be a list.');
  return [...new Set(records.flatMap(record => isRecord(record) && record.workflow === 'plates' && isRecord(record.plates) && typeof record.plates.object === 'string'
    ? [record.plates.object] : []))];
}

export function command(root: string, args: string[], signal: AbortSignal, log: (line: string) => void, cwd = root): Promise<string> {
  signal.throwIfAborted();
  return new Promise((accept, reject) => {
    const child = spawn(process.execPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const abort = () => { child.kill('SIGKILL'); };
    signal.addEventListener('abort', abort, { once: true });
    const read = (bytes: Buffer) => { const text = bytes.toString(); output = (output + text).slice(-20000); for (const line of text.split('\n')) if (line.trim()) log(line.trim()); };
    child.stdout.on('data', read); child.stderr.on('data', read);
    child.once('error', error => { signal.removeEventListener('abort', abort); reject(error); });
    child.once('close', code => {
      signal.removeEventListener('abort', abort);
      if (signal.aborted) reject(new DOMException('Plate bake cancelled.', 'AbortError'));
      else if (code !== 0) reject(new Error(`node ${args.join(' ')} failed (${code}).\n${output.slice(-4000)}`));
      else accept(output);
    });
  });
}

/** Reads a bank the bake wrote and checks every image it names is there at its recorded size. */
export async function verifyPlateBank(directory: string) {
  const descriptor: unknown = JSON.parse(await readFile(resolve(directory, 'object.json'), 'utf8'));
  if (!isRecord(descriptor) || descriptor.type !== 'image-layer-bank' || !isRecord(descriptor.prepared) || descriptor.prepared.url !== 'prepared/image-layers.json')
    throw new TypeError(`${directory}/object.json is not a baked image-layer object.`);
  const bank = validatePreparedImageLayerBank(JSON.parse(await readFile(resolve(directory, 'prepared/image-layers.json'), 'utf8')));
  if (bank.id !== descriptor.id) throw new TypeError(`${directory}: the bank is ${bank.id}, the descriptor ${String(descriptor.id)}.`);
  for (const resource of bank.resources) {
    const found = await stat(resolve(directory, 'prepared', resource.path));
    if (found.size !== resource.bytes) throw new TypeError(`${resource.path} is ${found.size} bytes; the bank records ${resource.bytes}.`);
  }
  return { leaves: bank.stacks.reduce((sum, stack) => sum + stack.leaves.length, 0), resources: bank.resources.length,
    bytes: bank.resources.reduce((sum, resource) => sum + resource.bytes, 0) };
}
export function hostOf(root: string, object: string): string {
  const descriptor: unknown = JSON.parse(readFileSync(resolve(root, object, 'object.json'), 'utf8'));
  const host = isRecord(descriptor) && isRecord(descriptor.properties) ? descriptor.properties.host : undefined;
  if (typeof host !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(host)) throw new TypeError(`${object}/object.json names no host.`);
  return host;
}
/** The other banks drawn for the same host: the host's page needs their prepared and public files too. */
function siblingsOf(root: string, object: string, host: string): string[] {
  const own = plateObjectId(object);
  return readdirSync(resolve(root, 'src/objects')).filter(id => id !== own && id !== host).filter(id => {
    try { const value: unknown = JSON.parse(readFileSync(resolve(root, 'src/objects', id, 'object.json'), 'utf8')); return isRecord(value) && isRecord(value.properties) && value.properties.host === host; }
    catch { return false; }
  });
}

/** The staged draft: the tracked descriptor, every tracked source file as a link, and the working recipe (the lab's
 * unsaved edits, or the tracked recipe when there are none) with a coarser bake. */
async function stageDraft(objectDirectory: string, staged: string, recipeText: string) {
  await mkdir(resolve(staged, 'source'), { recursive: true });
  await copyFile(resolve(objectDirectory, 'object.json'), resolve(staged, 'object.json'));
  for (const name of await readdir(resolve(objectDirectory, 'source'))) {
    if (name !== 'recipe.json') await symlink(resolve(objectDirectory, 'source', name), resolve(staged, 'source', name));
  }
  const recipe: unknown = JSON.parse(recipeText);
  if (!isRecord(recipe) || !isRecord(recipe.bake)) throw new TypeError(`${objectDirectory}: the recipe has no bake settings.`);
  await writeFile(resolve(staged, 'source/recipe.json'), JSON.stringify({ ...recipe, bake: draftBake(recipe.bake) }, null, 2) + '\n');
}
/** The staged source is links into the tracked source: they go first, so no removal ever reaches through one. */
async function unlinkSource(staged: string) {
  const source = resolve(staged, 'source');
  const found = await lstat(source).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return null; throw error; });
  if (!found) return;
  if (!found.isDirectory() || found.isSymbolicLink()) throw new Error(`${source} is not the staged source directory; it is left in place.`);
  for (const name of await readdir(source)) { const path = resolve(source, name); if ((await lstat(path)).isSymbolicLink()) await unlink(path); }
  await rm(source, { recursive: true, force: true });
}

export async function bakePlates(root: string, request: PlateBakeRequest, signal: AbortSignal,
  progress: (message: string, fraction: number, line?: string) => void): Promise<PlateBakeReceipt> {
  const started = performance.now(), id = plateObjectId(request.object), steps: { command: string; seconds: number }[] = [];
  const run = async (args: string[], label: string, fraction: number) => {
    const at = performance.now(); progress(label, fraction);
    await command(root, args, signal, line => progress(label, fraction, line));
    steps.push({ command: `node ${args.join(' ')}`, seconds: Math.round((performance.now() - at) / 100) / 10 });
  };
  const done = (counts: { leaves: number; resources: number; bytes: number }, directory: string): PlateBakeReceipt => ({ schema: PLATE_BAKE_SCHEMA,
    object: request.object, quality: request.quality, directory, steps, ...counts, seconds: Math.round((performance.now() - started) / 100) / 10, bakedAt: new Date().toISOString() });
  await run([RESTORE, `--object=${id}`], 'Restoring the registered photograph', .03);
  // The site's bake commands import the workspace packages (@cssearth/bake, objects, core, ...) from their built dist, not
  // their sources: a dist older than its sources bakes old code, or refuses a newer record. The shared stale-build
  // preflight rebuilds, in dependency order, only the packages whose sources changed since their last build.
  if (request.quality !== 'publish') await run([STALE_BUILDS, '--run'], 'Rebuilding changed workspace packages', .05);
  if (request.quality === 'publish') {
    await run([PUBLISH, `--object=${id}`], 'Publishing the inventoried files to R2', .2);
    return done(await verifyPlateBank(resolve(root, request.object)), request.object);
  }
  if (request.quality === 'full') {
    // The site's own preparation, where the site keeps its output.
    await run([LAYERS, request.object], 'Baking the plates (prepare-image-layers)', .1);
    if (existsSync(resolve(root, request.object, 'source/backing/recipe.json'))) await run([BACKING, request.object, 'backing'], 'Drawing the far-view plane (prepare-galaxy-backing)', .45);
    await run([PRESENTATION, `--object=${id}`], 'Presentation and inventory (prepare-volume-presentation)', .5);
    const host = hostOf(root, request.object), siblings = siblingsOf(root, request.object, host);
    // The host's page reads every bank drawn for it; the others' files come from R2 when they are missing, never this one's.
    for (const location of ['prepared', 'public']) await run([SETUP, `--object=${host}`, ...siblings.map(item => `--object=${item}`), `--location=${location}`], `Restoring ${host}'s other banks (${location})`, .55);
    await run([OBJECTS, `--object=${host}`], `Preparing the ${host} page (prepare-objects)`, .6);
    progress('Checking the inventory against the files', .95);
    const inventory = await readInventory(id, resolve(root, request.object));
    if (!inventory) throw new Error(`${request.object} has no inventory after its preparation.`);
    await verifyInventory({ objectId: id, inventory, preparedRoot: resolve(root, request.object, 'prepared'), publicRoot: resolve(root, 'site/public/scenes', id), closure: false });
    return done(await verifyPlateBank(resolve(root, request.object)), request.object);
  }
  // A draft: the tracked recipe, sampled more coarsely, into lab scratch.
  const directory = platesDirectory(request.object), final = resolve(root, directory);
  const staging = resolve(root, request.object, '.local/lab/.staging', randomUUID()), staged = resolve(staging, id), retired = resolve(staging, `${id}.retired`);
  try {
    await stageDraft(resolve(root, request.object), staged, await workingRecipeText(root, id));
    await run([LAYERS, staged], 'Baking a draft (prepare-image-layers)', .2);
    await unlinkSource(staged);
    const receipt = done(await verifyPlateBank(staged), directory);
    await writeFile(resolve(staged, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
    signal.throwIfAborted();
    // The previous draft stays whole until the new one is complete: it moves aside, the new one moves in, then it goes.
    await mkdir(dirname(final), { recursive: true });
    await rename(final, retired).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; });
    await rename(staged, final);
    return receipt;
  } finally {
    await unlinkSource(staged);
    await rm(staging, { recursive: true, force: true });
  }
}

/** Whether R2 serves every file the inventory lists: the site's own read-only check. */
export async function platePublished(root: string, object: string) {
  const id = plateObjectId(object);
  try {
    const output = await command(root, [CHECK_PUBLISHED, `--object=${id}`, '--report-only'], new AbortController().signal, () => {});
    const lines = output.trim().split('\n');
    return { ok: !/missing|404|not published/i.test(output), message: lines.slice(-2).join(' ').slice(0, 300) };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message.slice(-300) : String(error) }; }
}

import sharp from 'sharp';
import { parseRuntimeManifest } from './public-runtime-assets.ts';
import { sha256 } from '@cssearth/core/node';
import { bakedPreparedFiles, readInventory, mergeInventory, inventoryText } from '@cssearth/objects/node';
import type { RuntimeManifest } from './public-runtime-assets.ts';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hasErrorCode, requireArray, requireRecord, requireString } from '@cssearth/core';
import { writePreparedSet, type PreparedOutput } from './write-prepared-set.ts';


const safe = (name: unknown): name is string => typeof name === 'string' && /^[a-z0-9][a-z0-9@._-]*$/u.test(name);

/** Validate consumer JSON before publication; private preparation folders stay staged. */
export async function readPreparedJsonOutputs(directory: string) {
  const outputs = [];
  const entries = await readdir(directory, { withFileTypes: true }), names = new Set(entries.map(entry => entry.name));
  for (const entry of entries) {
    if (entry.isDirectory()) continue;
    if (!entry.isFile() || !entry.name.endsWith('.json')) throw new TypeError(`Prepared object output must contain only regular JSON files; found ${entry.name} in ${directory}.`);
    const path = resolve(directory, entry.name);
    JSON.parse(await readFile(path, 'utf8'));
    outputs.push({ filename: entry.name, path });
  }
  if (!outputs.length) throw new TypeError('Prepared object output has no JSON data.');
  return outputs.sort((left, right) => left.filename.localeCompare(right.filename));
}

/** Files in an object's public directory its inventory does not list. Publication refuses them, so a run checks first. */
export async function unownedPublicFiles(id: string, objectDirectory: string, publicDirectory: string): Promise<string[]> {
  const current = await readInventory(id, objectDirectory);
  const known = new Set(current === null ? [] : parseRuntimeManifest(current, id).assets?.map(asset => asset.filename) ?? []);
  const entries = await readdir(publicDirectory, { withFileTypes: true }).catch(error => { if (hasErrorCode(error, 'ENOENT')) return []; throw error; });
  return entries.filter(entry => !entry.isFile() || !known.has(entry.name)).map(entry => entry.name).sort();
}

/**
 * Baked files under an object's `prepared/` its inventory does not list: leftovers of an earlier preparation (a moved
 * dataset's folder, a file no step writes now). The pins after a run inventory the whole directory and would publish them,
 * so a run checks first. `shared` names the files a shared step writes into many packages and pins itself. An object with
 * no inventory has published nothing to compare with.
 */
export async function unownedPreparedFiles(id: string, objectDirectory: string, preparedDirectory: string, shared: (filename: string) => boolean = () => false): Promise<string[]> {
  const current = await readInventory(id, objectDirectory);
  if (current === null) return [];
  const known = new Set(current.assets.filter(asset => asset.location === 'prepared').map(asset => asset.filename));
  const baked = await bakedPreparedFiles(preparedDirectory, id, objectDirectory).catch(error => { if (hasErrorCode(error, 'ENOENT')) return [] as string[]; throw error; });
  return baked.filter(filename => !known.has(filename) && !shared(filename)).sort();
}

/** Preflight images and describe their writes; metadata joins the same set below. */
export async function preparedAssetWrites({ id, stage, destination, previous, manifest }: { id: string; stage: string; destination: string; previous: RuntimeManifest | null; manifest: RuntimeManifest }): Promise<PreparedOutput[]> {
  if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new TypeError('Invalid publication identity.');
  if (!manifest.assets?.length) throw new TypeError('Invalid prepared publication manifest.');
  const names = new Set<string>();
  for (const asset of manifest.assets) {
    if (!safe(asset.filename) || names.has(asset.filename)) throw new TypeError('Unsafe or duplicate prepared publication asset.');
    names.add(asset.filename);
    const bytes = await readFile(resolve(stage, asset.filename));
    if (bytes.length !== asset.bytes || sha256(bytes) !== asset.sha256) throw new Error(`Prepared publication asset drifted: ${asset.filename}`);
  }
  const known = new Set(previous?.assets?.map(asset => asset.filename) ?? []);
  const entries = await readdir(destination, { withFileTypes: true }).catch(error => { if (hasErrorCode(error, 'ENOENT')) return []; throw error; });
  for (const entry of entries) if (!entry.isFile() || !known.has(entry.name)) throw new Error(`Unowned canonical asset: ${entry.name}`);
  const writes: PreparedOutput[] = [...names].map(name => ({ path: resolve(destination, name), source: resolve(stage, name) }));
  writes.push(...entries.filter(entry => !names.has(entry.name)).map(entry => ({ path: resolve(destination, entry.name), remove: true as const })));
  return writes;
}

const optionalJson = async (path: string): Promise<unknown | null> => readFile(path, 'utf8').then(JSON.parse,
  error => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
function minimapPaths(value: unknown): string[] {
  if (value === null) return [];
  const paths = requireArray(requireRecord(value).images).map(value => requireString(requireRecord(value).path));
  if (new Set(paths).size !== paths.length || paths.some(path => !/^minimaps\/[a-z0-9][a-z0-9@._-]*\.webp$/.test(path))) throw new TypeError('Invalid minimap output path.');
  return paths;
}

/** A file can match inventory.json while belonging to an older atlas layout. Validate
 * the surface records against that inventory and the actual image before publishing. */
export async function verifySurfaceAssetRecords(id: string, surfaces: unknown, manifest: RuntimeManifest, publicDirectory: string) {
  const prefix=`/scenes/${id}/`, assets=new Map(manifest.assets.map(asset=>[prefix+asset.filename,asset]));
  const visit=async (value: unknown): Promise<void> => {
    if (Array.isArray(value)) { for (const item of value) await visit(item); return; }
    if (value === null || typeof value !== 'object') return;
    const record=requireRecord(value),asset=typeof record.url==='string'?assets.get(record.url):undefined;
    if (asset && 'bytes' in record) {
      if (asset.bytes!==record.bytes) throw new Error(`Surface record disagrees with published atlas: ${asset.filename}. Rebake the image and its layout together.`);
      if ('width' in record && 'height' in record) {
        const image=await sharp(resolve(publicDirectory,asset.filename)).metadata();
        if (image.width!==record.width || image.height!==record.height) throw new Error(`Surface dimensions disagree with published atlas: ${asset.filename}.`);
      }
    }
    for (const item of Object.values(record)) await visit(item);
  };
  await visit(surfaces);
}

/** Publish finalized images, previews, JSON and the descriptor as one prepared set. */
export async function publishPreparedObject({ id, stage, objectDirectory, publicDirectory, outputDirectory, projectRoot }: {
  id: string; stage: string; objectDirectory: string; publicDirectory: string; outputDirectory: string; projectRoot: string;
}) {
  const data = resolve(stage, 'prepared'), outputs = await readPreparedJsonOutputs(data);
  const manifest = parseRuntimeManifest(await optionalJson(resolve(data, 'inventory.json')), id);
  await verifySurfaceAssetRecords(id, await optionalJson(resolve(data, 'surfaces.json')), manifest, resolve(stage, 'public'));
  const current = await readInventory(id, objectDirectory);
  const stagedPrepared = await readInventory(id, stage);
  if (!stagedPrepared) throw new Error(`Prepared publication inventory is missing: ${id}.`);
  const previous = current === null ? null : parseRuntimeManifest(current, id);
  const writes = await preparedAssetWrites({ id, stage: resolve(stage, 'public'), destination: publicDirectory, previous, manifest });
  // Other steps write files under prepared/ that no bake stage produces (text.json, material.json, surfaces.json): a
  // rebake replaced the prepared entries with its own and dropped theirs, and #763's deploy failed on the missing text.json.
  // An entry the stage does not produce stays while the file on disk still has the bytes it records.
  const staged = stagedPrepared.assets.filter(asset => asset.location === 'prepared'), stagedNames = new Set(staged.map(asset => asset.filename));
  const unowned = [];
  for (const asset of current?.assets ?? []) if (asset.location === 'prepared' && !stagedNames.has(asset.filename)) {
    const bytes = await readFile(resolve(outputDirectory, asset.filename)).catch(() => null);
    if (bytes && sha256(bytes) === asset.sha256) unowned.push(asset);
  }
  const minimaps = minimapPaths(await optionalJson(resolve(data, 'minimaps.json')));
  const oldMinimaps = minimapPaths(await optionalJson(resolve(outputDirectory, 'minimaps.json')));
  writes.push(...minimaps.map(path => ({ path: resolve(outputDirectory, path), source: resolve(data, path) })),
    ...oldMinimaps.filter(path => !minimaps.includes(path)).map(path => ({ path: resolve(outputDirectory, path), remove: true as const })),
    // The staged inventory is published once, at the body root; prepared/ never carries a copy.
    ...outputs.filter(entry => entry.filename !== 'inventory.json').map(entry => ({ path: resolve(outputDirectory, entry.filename), source: entry.path })),
    { path: resolve(objectDirectory, 'inventory.json'), text: inventoryText(mergeInventory(
      mergeInventory(current, 'prepared', [...staged, ...unowned]),
      'public', manifest.assets)) },
    { path: resolve(objectDirectory, 'object.json'), source: resolve(stage, 'object.json') });
  JSON.parse(await readFile(resolve(stage, 'object.json'), 'utf8'));
  await writePreparedSet(writes);
}

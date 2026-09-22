import { sha256 } from '../../src/platform/sha256.mts';
import type { RuntimeManifest } from './operations.ts';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hasErrorCode, requireArray, requireRecord, requireString } from '../sources/source-values.mts';
import { writePreparedSet, type PreparedOutput } from '../prepared/write-prepared-set.mts';


const safe = (name: unknown): name is string => typeof name === 'string' && /^[a-z0-9][a-z0-9@._-]*$/u.test(name);

/** Validate consumer JSON before publication; private preparation folders stay staged. */
export async function readPreparedJsonOutputs(directory: string) {
  const outputs = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) continue;
    if (!entry.isFile() || !entry.name.endsWith('.json')) throw new TypeError('Prepared object output must contain only regular JSON files.');
    const path = resolve(directory, entry.name);
    JSON.parse(await readFile(path, 'utf8'));
    outputs.push({ filename: entry.name, path });
  }
  if (!outputs.length) throw new TypeError('Prepared object output has no JSON data.');
  return outputs.sort((left, right) => left.filename.localeCompare(right.filename));
}

/** Preflight images and describe their writes; metadata joins the same set below. */
export async function preparedAssetWrites({ id, stage, destination, previous, manifest }: { id: string; stage: string; destination: string; previous: RuntimeManifest | null; manifest: RuntimeManifest }): Promise<PreparedOutput[]> {
  if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new TypeError('Invalid publication identity.');
  if (manifest.schema !== `css${id}-runtime-assets@1` || !manifest.assets?.length) throw new TypeError('Invalid prepared publication manifest.');
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

/** Publish finalized images, previews, JSON and the descriptor as one prepared set. */
export async function publishPreparedObject({ id, stage, objectDirectory, publicDirectory, outputDirectory, projectRoot }: {
  id: string; stage: string; objectDirectory: string; publicDirectory: string; outputDirectory: string; projectRoot: string;
}) {
  const data = resolve(stage, 'prepared'), outputs = await readPreparedJsonOutputs(data);
  const { parseRuntimeManifest } = await import('./dist/operations.js');
  const manifest = parseRuntimeManifest(await optionalJson(resolve(data, 'runtime-assets.json')), id);
  const oldManifest = await optionalJson(resolve(objectDirectory, 'runtime-assets.json'));
  const previous = oldManifest === null ? null : parseRuntimeManifest(oldManifest, id);
  const writes = await preparedAssetWrites({ id, stage: resolve(stage, 'public'), destination: publicDirectory, previous, manifest });
  const minimaps = minimapPaths(await optionalJson(resolve(data, 'minimaps.json')));
  const oldMinimaps = minimapPaths(await optionalJson(resolve(outputDirectory, 'minimaps.json')));
  writes.push(...minimaps.map(path => ({ path: resolve(outputDirectory, path), source: resolve(data, path) })),
    ...oldMinimaps.filter(path => !minimaps.includes(path)).map(path => ({ path: resolve(outputDirectory, path), remove: true as const })),
    // The staged inventory is published once, at the body root; prepared/ never carries a copy.
    ...outputs.filter(entry => entry.filename !== 'runtime-assets.json').map(entry => ({ path: resolve(outputDirectory, entry.filename), source: entry.path })),
    { path: resolve(objectDirectory, 'runtime-assets.json'), source: resolve(data, 'runtime-assets.json') },
    { path: resolve(objectDirectory, 'object.json'), source: resolve(stage, 'object.json') });
  JSON.parse(await readFile(resolve(stage, 'object.json'), 'utf8'));
  await writePreparedSet(writes);
}

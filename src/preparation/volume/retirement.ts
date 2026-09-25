/** Retire only obsolete textures owned by the previous successful volume manifest. */
import { readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { containedPath } from '@cssearth/volume-bake/compact-inputs/density-grid';
import { text } from '@cssearth/bake/volume';
import { requireRecord as record } from '@cssearth/core';

function texturePath(outputDirectory: string, value: unknown): string {
  const path = text(value, 'prepared texture path');
  if (path === 'outer-disc.png') return containedPath(outputDirectory, path);
  const directory = path.startsWith('core/slices/') ? 'core/slices/' : 'slices/';
  if (!path.startsWith(directory)) throw new TypeError('Prepared volume textures must be contained in slices/ or core/slices/.');
  return containedPath(resolve(outputDirectory, directory), path.slice(directory.length));
}
export async function readPreviousVolumeTextures(outputDirectory: string): Promise<string[]> {
  let bytes: Buffer;
  // The intermediate slice manifest may belong to a failed compile. Ownership
  // comes only from the last successfully published runtime envelope.
  try { bytes = await readFile(resolve(outputDirectory, 'volume.json')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  const envelope = record(JSON.parse(bytes.toString('utf8')), 'published volume');
  const data = record(envelope.data, 'published volume data');
  if (!Array.isArray(data.resources)) throw new TypeError('Published volume must contain resources.');
  return data.resources.map((entry: unknown) => {
    const path = text(record(entry, 'published volume resource').path, 'prepared texture path');
    // Other prepared capabilities share the resource bank but own their files.
    containedPath(outputDirectory, path);
    if (ownedTexture(path)) texturePath(outputDirectory, path);
    return path;
  }).filter(ownedTexture);
}
function ownedTexture(path: string): boolean {
  return path === 'outer-disc.png' || path.startsWith('slices/') || path.startsWith('core/slices/');
}
export async function retireVolumeTextures(outputDirectory: string, previous: string[], current: string[]): Promise<void> {
  // Validate the entire operation before deleting its first file.
  const keep = new Set(current.map(path => texturePath(outputDirectory, path)));
  const retired = [...new Set(previous.map(path => texturePath(outputDirectory, path)))].filter(path => !keep.has(path));
  for (const path of retired) await rm(path, { force: true });
}

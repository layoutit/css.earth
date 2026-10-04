// The object folders of a checkout read as the catalogue: the registered descriptors that opt into the navigable catalogue,
// and the context objects the world loads without a catalogue entry. Preparation writes the application's prepared catalogue
// (`prepare:catalog`) from these reads; the checks and reports that need the descriptors themselves read them here.
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hasErrorCode, isRecord } from '@cssearth/core';
import { catalogEntry, defineObjects } from '../registry/index.js';
import type { CatalogEntry, NavigationDistance } from '../registry/index.js';

const byOrder = (a: CatalogEntry, b: CatalogEntry) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id, 'en');

/** Every object folder's descriptor, by folder name, read in parallel. A preparation reads the folders once and passes the
 * map to each reader below: three serial scans of 3,600 descriptors per step were most of an install's preparation time. */
export type ObjectDescriptors = ReadonlyMap<string, unknown>;
export async function readObjectDescriptors(objectsDirectory: string): Promise<ObjectDescriptors> {
  const names = (await readdir(objectsDirectory, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name);
  const read = await Promise.all(names.map(async name => {
    try {
      const path = resolve(objectsDirectory, name, 'object.json'), descriptor: unknown = JSON.parse(await readFile(path, 'utf8'));
      if (!isRecord(descriptor) || typeof descriptor.id !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(descriptor.id)) throw new TypeError(`${path}: authored descriptor id is required.`);
      if (descriptor.id !== name) throw new TypeError(`Catalogue identity differs: ${name}.`);
      return [descriptor.id, descriptor] as const;
    }
    catch (error) { if (hasErrorCode(error, 'ENOENT')) return null; throw error; }
  }));
  return new Map(read.filter(entry => entry !== null));
}

/** A folder alone is not a published destination. Its descriptor must opt in. `distance` places each descriptor for navigation
 * (preparation passes `prepareSceneDistance` from `@cssearth/bake/navigation`). */
export async function readCatalog(objectsDirectory: string, distance: (descriptor: unknown) => NavigationDistance,
  descriptors?: ObjectDescriptors) {
  const entries: CatalogEntry[] = [];
  for (const [name, descriptor] of descriptors ?? await readObjectDescriptors(objectsDirectory)) {
    if (!isRecord(descriptor) || !isRecord(descriptor.properties) || descriptor.properties.catalog === undefined) continue;
    if (descriptor.id !== name) throw new TypeError(`Catalogue identity differs: ${name}.`);
    entries.push(catalogEntry(descriptor, async () => { throw new Error('Catalogue preparation cannot mount a scene.'); }, distance(descriptor)));
  }
  entries.sort(byOrder);
  defineObjects(entries.map(({ order, context, ...object }) => object));
  return entries;
}

/** A descriptor that mounts no scene of its own is application context: the world loads its prepared resources directly.
 * So is an object seen from inside (`properties.zoom`): its scene is the world around the star the zoom came from. */
export async function readContextObjects(objectsDirectory: string, descriptors?: ObjectDescriptors) {
  const contexts: { id: string; type: string }[] = [];
  for (const [name, descriptor] of descriptors ?? await readObjectDescriptors(objectsDirectory)) {
    if (!isRecord(descriptor) || !isRecord(descriptor.properties) || descriptor.properties.catalog !== undefined && descriptor.properties.zoom === undefined) continue;
    if (descriptor.id !== name || typeof descriptor.type !== 'string') throw new TypeError(`Context object identity differs: ${name}.`);
    contexts.push({ id: name, type: descriptor.type });
  }
  return contexts.sort((a, b) => a.id.localeCompare(b.id, 'en'));
}

// The object folders of a checkout read as the catalogue: the registered descriptors that opt into the navigable catalogue,
// and the context objects the world loads without a catalogue entry. Preparation writes the application's prepared catalogue
// (`prepare:catalog`) from these reads; the checks and reports that need the descriptors themselves read them here.
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hasErrorCode, isRecord } from '@cssearth/core';
import { catalogEntry, defineObjects, isHostedDescriptor, overviewEntry } from '../registry/index.js';
import type { CatalogEntry, NavigationDistance, OverviewObject } from '../registry/index.js';

const byOrder = (a: CatalogEntry, b: CatalogEntry) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id, 'en');

/** Every object folder's descriptor, by folder name, read in parallel. A preparation reads the folders once and passes the
 * map to each reader below: three serial scans of 3,600 descriptors per step were most of an install's preparation time. */
export type ObjectDescriptors = ReadonlyMap<string, unknown>;
export async function readObjectDescriptors(objectsDirectory: string): Promise<ObjectDescriptors> {
  const names = (await readdir(objectsDirectory, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name);
  const read = await Promise.all(names.map(async name => {
    try { return [name, JSON.parse(await readFile(resolve(objectsDirectory, name, 'object.json'), 'utf8'))] as const; }
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

/** A descriptor that mounts no scene of its own is application context: the world loads its prepared resources directly. One
 * with a catalogue entry is also an object of the registry, drawn by the world's host (isHostedDescriptor). */
export async function readContextObjects(objectsDirectory: string, descriptors?: ObjectDescriptors) {
  const contexts: { id: string; type: string }[] = [];
  for (const [name, descriptor] of descriptors ?? await readObjectDescriptors(objectsDirectory)) {
    if (!isRecord(descriptor) || !isRecord(descriptor.properties) || descriptor.properties.catalog !== undefined && !isHostedDescriptor(descriptor)) continue;
    if (descriptor.id !== name || typeof descriptor.type !== 'string') throw new TypeError(`Context object identity differs: ${name}.`);
    contexts.push({ id: name, type: descriptor.type });
  }
  return contexts.sort((a, b) => a.id.localeCompare(b.id, 'en'));
}

/** The overviews the object folders author (`properties.overview`): levels above the star systems, each an entry of the one
 * registry hosted by `sceneHostId`, in their order on the zoom ladder. */
export async function readOverviews(objectsDirectory: string, sceneHostId: string, descriptors?: ObjectDescriptors) {
  const overviews: OverviewObject[] = [], read = descriptors ?? await readObjectDescriptors(objectsDirectory);
  for (const [name, descriptor] of read) {
    const overview = overviewEntry(descriptor, sceneHostId);
    if (!overview) continue;
    if (overview.id !== name) throw new TypeError(`Overview identity differs: ${name}.`);
    overviews.push(overview);
  }
  overviews.sort((a, b) => a.order - b.order);
  for (const [index, overview] of overviews.entries()) {
    if (index > 0 && overview.order === overviews[index - 1]!.order) throw new TypeError(`Overviews ${overviews[index - 1]!.id} and ${overview.id} share order ${overview.order} on the zoom ladder.`);
    for (const id of overview.packages) if (!read.has(id)) throw new TypeError(`Overview ${overview.id} draws package ${id}, which is not in ${objectsDirectory}.`);
    // One level holds each classification: a subject's breadcrumbs lead to exactly one.
    for (const other of overviews.slice(0, index)) for (const classification of overview.holds.flatMap(group => group.classifications)) {
      if (other.holds.some(group => group.classifications.includes(classification))) throw new TypeError(`Overviews ${other.id} and ${overview.id} both hold ${classification}.`);
    }
  }
  return overviews;
}

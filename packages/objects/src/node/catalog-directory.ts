// The object folders of a checkout read as the catalogue: the registered descriptors that opt into the navigable catalogue,
// and the context objects the world loads without a catalogue entry. Preparation writes the application's prepared catalogue
// (`prepare:catalog`) from these reads; the checks and reports that need the descriptors themselves read them here.
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hasErrorCode, isRecord } from '@cssearth/core';
import { catalogEntry, defineObjects, overviewEntry } from '../registry/index.js';
import type { CatalogEntry, NavigationDistance, OverviewObject } from '../registry/index.js';

const byOrder = (a: CatalogEntry, b: CatalogEntry) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id, 'en');

/** A folder alone is not a published destination. Its descriptor must opt in. `distance` places each descriptor for navigation
 * (preparation passes `prepareSceneDistance` from `@cssearth/bake/navigation`). */
export async function readCatalog(objectsDirectory: string, distance: (descriptor: unknown) => NavigationDistance) {
  const entries: CatalogEntry[] = [];
  for (const directory of await readdir(objectsDirectory, { withFileTypes: true })) {
    if (!directory.isDirectory()) continue;
    let descriptor: unknown;
    try { descriptor = JSON.parse(await readFile(resolve(objectsDirectory, directory.name, 'object.json'), 'utf8')); }
    catch (error) { if (hasErrorCode(error, 'ENOENT')) continue; throw error; }
    if (!isRecord(descriptor) || !isRecord(descriptor.properties) || descriptor.properties.catalog === undefined) continue;
    if (descriptor.id !== directory.name) throw new TypeError(`Catalogue identity differs: ${directory.name}.`);
    entries.push(catalogEntry(descriptor, async () => { throw new Error('Catalogue preparation cannot mount a scene.'); }, distance(descriptor)));
  }
  entries.sort(byOrder);
  defineObjects(entries.map(({ order, context, ...object }) => object));
  return entries;
}

/** Registered descriptors without a catalog entry are application context: the world loads their prepared resources directly. */
export async function readContextObjects(objectsDirectory: string) {
  const contexts: { id: string; type: string }[] = [];
  for (const directory of await readdir(objectsDirectory, { withFileTypes: true })) {
    if (!directory.isDirectory()) continue;
    let descriptor: unknown;
    try { descriptor = JSON.parse(await readFile(resolve(objectsDirectory, directory.name, 'object.json'), 'utf8')); }
    catch (error) { if (hasErrorCode(error, 'ENOENT')) continue; throw error; }
    if (!isRecord(descriptor) || !isRecord(descriptor.properties) || descriptor.properties.catalog !== undefined) continue;
    if (descriptor.id !== directory.name || typeof descriptor.type !== 'string') throw new TypeError(`Context object identity differs: ${directory.name}.`);
    contexts.push({ id: directory.name, type: descriptor.type });
  }
  return contexts.sort((a, b) => a.id.localeCompare(b.id, 'en'));
}

/** The overviews the object folders author (`properties.overview`): levels above the star systems, each an entry of the one
 * registry hosted by `sceneHostId`, in their order on the zoom ladder. */
export async function readOverviews(objectsDirectory: string, sceneHostId: string) {
  const overviews: OverviewObject[] = [];
  for (const directory of await readdir(objectsDirectory, { withFileTypes: true })) {
    if (!directory.isDirectory()) continue;
    let descriptor: unknown;
    try { descriptor = JSON.parse(await readFile(resolve(objectsDirectory, directory.name, 'object.json'), 'utf8')); }
    catch (error) { if (hasErrorCode(error, 'ENOENT')) continue; throw error; }
    const overview = overviewEntry(descriptor, sceneHostId);
    if (!overview) continue;
    if (overview.id !== directory.name) throw new TypeError(`Overview identity differs: ${directory.name}.`);
    overviews.push(overview);
  }
  overviews.sort((a, b) => a.order - b.order);
  for (const [index, overview] of overviews.entries()) {
    if (index > 0 && overview.order === overviews[index - 1]!.order) throw new TypeError(`Overviews ${overviews[index - 1]!.id} and ${overview.id} share order ${overview.order} on the zoom ladder.`);
    for (const id of overview.packages) {
      try { await readFile(resolve(objectsDirectory, id, 'object.json')); }
      catch (error) { if (hasErrorCode(error, 'ENOENT')) throw new TypeError(`Overview ${overview.id} draws package ${id}, which is not in ${objectsDirectory}.`); throw error; }
    }
    // One level holds each classification: a subject's breadcrumbs lead to exactly one.
    for (const other of overviews.slice(0, index)) for (const classification of overview.holds.flatMap(group => group.classifications)) {
      if (other.holds.some(group => group.classifications.includes(classification))) throw new TypeError(`Overviews ${other.id} and ${overview.id} both hold ${classification}.`);
    }
  }
  return overviews;
}

// Preparation's read of the application registry. `site/objects.mts` binds the prepared catalogue to the shell's scene
// loader; preparation needs the same object list without the shell, so it decodes the same records with the same
// contracts here and binds no scene loader. It is a read of the one registry, never a second list: the ids, order,
// fields, distances, discoveries and prepared focuses all come from what `prepare:catalog` wrote.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { isRecord } from '@cssearth/core';
import { catalogEntry, defineObjects, defineOverview, definePreparedFocus, isSceneObject, parseNavigationDistance, parseObjectDiscovery } from '../registry/index.js';
import type { CatalogEntry, NavigableObject, ObjectEntry } from '../registry/index.js';

/** The catalogue records `prepare:catalog` writes beside the registry that imports them, relative to the checkout.
 * `distances` lists every scene object in catalogue order; it is the order `site/prepared-object-catalog.mts` imports
 * their descriptors in. */
export const PREPARED_CATALOGUE = Object.freeze({
  discoveries: 'site/prepared-object-discovery.json',
  distances: 'site/prepared-object-distances.json',
  focuses: 'site/prepared-focus-objects.json',
  overviews: 'site/prepared-overview-objects.json',
});

/** A scene object as preparation sees it: every registry field, and a scene loader that refuses to mount. */
export type PreparedSceneObject = ObjectEntry<never, AbortSignal>;
export type PreparedNavigableObject = NavigableObject<never, AbortSignal>;
export interface PreparedObjectRegistry {
  /** Every navigable object, scene objects then prepared focuses, as `OBJECTS` lists them. */
  readonly objects: readonly PreparedNavigableObject[];
  /** The scene objects, as `SCENE_OBJECTS` lists them. */
  readonly sceneObjects: readonly PreparedSceneObject[];
  requireSceneObject(id: string): PreparedSceneObject;
}

const registries = new Map<string, PreparedObjectRegistry>();

/**
 * The registry of the checkout at `root`, read once per process. Descriptors and catalogue records are loaded as JSON
 * modules, as the application registry loads them: the preparation trace then records another body's descriptor as
 * loaded, not read, and the preparation cache keys a receipt on its registry fields only.
 */
export function readPreparedObjects(root: string): PreparedObjectRegistry {
  const checkout = resolve(root);
  let registry = registries.get(checkout);
  if (!registry) registries.set(checkout, registry = decodeRegistry(checkout));
  return registry;
}

function decodeRegistry(checkout: string): PreparedObjectRegistry {
  const load = createRequire(resolve(checkout, 'package.json'));
  const record = (path: string, name: string) => {
    const value: unknown = load(resolve(checkout, path));
    if (!isRecord(value)) throw new TypeError(`Invalid prepared catalogue ${name}: ${path}.`);
    return value;
  };
  const distances = record(PREPARED_CATALOGUE.distances, 'distances'), discoveries = record(PREPARED_CATALOGUE.discoveries, 'discoveries');
  const focuses: unknown = load(resolve(checkout, PREPARED_CATALOGUE.focuses));
  if (!Array.isArray(focuses)) throw new TypeError(`Invalid prepared catalogue focuses: ${PREPARED_CATALOGUE.focuses}.`);
  const overviews: unknown = load(resolve(checkout, PREPARED_CATALOGUE.overviews));
  if (!Array.isArray(overviews)) throw new TypeError(`Invalid prepared catalogue overviews: ${PREPARED_CATALOGUE.overviews}.`);
  const ids = Object.keys(distances);
  if (ids.length !== Object.keys(discoveries).length || ids.some(id => !Object.hasOwn(discoveries, id))) {
    throw new TypeError('Prepared catalogue distances and discoveries list different objects.');
  }
  const refuse = async (): Promise<never> => { throw new Error('Preparation cannot mount a scene.'); };
  const objects = defineObjects<PreparedNavigableObject>([...ids.map(id => {
    const descriptor: unknown = load(resolve(checkout, 'src/objects', id, 'object.json'));
    const entry: CatalogEntry<never, AbortSignal> = catalogEntry(descriptor, refuse,
      parseNavigationDistance(distances[id]), parseObjectDiscovery(discoveries[id]));
    if (entry.id !== id) throw new TypeError(`Catalogue identity differs: ${id}.`);
    const { order, context, ...object } = entry;
    return object;
  }), ...focuses.map(definePreparedFocus), ...overviews.map(defineOverview)]);
  const sceneObjects = Object.freeze(objects.filter(isSceneObject));
  for (const object of objects) if (object.kind !== 'scene' && !sceneObjects.some(host => host.id === object.sceneHostId)) {
    throw new TypeError(`${object.kind === 'overview' ? 'Overview' : 'Prepared focus'} host is not a registered scene: ${object.id}`);
  }
  return Object.freeze({ objects, sceneObjects, requireSceneObject(id: string) {
    const object = objects.find(candidate => candidate.id === id);
    if (!object) throw new Error(`Unknown cssEarth object: ${id}`);
    if (!isSceneObject(object)) throw new TypeError(`Object ${id} is a ${object.kind === 'overview' ? 'overview' : 'prepared focus'}, not a scene owner.`);
    return object;
  } });
}

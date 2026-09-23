import { defineObjects } from './object-schema.mts';
import { catalogEntry } from './object-catalog.mts';
import { OBJECT_DESCRIPTORS } from './prepared-object-catalog.mts';
import discoveries from './prepared-object-discovery.json' with { type: 'json' };
import { parseObjectDiscovery } from './object-discovery.mts';
import distances from './prepared-object-distances.json' with { type: 'json' };
import focuses from './prepared-focus-objects.json' with { type: 'json' };
import { parseNavigationDistance } from './navigation/navigation-distance.mts';
import { definePreparedFocus, isSceneObject } from './prepared-focus-object.mts';
import type { NavigableObject } from './prepared-focus-object.mts';
import { record } from './browser-types.mts';

/** The single application registry, assembled from explicitly registered packages. */
export const OBJECTS = defineObjects<NavigableObject>([...OBJECT_DESCRIPTORS.map(descriptor => {
  const { order, context, ...object } = catalogEntry(descriptor, async signal => {
    const { loadPackagedObject } = await import('./packaged-object-runtime.mts');
    return loadPackagedObject(descriptor, signal);
  }, preparedDistance(descriptor), preparedDiscovery(descriptor));
  return object;
}), ...focuses.map(definePreparedFocus)]);

function preparedDiscovery(descriptor: unknown) {
  if (!record(descriptor) || typeof descriptor.id !== 'string') throw new TypeError('Invalid catalogue descriptor.');
  return parseObjectDiscovery(Object.getOwnPropertyDescriptor(discoveries, descriptor.id)?.value);
}

function preparedDistance(descriptor: unknown) {
  if (!record(descriptor) || typeof descriptor.id !== 'string') throw new TypeError('Invalid catalogue descriptor.');
  return parseNavigationDistance(Object.getOwnPropertyDescriptor(distances, descriptor.id)?.value);
}

/** A capability projection of OBJECTS, never an independently maintained registry. */
export const SCENE_OBJECTS = Object.freeze(OBJECTS.filter(isSceneObject));
for (const object of OBJECTS) if (object.kind === 'prepared-focus' && !SCENE_OBJECTS.some(host => host.id === object.sceneHostId)) {
  throw new TypeError(`Prepared focus host is not a registered scene: ${object.id}`);
}

export function requireObject(id: string) {
  const object = OBJECTS.find(candidate => candidate.id === id);
  if (!object) throw new Error(`Unknown cssEarth object: ${id}`);
  return object;
}

export function requireSceneObject(id: string) {
  const object = requireObject(id);
  if (!isSceneObject(object)) throw new TypeError(`Object ${id} is a prepared focus, not a scene owner.`);
  return object;
}

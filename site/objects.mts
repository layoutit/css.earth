import { defineObjects } from './object-schema.mts';
import { catalogEntry } from './object-catalog.mts';
import { OBJECT_DESCRIPTORS } from './prepared-object-catalog.mts';

/** The single application registry, assembled from explicitly registered packages. */
export const OBJECTS = defineObjects(OBJECT_DESCRIPTORS.map(descriptor => {
  const { order, context, ...object } = catalogEntry(descriptor, async () => {
    const { loadPackagedObject } = await import('./packaged-object-runtime.mts');
    return loadPackagedObject(descriptor);
  });
  return object;
}));

export function requireObject(id: string) {
  const object = OBJECTS.find(candidate => candidate.id === id);
  if (!object) throw new Error(`Unknown cssEarth object: ${id}`);
  return object;
}

import { defineObjects } from './object-schema.mjs';
import { OBJECT_DESCRIPTORS } from './prepared-object-catalog.mjs';

/** The single application registry, assembled from explicitly registered packages. */
export const OBJECTS = defineObjects(OBJECT_DESCRIPTORS.map(descriptor => {
  const { order, context, ...catalog } = descriptor.properties.catalog;
  return { ...catalog, id: descriptor.id, route: `/${descriptor.id}/`,
    worldFrame: descriptor.properties.worldFrame ?? null,
    loadScene: async () => {
      const { loadPackagedObject } = await import('./packaged-object-runtime.mjs');
      return loadPackagedObject(descriptor);
    },
  };
}));

export function requireObject(id) {
  const object = OBJECTS.find(candidate => candidate.id === id);
  if (!object) throw new Error(`Unknown cssEarth object: ${id}`);
  return object;
}

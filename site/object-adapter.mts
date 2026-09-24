import { parseObjectDescriptor, type ObjectDescriptor } from '@cssearth/objects';
import type { ObjectEntry } from './object-schema.mts';

export const objectAdapter = Object.freeze({
  /** A page's own prepared descriptor mounts without the registry, so the first body loads before it. */
  async load(objectId: string, descriptor?: ObjectDescriptor, objects?: readonly ObjectEntry[], signal?: AbortSignal) {
    let mount;
    if (descriptor) {
      const preparedDescriptor = parseObjectDescriptor(descriptor);
      if (preparedDescriptor.id !== objectId) throw new TypeError(`Prepared descriptor does not match object ${objectId}.`);
      const { loadPackagedObject } = await import('./packaged-object-runtime.mts');
      mount = await loadPackagedObject(preparedDescriptor, signal);
    } else {
      const objectRecord = (objects ?? (await import('./objects.mts')).SCENE_OBJECTS).find(({ id }) => id === objectId);
      if (!objectRecord) throw new Error(`Unknown cssEarth object: ${objectId ?? "unknown"}.`);
      mount = await objectRecord.loadScene(signal);
    }
    if (typeof mount !== "function") {
      throw new TypeError(
        `Object ${objectId} scene loader must return a mount function.`,
      );
    }
    return mount;
  },

  routes(objects: readonly Pick<ObjectEntry, 'route'>[]) {
    return objects.map(({ route }) => route);
  },
});

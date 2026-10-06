import { importPackagedObjectRuntime } from './scene-imports.mts';
import { parseObjectDescriptor, type ObjectDescriptor } from '@cssearth/objects';
import type { ObjectEntry } from '../directory/objects.mts';
// The router that holds this adapter imports the directory statically, so a dynamic import here only added a facade chunk.
import { loadObject } from '../directory/object-directory.mts';

export const objectAdapter = Object.freeze({
  /** A page's own prepared descriptor mounts without the registry, so the first body loads before it. */
  async load(objectId: string, descriptor?: ObjectDescriptor, objects?: readonly ObjectEntry[], signal?: AbortSignal) {
    let mount;
    if (descriptor) {
      const preparedDescriptor = parseObjectDescriptor(descriptor);
      if (preparedDescriptor.id !== objectId) throw new TypeError(`Prepared descriptor does not match object ${objectId}.`);
      const { loadPackagedObject } = await importPackagedObjectRuntime();
      mount = await loadPackagedObject(preparedDescriptor, signal);
    } else {
      const loaded = objects ? objects.find(({ id }) => id === objectId) : await loadObject(objectId);
      const objectRecord = loaded ?? null;
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

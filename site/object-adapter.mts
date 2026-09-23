import { SCENE_OBJECTS } from "./objects.mts";
import { parseObjectDescriptor, type ObjectDescriptor } from '@cssearth/objects';

export const objectAdapter = Object.freeze({
  async load(objectId: string, descriptor?: ObjectDescriptor, objects = SCENE_OBJECTS, signal?: AbortSignal) {
    const objectRecord = objects.find(({ id }) => id === objectId);
    if (!objectRecord) {
      throw new Error(`Unknown cssEarth object: ${objectId ?? "unknown"}.`);
    }
    let mount;
    if (descriptor) {
      const preparedDescriptor = parseObjectDescriptor(descriptor);
      if (preparedDescriptor.id !== objectId) throw new TypeError(`Prepared descriptor does not match object ${objectId}.`);
      const { loadPackagedObject } = await import('./packaged-object-runtime.mts');
      mount = await loadPackagedObject(preparedDescriptor, signal);
    } else mount = await objectRecord.loadScene(signal);
    if (typeof mount !== "function") {
      throw new TypeError(
        `Object ${objectId} scene loader must return a mount function.`,
      );
    }
    return mount;
  },

  routes(objects = SCENE_OBJECTS) {
    return objects.map(({ route }) => route);
  },
});

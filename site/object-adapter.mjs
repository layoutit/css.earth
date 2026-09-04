import { OBJECTS } from "./objects.mjs";

export const objectAdapter = Object.freeze({
  async load(objectId, objects = OBJECTS) {
    const objectRecord = objects.find(({ id }) => id === objectId);
    if (!objectRecord) {
      throw new Error(`Unknown cssEarth object: ${objectId ?? "unknown"}.`);
    }
    const mount = await objectRecord.loadScene();
    if (typeof mount !== "function") {
      throw new TypeError(
        `Object ${objectId} scene loader must return a mount function.`,
      );
    }
    return mount;
  },

  routes(objects = OBJECTS) {
    return objects.map(({ route }) => route);
  },
});

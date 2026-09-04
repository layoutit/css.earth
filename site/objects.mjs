import { defineObject, defineObjects } from "./object-schema.mjs";

export const OBJECTS = defineObjects([
  object("sun", "Sun", "#f5a623", 0,
    "pinned NASA Science and Solar Dynamics Observatory", async () => {
      const { mountSunClient } = await import(
        "../src/planets/sun/runtime/client.mjs"
      );
      return mountSunClient;
    }),
  object("mercury", "Mercury", "#9d9388", 0.39,
    "NASA, USGS, OpenSpace, and HYG", async () => {
      const { mountMercuryClient } = await import(
        "../src/planets/mercury/runtime/client.mjs"
      );
      return mountMercuryClient;
    }),
  object("venus", "Venus", "#d6aa69", 0.72,
    "NASA, USGS, OpenSpace, and HYG", async () => {
      const { mountVenusClient } = await import(
        "../src/planets/venus/runtime/client.mjs"
      );
      return mountVenusClient;
    }),
  object("earth", "Earth", "#5b82a7", 1,
    "NASA, JPL, OpenSpace, and HYG", async () => {
      const { mountEarthClient } = await import(
        "../src/planets/earth/runtime/client.mjs"
      );
      return mountEarthClient;
    }),
  object("moon", "Moon", "#aaa7a0", 1,
    "NASA, JPL, OpenSpace, and HYG", async () => {
      const { mountMoonClient } = await import(
        "../src/planets/moon/runtime/client.mjs"
      );
      return mountMoonClient;
    }),
  object("mars", "Mars", "#a95e47", 1.52,
    "OpenSpace, NASA, USGS, and JPL", async () => {
      const { mountMarsClient } = await import(
        "../src/planets/mars/runtime/client.mjs"
      );
      return mountMarsClient;
    }),
  object("jupiter", "Jupiter", "#b48b67", 5.2,
    "NASA, ESA, STScI, JPL, and OpenSpace", async () => {
      const { mountJupiterClient } = await import(
        "../src/planets/jupiter/runtime/client.mjs"
      );
      return mountJupiterClient;
    }),
  object("saturn", "Saturn", "#d2b68c", 9.58,
    "OpenSpace and NASA", async () => {
      const { mountSaturnClient } = await import(
        "../src/planets/saturn/runtime/client.mjs"
      );
      return mountSaturnClient;
    }),
  object("uranus", "Uranus", "#8ec7c9", 19.2,
    "Hubble OPAL, NASA, JPL, PDS, and Voyager", async () => {
      const { mountUranusClient } = await import(
        "../src/planets/uranus/runtime/client.mjs"
      );
      return mountUranusClient;
    }),
  object("neptune", "Neptune", "#5279bd", 30.05,
    "NASA, ESA, STScI, JPL, PDS, and OpenSpace", async () => {
      const { mountNeptuneClient } = await import(
        "../src/planets/neptune/runtime/client.mjs"
      );
      return mountNeptuneClient;
    }),
]);

export function requireObject(id) {
  const objectRecord = OBJECTS.find((candidate) => candidate.id === id);
  if (!objectRecord) throw new Error(`Unknown cssEarth object: ${id}`);
  return objectRecord;
}

function object(id, name, color, distanceAu, authority, loadScene) {
  return defineObject({
    id,
    name,
    color,
    distanceAu,
    route: `/${id}/`,
    loadScene,
    description:
      `An interactive retained-DOM ${name} visualization prepared from ${authority} source material.`,
  });
}

import mercuryDescriptor from "../src/planets/mercury/object.json" with { type: "json" };
import venusDescriptor from "../src/planets/venus/object.json" with { type: "json" };
import { defineObject, defineObjects } from "./object-schema.mjs";

export const OBJECTS = defineObjects([
  object("sun", "Sun", "star", "#f5a623", 0,
    "Explore the Sun in 3D with cssEarth. Discover our nearest star, its glowing atmosphere, and the science behind the center of the solar system.", async () => {
      const { mountSunClient } = await import(
        "../src/planets/sun/runtime/client.mjs"
      );
      return mountSunClient;
    }),
  object("mercury", "Mercury", "planet", "#9d9388", 0.39,
    "Explore Mercury in 3D with cssEarth. Inspect the smallest planet, its cratered surface, and the extreme conditions closest to the Sun.", async () => {
      const { loadPackagedObject } = await import("./packaged-object-runtime.mjs");
      return loadPackagedObject(mercuryDescriptor);
    }, mercuryDescriptor.properties.worldFrame),
  object("venus", "Venus", "planet", "#d6aa69", 0.72,
    "Explore Venus in 3D with cssEarth. Look beneath its clouds, discover its volcanic surface, and learn about the hottest planet in our solar system.", async () => {
      const { loadPackagedObject } = await import("./packaged-object-runtime.mjs");
      return loadPackagedObject(venusDescriptor);
    }, venusDescriptor.properties.worldFrame),
  object("earth", "Earth", "planet", "#5b82a7", 1,
    "Explore Earth in 3D with cssEarth. Orbit our home planet, discover its surface and atmosphere, and browse scientific facts in your browser.", async () => {
      const { mountEarthClient } = await import(
        "../src/planets/earth/runtime/client.mjs"
      );
      return mountEarthClient;
    }),
  object("moon", "Moon", "satellite", "#aaa7a0", 1,
    "Explore the Moon in 3D with cssEarth. Discover impact craters, ancient lava plains, and the history of Earth’s natural satellite.", async () => {
      const { mountMoonClient } = await import(
        "../src/planets/moon/runtime/client.mjs"
      );
      return mountMoonClient;
    }),
  object("mars", "Mars", "planet", "#a95e47", 1.52,
    "Explore Mars in 3D with cssEarth. Discover the red planet’s volcanoes, deep canyons, polar ice, and thin atmosphere in an interactive explorer.", async () => {
      const { mountMarsClient } = await import(
        "../src/planets/mars/runtime/client.mjs"
      );
      return mountMarsClient;
    }),
  object("ceres", "Ceres", "dwarf-planet", "#8e8b86", 2.77,
    "NASA Dawn, USGS, JPL, ESO, and HYG", async () => {
      const { mountCeresClient } = await import("../src/planets/ceres/runtime/client.mjs");
      return mountCeresClient;
    }),
  object("jupiter", "Jupiter", "planet", "#b48b67", 5.2,
    "Explore Jupiter in 3D with cssEarth. Discover the solar system’s largest planet, its colorful cloud bands, giant storms, and orbiting moons.", async () => {
      const { mountJupiterClient } = await import(
        "../src/planets/jupiter/runtime/client.mjs"
      );
      return mountJupiterClient;
    }),
  object("europa", "Europa", "satellite", "#b5b3a9", 5.2,
    "Explore Europa in 3D with cssEarth. Inspect Voyager and Galileo imagery of Jupiter’s fractured icy moon and its orbit around Jupiter.", async () => {
      const { mountEuropaClient } = await import("../src/planets/europa/runtime/client.mjs");
      return mountEuropaClient;
    }),
  object("saturn", "Saturn", "planet", "#d2b68c", 9.58,
    "Explore Saturn in 3D with cssEarth. Orbit its spectacular rings, discover its moons, and browse scientific facts about this gas giant.", async () => {
      const { mountSaturnClient } = await import(
        "../src/planets/saturn/runtime/client.mjs"
      );
      return mountSaturnClient;
    }),
  object("uranus", "Uranus", "planet", "#8ec7c9", 19.2,
    "Explore Uranus in 3D with cssEarth. Discover the ice giant that spins on its side, its faint rings, and its system of moons.", async () => {
      const { mountUranusClient } = await import(
        "../src/planets/uranus/runtime/client.mjs"
      );
      return mountUranusClient;
    }),
  object("neptune", "Neptune", "planet", "#5279bd", 30.05,
    "Explore Neptune in 3D with cssEarth. Discover the distant blue ice giant, its turbulent atmosphere, faint rings, and orbiting moons.", async () => {
      const { mountNeptuneClient } = await import(
        "../src/planets/neptune/runtime/client.mjs"
      );
      return mountNeptuneClient;
    }),
  object("pluto", "Pluto", "dwarf-planet", "#bca18a", 39,
    "Explore Pluto in 3D with cssEarth. Discover this distant dwarf planet’s icy landscape, its heart-shaped region, and its companion Charon.", async () => {
      const { mountPlutoClient } = await import(
        "../src/planets/pluto/runtime/client.mjs"
      );
      return mountPlutoClient;
    }),
]);

export function requireObject(id) {
  const objectRecord = OBJECTS.find((candidate) => candidate.id === id);
  if (!objectRecord) throw new Error(`Unknown cssEarth object: ${id}`);
  return objectRecord;
}

function object(id, name, classification, color, distanceAu, description, loadScene, worldFrame = null) {
  return defineObject({
    id,
    name,
    classification,
    color,
    distanceAu,
    route: `/${id}/`,
    loadScene,
    worldFrame,
    description,
  });
}

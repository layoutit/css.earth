import marsDescriptor from "../src/planets/mars/object.json" with { type: "json" };
import neptuneDescriptor from "../src/planets/neptune/object.json" with { type: "json" };
import uranusDescriptor from "../src/planets/uranus/object.json" with { type: "json" };
import saturnDescriptor from "../src/planets/saturn/object.json" with { type: "json" };
import jupiterDescriptor from "../src/planets/jupiter/object.json" with { type: "json" };
import europaDescriptor from "../src/planets/europa/object.json" with { type: "json" };
import ioDescriptor from "../src/planets/io/object.json" with { type: "json" };
import ganymedeDescriptor from "../src/planets/ganymede/object.json" with { type: "json" };
import callistoDescriptor from "../src/planets/callisto/object.json" with { type: "json" };
import ceresDescriptor from "../src/planets/ceres/object.json" with { type: "json" };
import plutoDescriptor from "../src/planets/pluto/object.json" with { type: "json" };
import moonDescriptor from "../src/planets/moon/object.json" with { type: "json" };
import earthDescriptor from "../src/planets/earth/object.json" with { type: "json" };
import sunDescriptor from "../src/planets/sun/object.json" with { type: "json" };
import mercuryDescriptor from "../src/planets/mercury/object.json" with { type: "json" };
import venusDescriptor from "../src/planets/venus/object.json" with { type: "json" };
import { defineObject, defineObjects } from "./object-schema.mjs";

export const OBJECTS = defineObjects([
  object("sun", "Sun", "star", "#f5a623", 0,
    "Explore the Sun in 3D with cssEarth. Discover our nearest star, its glowing atmosphere, and the science behind the center of the solar system.", async () => {
      const { loadPackagedObject } = await import("./packaged-object-runtime.mjs");
      return loadPackagedObject(sunDescriptor);
    }, sunDescriptor.properties.worldFrame),
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
      const { loadPackagedObject } = await import("./packaged-object-runtime.mjs");
      return loadPackagedObject(earthDescriptor);
    }, earthDescriptor.properties.worldFrame),
  object("moon", "Moon", "satellite", "#aaa7a0", 1,
    "Explore the Moon in 3D with cssEarth. Discover impact craters, ancient lava plains, and the history of Earth’s natural satellite.", async () => {
      const { loadPackagedObject } = await import("./packaged-object-runtime.mjs");
      return loadPackagedObject(moonDescriptor);
    }, moonDescriptor.properties.worldFrame),
  object("mars", "Mars", "planet", "#a95e47", 1.52,
    "Explore Mars in 3D with cssEarth. Discover the red planet’s volcanoes, deep canyons, polar ice, and thin atmosphere in an interactive explorer.", async () => {
      const { loadPackagedObject } = await import("./packaged-object-runtime.mjs");
      return loadPackagedObject(marsDescriptor);
    }, marsDescriptor.properties.worldFrame),
  object("ceres", "Ceres", "dwarf-planet", "#8e8b86", 2.77,
    "NASA Dawn, USGS, JPL, ESO, and HYG", async () => {
      const { loadPackagedObject } = await import("./packaged-object-runtime.mjs");
      return loadPackagedObject(ceresDescriptor);
    }, ceresDescriptor.properties.worldFrame),
  object("jupiter", "Jupiter", "planet", "#b48b67", 5.2,
    "Explore Jupiter in 3D with cssEarth. Discover the solar system’s largest planet, its colorful cloud bands, giant storms, and orbiting moons.", async () => {
      const { loadPackagedObject } = await import("./packaged-object-runtime.mjs");
      return loadPackagedObject(jupiterDescriptor);
    }, jupiterDescriptor.properties.worldFrame),
  object("io", "Io", "satellite", "#c6ac65", 5.2,
    "Explore Io in 3D with cssEarth. Inspect Voyager and Galileo imagery of Jupiter’s volcanic moon and its orbit around Jupiter.", async () => {
      const { loadPackagedObject } = await import("./packaged-object-runtime.mjs");
      return loadPackagedObject(ioDescriptor);
    }, ioDescriptor.properties.worldFrame),
  object("europa", "Europa", "satellite", "#b5b3a9", 5.2,
    "Explore Europa in 3D with cssEarth. Inspect Voyager and Galileo imagery of Jupiter’s fractured icy moon and its orbit around Jupiter.", async () => {
      const { loadPackagedObject } = await import("./packaged-object-runtime.mjs");
      return loadPackagedObject(europaDescriptor);
    }, europaDescriptor.properties.worldFrame),
  object("ganymede", "Ganymede", "satellite", "#a49a83", 5.2,
    "Explore Ganymede in 3D with cssEarth. Inspect Voyager and Galileo imagery of Jupiter’s largest moon and its grooved icy surface.", async () => {
      const { loadPackagedObject } = await import("./packaged-object-runtime.mjs");
      return loadPackagedObject(ganymedeDescriptor);
    }, ganymedeDescriptor.properties.worldFrame),
  object("callisto", "Callisto", "satellite", "#8b8177", 5.2,
    "Explore Callisto in 3D with cssEarth. Inspect Voyager and Galileo imagery of Jupiter’s heavily cratered moon and its ancient surface.", async () => {
      const { loadPackagedObject } = await import("./packaged-object-runtime.mjs");
      return loadPackagedObject(callistoDescriptor);
    }, callistoDescriptor.properties.worldFrame),
  object("saturn", "Saturn", "planet", "#d2b68c", 9.58,
    "Explore Saturn in 3D with cssEarth. Orbit its spectacular rings, discover its moons, and browse scientific facts about this gas giant.", async () => {
      const { loadPackagedObject } = await import("./packaged-object-runtime.mjs");
      return loadPackagedObject(saturnDescriptor);
    }, saturnDescriptor.properties.worldFrame),
  object("uranus", "Uranus", "planet", "#8ec7c9", 19.2,
    "Explore Uranus in 3D with cssEarth. Discover the ice giant that spins on its side, its faint rings, and its system of moons.", async () => {
      const { loadPackagedObject } = await import("./packaged-object-runtime.mjs");
      return loadPackagedObject(uranusDescriptor);
    }, uranusDescriptor.properties.worldFrame),
  object("neptune", "Neptune", "planet", "#5279bd", 30.05,
    "Explore Neptune in 3D with cssEarth. Discover the distant blue ice giant, its turbulent atmosphere, faint rings, and orbiting moons.", async () => {
      const { loadPackagedObject } = await import("./packaged-object-runtime.mjs");
      return loadPackagedObject(neptuneDescriptor);
    }, neptuneDescriptor.properties.worldFrame),
  object("pluto", "Pluto", "dwarf-planet", "#bca18a", 39,
    "Explore Pluto in 3D with cssEarth. Discover this distant dwarf planet’s icy landscape, its heart-shaped region, and its companion Charon.", async () => {
      const { loadPackagedObject } = await import("./packaged-object-runtime.mjs");
      return loadPackagedObject(plutoDescriptor);
    }, plutoDescriptor.properties.worldFrame),
]);

export function requireObject(id) {
  const objectRecord = OBJECTS.find((candidate) => candidate.id === id);
  if (!objectRecord) throw new Error(`Unknown cssEarth object: ${id}`);
  return objectRecord;
}

function object(id, name, classification, color, distanceAu, description, loadScene, worldFrame = null, systemName = "Solar System") {
  return defineObject({
    id,
    name,
    systemName,
    classification,
    color,
    distanceAu,
    route: `/${id}/`,
    loadScene,
    worldFrame,
    description,
  });
}

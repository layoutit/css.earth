import { OBJECTS } from "./objects.mjs";

const PRIMARY_PLANET_IDS = new Set([
  "mercury",
  "venus",
  "earth",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
]);

export const PLANET_SEARCH_OBJECTS = Object.freeze(
  OBJECTS
    .filter(({ distanceAu }) => distanceAu > 0)
    .toSorted((left, right) => left.distanceAu - right.distanceAu),
);

export const PLANET_NAVIGATION_OBJECTS = Object.freeze(
  PLANET_SEARCH_OBJECTS.filter(({ id }) => PRIMARY_PLANET_IDS.has(id)),
);

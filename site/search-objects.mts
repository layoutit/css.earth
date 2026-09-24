import { OBJECTS } from "./objects.mts";

// Pages label classifications without loading the registry.
export { objectClassificationLabel, objectTypeLabel } from "./object-classification-label.mts";

// Classification describes an object; it never disables an interaction gate.
export function objectNavigation<T extends { distance: { meters: number }; classification: string }>(objects: readonly T[]) {
  const search = Object.freeze([...objects].sort((left, right) =>
    left.distance.meters - right.distance.meters));
  return Object.freeze({
    search,
    planets: Object.freeze(search.filter(({ classification }) =>
      classification === "planet")),
  });
}

const navigation = objectNavigation(OBJECTS);
export const SEARCH_OBJECTS = navigation.search;
export const PLANET_NAVIGATION_OBJECTS = navigation.planets;

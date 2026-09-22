import { OBJECTS } from "./objects.mts";

export function objectClassificationLabel(classification: string) {
  const label = classification === "satellite" ? "moon" : classification.replaceAll("-", " ");
  return label[0].toUpperCase() + label.slice(1);
}

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
export const NAVIGATION_OBJECTS = navigation.planets;

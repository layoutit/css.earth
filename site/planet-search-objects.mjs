import { OBJECTS } from "./objects.mjs";

export function objectClassificationLabel(classification) {
  const label = classification === "satellite" ? "moon" : classification.replaceAll("-", " ");
  return label[0].toUpperCase() + label.slice(1);
}

// Classification describes an object; it never disables an interaction gate.
export function objectNavigation(objects) {
  const search = Object.freeze(objects.toSorted((left, right) =>
    left.distanceAu - right.distanceAu));
  return Object.freeze({
    search,
    planets: Object.freeze(search.filter(({ classification }) =>
      classification === "planet")),
  });
}

const navigation = objectNavigation(OBJECTS);
export const PLANET_SEARCH_OBJECTS = navigation.search;
export const PLANET_NAVIGATION_OBJECTS = navigation.planets;

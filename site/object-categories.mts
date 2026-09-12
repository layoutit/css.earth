export const OBJECT_CATEGORIES: readonly (readonly [string, string])[] = [
  ['all', 'All'], ['planet', 'Planets'],
  ['satellite', 'Moons'], ['comet', 'Comets'], ['asteroid', 'Other'],
];
const OWN_TABS = new Set(['planet', 'satellite', 'comet']);

/** The tab a classification is listed under: dwarf planets with Planets; every class
 * without its own tab (asteroids, trans-Neptunian and interstellar objects) in Other. */
export function objectCategory(classification: string): string;
export function objectCategory(classification: string | undefined): string | undefined;
export function objectCategory(classification: string | undefined): string | undefined {
  if (classification === undefined) return undefined;
  return classification === 'dwarf-planet' ? 'planet' : classification === 'star' ? 'all'
    : OWN_TABS.has(classification) ? classification : 'asteroid';
}
export const matchesObjectCategory = (classification: string | undefined, category: string | undefined) => category === 'all' || objectCategory(classification) === category;
export function objectCategoryCount(classifications: readonly (string | undefined)[], category: string | undefined) {
  return String(category === 'all' ? classifications.length
    : classifications.filter(classification => objectCategory(classification) === category).length);
}

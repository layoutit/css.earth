export const OBJECT_CATEGORIES: readonly (readonly [string, string])[] = [
  ['all', 'All'], ['planet', 'Planets'],
  ['satellite', 'Moons'], ['nebula', 'Nebulae'], ['galaxy', 'Galaxies'], ['galaxy-cluster', 'Galaxy clusters'], ['asteroid', 'Other'],
];
const OWN_TABS = new Set(['planet', 'satellite', 'nebula', 'galaxy', 'galaxy-cluster']);

/** The tab a classification is listed under: dwarf planets and planets of other stars with Planets; every class
 * without its own tab (comets, asteroids, trans-Neptunian and interstellar objects) in Other. */
export function objectCategory(classification: string): string;
export function objectCategory(classification: string | undefined): string | undefined;
export function objectCategory(classification: string | undefined): string | undefined {
  if (classification === undefined) return undefined;
  return classification === 'dwarf-planet' || classification === 'exoplanet' ? 'planet' : classification === 'star' || classification === 'black-hole' ? 'all'
    : OWN_TABS.has(classification) ? classification : 'asteroid';
}
export const matchesObjectCategory = (classification: string | undefined, category: string | undefined) => category === 'all' || objectCategory(classification) === category;

/** Type searches and scene emphasis share membership; the Other tab is broader. */
export const matchesObjectClassification = (classification: string, requested: string | null | undefined) =>
  classification === requested || requested === 'planet' && classification === 'dwarf-planet';
export function objectCategoryCount(classifications: readonly (string | undefined)[], category: string | undefined) {
  return String(category === 'all' ? classifications.length
    : classifications.filter(classification => objectCategory(classification) === category).length);
}

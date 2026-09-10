export const OBJECT_CATEGORIES: readonly (readonly [string, string])[] = [
  ['all', 'All'], ['planet', 'Planets'],
  ['satellite', 'Moons'], ['comet', 'Comets'], ['asteroid', 'Other'], ['trans-neptunian', 'Trans-Neptunian'],
];

export function objectCategory(classification: string): string;
export function objectCategory(classification: string | undefined): string | undefined;
export function objectCategory(classification: string | undefined): string | undefined { return classification === 'dwarf-planet' ? 'planet' : classification === 'star' ? 'all' : classification; }
export const matchesObjectCategory = (classification: string | undefined, category: string | undefined) => category === 'all' || objectCategory(classification) === category;
export function objectCategoryCount(classifications: readonly (string | undefined)[], category: string | undefined) {
  const count = (type: string | undefined) => classifications.filter(value => value === type).length;
  return category === 'all' ? String(classifications.length)
    : category === 'planet' ? String(count('planet') + count('dwarf-planet')) : String(count(category));
}

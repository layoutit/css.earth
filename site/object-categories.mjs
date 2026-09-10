export const OBJECT_CATEGORIES = [
  ['all', 'All'], ['planet', 'Planets'],
  ['satellite', 'Moons'], ['comet', 'Comets'], ['asteroid', 'Other'], ['trans-neptunian', 'Trans-Neptunian'], ['interstellar', 'Interstellar'],
];

export const objectCategory = classification => classification === 'dwarf-planet' ? 'planet' : classification === 'star' ? 'all' : classification;
export const matchesObjectCategory = (classification, category) => category === 'all' || objectCategory(classification) === category;
export function objectCategoryCount(classifications, category) {
  const count = type => classifications.filter(value => value === type).length;
  return category === 'all' ? String(classifications.length)
    : category === 'planet' ? String(count('planet') + count('dwarf-planet')) : String(count(category));
}

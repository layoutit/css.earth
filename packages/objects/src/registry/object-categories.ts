const LEGACY_CATEGORIES = new Set(['planet', 'satellite', 'nebula', 'galaxy', 'galaxy-cluster']);

/** Grouping retained for native category URLs created before search replaced the tabs. */
function objectCategory(classification: string): string;
function objectCategory(classification: string | undefined): string | undefined;
function objectCategory(classification: string | undefined): string | undefined {
  if (classification === undefined) return undefined;
  return classification === 'dwarf-planet' || classification === 'exoplanet' ? 'planet' : classification === 'star' || classification === 'black-hole' ? 'all'
    : LEGACY_CATEGORIES.has(classification) ? classification : 'asteroid';
}
export const matchesObjectCategory = (classification: string | undefined, category: string | undefined) => category === 'all' || objectCategory(classification) === category;

/** Type searches and scene emphasis share membership. */
export const matchesObjectClassification = (classification: string, requested: string | null | undefined) =>
  classification === requested || requested === 'planet' && classification === 'dwarf-planet';

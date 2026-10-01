import { matchesObjectClassification, normalizeDestinationQuery } from '@cssearth/objects';

export const SEARCH_QUERY_LIMIT = 200;
export interface ObjectSearchLabels {
  name: string;
  names: readonly string[];
  classification: string;
  classificationName: string;
  systemName: string;
  illustration?: boolean;
}

/** A body also answers to the catalogue designation its id spells: "hd 75732" and "75732" find 55 Cnc. */
export function designationNames(id: string, name: string): string[] {
  const designation = id.replaceAll('-', ' ');
  return designation === name.toLocaleLowerCase('en') ? [] : [designation];
}

const join = (text: string) => text.toLocaleLowerCase('en').replace(/[\s\-\u2010-\u2015]+/gu, '');

/** One matching policy for the native form response and its live enhancement. */
export function searchObjects<T extends ObjectSearchLabels>(items: readonly T[], value: string,
  { illustrations = false } = {}) {
  const query = value.slice(0, SEARCH_QUERY_LIMIT).trim().toLocaleLowerCase('en');
  const normalized = normalizeDestinationQuery(query);
  const showAll = query === 'all objects';
  const classification = items.find(item => query === item.classificationName || query === `${item.classificationName}s`
    || item.classificationName === 'nebula' && query === 'nebulae'
    || item.classificationName === 'galaxy' && query === 'galaxies' || query === item.classification)?.classification;
  const systemName = items.find(item => query === item.systemName)?.systemName;
  // Spaces and hyphens are how a reader happens to type a designation: "hd 189733 b", "wasp 121 b" and "trappist1"
  // found nothing while the names are "HD 189733b", "WASP-121b" and "TRAPPIST-1" (2026-10-01). Under four joined characters a
  // match across a word boundary is a syllable, not a name.
  const joined = join(query), joinedMatch = (item: T, test: (name: string) => boolean) => joined.length >= 4 &&
    (test(join(item.name)) || item.names.some(name => test(join(name))));
  const matches = items.filter(item => classification
    ? matchesObjectClassification(item.classification, classification) && (!item.illustration || illustrations)
    // A system's name lists its members, and the body that has that very name: "m87" is the black hole's system and
    // the galaxy's name, and listed only the black hole (2026-10-01).
    : showAll || (systemName ? item.systemName === systemName || item.name === query || item.names.includes(normalized)
      : item.name.includes(query) || normalized.length > 0 && item.names.some(name => name.includes(normalized))
        || joinedMatch(item, name => name.includes(joined))));
  // A typed name lists exact names first, then names that begin with it, then the rest, each in catalogue order:
  // "europa" finds the moon before the asteroid 52 Europa, which lies nearer the Sun.
  const rank = (item: T) => item.name === query || item.names.includes(normalized) || joinedMatch(item, name => name === joined) ? 0
    : item.name.startsWith(query) || normalized.length > 0 && item.names.some(name => name.startsWith(normalized))
      || joinedMatch(item, name => name.startsWith(joined)) ? 1 : 2;
  const ranked = classification || systemName || showAll ? matches
    : matches.map((item, index) => ({ item, index, rank: rank(item) })).sort((a, b) => a.rank - b.rank || a.index - b.index).map(entry => entry.item);
  return { query, matches: ranked, classification, systemName, showAll,
    detailQuery: classification || systemName || showAll ? '' : query };
}

import { normalizeDestinationQuery } from './destination-search.mts';
import { matchesObjectClassification } from './object-categories.mts';

export const SEARCH_QUERY_LIMIT = 200;
export interface ObjectSearchLabels {
  name: string;
  names: readonly string[];
  classification: string;
  classificationName: string;
  systemName: string;
  illustration?: boolean;
  candidate?: boolean;
}

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
  const matches = items.filter(item => classification
    ? matchesObjectClassification(item.classification, classification) && (!item.illustration || illustrations) && !item.candidate
    : showAll || (systemName ? item.systemName === systemName
      : item.name.includes(query) || normalized.length > 0 && item.names.some(name => name.includes(normalized))));
  // A typed name lists exact names first, then names that begin with it, then the rest, each in catalogue order:
  // "europa" finds the moon before the asteroid 52 Europa, which lies nearer the Sun.
  const rank = (item: T) => item.name === query || item.names.includes(normalized) ? 0
    : item.name.startsWith(query) || normalized.length > 0 && item.names.some(name => name.startsWith(normalized)) ? 1 : 2;
  const ranked = classification || systemName || showAll ? matches
    : matches.map((item, index) => ({ item, index, rank: rank(item) })).sort((a, b) => a.rank - b.rank || a.index - b.index).map(entry => entry.item);
  return { query, matches: ranked, classification, systemName, showAll,
    detailQuery: classification || systemName || showAll ? '' : query };
}

/** Read only the labels already published by the shared result components. */
export function objectSearchLabels(item: HTMLElement): ObjectSearchLabels {
  const names: unknown = JSON.parse(item.dataset.objectSearchNames ?? '[]');
  if (!Array.isArray(names) || !names.every(name => typeof name === 'string')) throw new TypeError('Prepared object search names are invalid.');
  return { name: item.dataset.objectName ?? '', names,
    illustration: item.dataset.objectIllustration === 'true',
    candidate: item.dataset.objectCandidate === 'true',
    classification: item.dataset.objectClassification ?? '', classificationName: item.dataset.objectClassificationName ?? '',
    systemName: item.dataset.objectSystemName ?? '' };
}
